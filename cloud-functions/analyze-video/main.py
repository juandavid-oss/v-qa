import os
import re
import stat
import tarfile
import time
import traceback
import uuid
import json
import subprocess
import tempfile
from urllib.parse import urlparse, parse_qs

import functions_framework
import requests
from google.cloud import videointelligence_v1 as vi
from google.protobuf.json_format import MessageToDict
import google.generativeai as genai
from supabase import create_client


# --- FFmpeg/FFprobe setup (not included in Cloud Functions python311 runtime) ---
_FFMPEG_DIR = "/tmp/ffmpeg-bin"
_FFMPEG_PATH = os.path.join(_FFMPEG_DIR, "ffmpeg")
_FFPROBE_PATH = os.path.join(_FFMPEG_DIR, "ffprobe")
_FFMPEG_URL = "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"


def _ensure_ffmpeg():
    """Download a static ffmpeg/ffprobe build if not already cached in /tmp."""
    if os.path.isfile(_FFMPEG_PATH) and os.path.isfile(_FFPROBE_PATH):
        return
    os.makedirs(_FFMPEG_DIR, exist_ok=True)
    print("Downloading static ffmpeg build...", flush=True)
    archive_path = os.path.join(_FFMPEG_DIR, "ffmpeg.tar.xz")
    resp = requests.get(_FFMPEG_URL, stream=True, timeout=120)
    resp.raise_for_status()
    with open(archive_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=1 << 20):
            f.write(chunk)
    with tarfile.open(archive_path, "r:xz") as tar:
        for member in tar.getmembers():
            basename = os.path.basename(member.name)
            if basename in ("ffmpeg", "ffprobe"):
                member.name = basename
                tar.extract(member, _FFMPEG_DIR)
    os.remove(archive_path)
    for binary in [_FFMPEG_PATH, _FFPROBE_PATH]:
        st = os.stat(binary)
        os.chmod(binary, st.st_mode | stat.S_IEXEC)
    print("ffmpeg ready.", flush=True)

# --- Configuration ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL") or "gemini-flash-latest"
GEMINI_FALLBACK_MODELS = ("gemini-2.5-flash", "gemini-1.5-flash")
SPELLCHECK_API_URL = os.environ.get("SPELLCHECK_API_URL", "https://api.api-ninjas.com/v1/spellcheck")
SPELLCHECK_API_KEY = os.environ.get("SPELLCHECK_API_KEY")
CLOUD_FUNCTION_SECRET = os.environ.get("CLOUD_FUNCTION_SECRET")
MIN_SUBTITLE_CONFIDENCE = float(os.environ.get("MIN_SUBTITLE_CONFIDENCE", "0.9"))
TRANSCRIPTION_MAX_CHUNK_SECONDS = float(os.environ.get("TRANSCRIPTION_MAX_CHUNK_SECONDS", "2.0"))
TRANSCRIPTION_MIN_CHUNK_SECONDS = float(os.environ.get("TRANSCRIPTION_MIN_CHUNK_SECONDS", "1.0"))
FRAME_IO_TOKEN = os.environ.get("FRAME_IO_TOKEN") or os.environ.get("FRAME_IO_V4_TOKEN")
FRAME_IO_V4_API = "https://api.frame.io/v4"
FRAME_MEDIA_LINK_INCLUDES = ",".join((
    "media_links.original",
    "media_links.thumbnail",
    "media_links.thumbnail_high_quality",
    "media_links.video_h264_180",
    "media_links.high_quality",
    "media_links.efficient",
    "media_links.scrub_sheet",
))
VIDEO_EXT_RE = re.compile(r"\.(mp4|mov|m4v|webm|avi|mkv|mxf)(\?|$)", re.IGNORECASE)
IMAGE_EXT_RE = re.compile(r"\.(jpg|jpeg|png|webp|gif|svg|avif)(\?|$)", re.IGNORECASE)
POSITIVE_URL_HINTS = ("video", "download", "source", "original", "proxy", "stream", "transcode", "playback")
NEGATIVE_URL_HINTS = ("thumbnail", "thumb", "poster", "sprite", "waveform", "image")


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


class FrameIoV4Error(Exception):
    def __init__(self, message: str, endpoint: str, status: int | None = None, detail: str | None = None):
        super().__init__(message)
        self.endpoint = endpoint
        self.status = status
        self.detail = detail


def parse_frame_io_asset_id(frame_io_url: str) -> str | None:
    try:
        parsed = urlparse(frame_io_url)
    except Exception:
        return None

    path_parts = [p for p in parsed.path.split("/") if p]
    if len(path_parts) >= 2 and path_parts[0] in {"player", "f"}:
        candidate = path_parts[1]
        return candidate if re.match(r"^[A-Za-z0-9_-]+$", candidate) else None

    if len(path_parts) >= 3 and path_parts[0] in {"review", "reviews"}:
        candidate = path_parts[2]
        return candidate if re.match(r"^[A-Za-z0-9_-]+$", candidate) else None

    if len(path_parts) >= 4 and path_parts[0] in {"project", "projects"} and path_parts[2] == "view":
        candidate = path_parts[3]
        return candidate if re.match(r"^[A-Za-z0-9_-]+$", candidate) else None

    query = parse_qs(parsed.query)
    candidate = (query.get("asset_id") or query.get("assetId") or [None])[0]
    if candidate and re.match(r"^[A-Za-z0-9_-]+$", candidate):
        return candidate

    return None


def is_frame_view_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except Exception:
        return False

    host = (parsed.hostname or "").lower()
    is_frame_host = host == "frame.io" or host.endswith(".frame.io") or host == "f.io"
    if not is_frame_host:
        return False

    path_parts = [p.lower() for p in parsed.path.split("/") if p]
    if len(path_parts) >= 2 and path_parts[0] in {"player", "f"}:
        return True
    if len(path_parts) >= 3 and path_parts[0] in {"review", "reviews"}:
        return True
    if len(path_parts) >= 4 and path_parts[0] in {"project", "projects"} and path_parts[2] == "view":
        return True
    return False


def fetch_video_from_frame_io(frame_io_url: str) -> dict:
    if not FRAME_IO_TOKEN:
        raise ValueError("FRAME_IO_TOKEN is not configured")

    asset_id = parse_frame_io_asset_id(frame_io_url)
    if not asset_id:
        raise ValueError("Invalid Frame.io URL")

    account_id = get_frame_account_id(FRAME_IO_TOKEN)
    try:
        file_data = get_file_by_id(account_id, asset_id, FRAME_IO_TOKEN)
    except FrameIoV4Error as error:
        if error.status in (404, 422):
            version_stack = get_version_stack_by_id(account_id, asset_id, FRAME_IO_TOKEN)
            file_data = resolve_head_version_file(account_id, version_stack, FRAME_IO_TOKEN)
        else:
            raise

    metadata = extract_frame_metadata(file_data)
    video_url = metadata.get("video_url")
    if not video_url:
        raise ValueError("Frame.io resource does not expose a downloadable video URL")

    metadata["asset_id"] = asset_id
    metadata["account_id"] = account_id
    return metadata


def get_frame_account_id(token: str) -> str:
    payload = frame_v4_get("/accounts", token)
    data = payload.get("data")
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict):
            account_id = first.get("id")
            if isinstance(account_id, str) and account_id:
                return account_id

    raise FrameIoV4Error("No account available in Frame.io V4 response", "/accounts")


def get_file_by_id(account_id: str, file_id: str, token: str) -> dict:
    include = requests.utils.quote(FRAME_MEDIA_LINK_INCLUDES, safe="")
    payload = frame_v4_get(
        f"/accounts/{account_id}/files/{file_id}?include={include}",
        token,
    )
    return unwrap_data_object(payload, "file")


def get_version_stack_by_id(account_id: str, version_stack_id: str, token: str) -> dict:
    include = requests.utils.quote(FRAME_MEDIA_LINK_INCLUDES, safe="")
    payload = frame_v4_get(
        f"/accounts/{account_id}/version_stacks/{version_stack_id}?include={include}",
        token,
    )
    return unwrap_data_object(payload, "version_stack")


def resolve_head_version_file(account_id: str, version_stack: dict, token: str) -> dict:
    head_version = version_stack.get("head_version")
    if isinstance(head_version, dict):
        return head_version

    head_version_id = (
        head_version if isinstance(head_version, str) else version_stack.get("head_version_id")
    )
    if isinstance(head_version_id, str) and head_version_id:
        return get_file_by_id(account_id, head_version_id, token)

    raise FrameIoV4Error(
        "Version stack does not include head_version information",
        f"/accounts/{account_id}/version_stacks",
    )


def extract_frame_metadata(file_data: dict) -> dict:
    media_links = file_data.get("media_links")
    if not isinstance(media_links, dict):
        media_links = {}

    video_url = (
        pick_video_link(media_links)
        or pick_top_level_video_link(file_data)
        or pick_heuristic_video_link(file_data)
    )

    thumbnail_url = media_link_to_url(media_links.get("thumbnail")) or find_thumbnail_link(media_links)
    if not thumbnail_url:
        thumbnail_url = read_string(file_data.get("thumbnail_url"))

    if not video_url:
        view_url = read_string(file_data.get("view_url"))
        print(
            "Frame.io metadata resolved without direct video URL "
            f"(media_link_keys={list(media_links.keys())}, has_view_url={bool(view_url)})",
            flush=True,
        )

    return {
        "name": read_string(file_data.get("name")),
        "duration": pick_duration(file_data),
        "thumbnail_url": thumbnail_url,
        "video_url": video_url,
    }


def pick_duration(file_data: dict) -> float | None:
    direct = read_number(file_data.get("duration"))
    if direct is not None:
        return direct

    metadata = file_data.get("metadata")
    if isinstance(metadata, dict):
        for key in ("duration", "duration_seconds", "durationSeconds"):
            value = read_number(metadata.get(key))
            if value is not None:
                return value

    return None


def find_thumbnail_link(media_links: dict) -> str | None:
    for key, value in media_links.items():
        if "thumb" in key.lower() or "thumbnail" in key.lower() or "poster" in key.lower():
            found = media_link_to_url(value)
            if found:
                return found
    return None


def pick_video_link(media_links: dict) -> str | None:
    preferred_keys = ("high_quality", "original", "efficient")
    for key in preferred_keys:
        candidate = media_link_to_url(media_links.get(key))
        if candidate and not is_frame_view_url(candidate):
            return candidate

    for key, value in media_links.items():
        lower = key.lower()
        if "thumb" in lower or "thumbnail" in lower or "poster" in lower:
            continue

        candidate = media_link_to_url(value)
        if candidate and not is_frame_view_url(candidate):
            return candidate

    return None


def pick_top_level_video_link(file_data: dict) -> str | None:
    for key in ("download_url", "source_url", "asset_url", "original_url"):
        candidate = read_string(file_data.get(key))
        if candidate and not is_frame_view_url(candidate):
            return candidate
    return None


def pick_heuristic_video_link(root: dict) -> str | None:
    best_url = None
    best_score = 0
    stack = [(root, "root", 0)]
    visited = 0

    while stack and visited < 2000:
        value, path, depth = stack.pop()
        visited += 1
        if depth > 8:
            continue

        if isinstance(value, str):
            score = score_candidate_video_url(value, path)
            if score > best_score:
                best_score = score
                best_url = value
            continue

        if isinstance(value, list):
            for index, entry in enumerate(value):
                stack.append((entry, f"{path}[{index}]", depth + 1))
            continue

        if isinstance(value, dict):
            for key, nested in value.items():
                stack.append((nested, f"{path}.{key}", depth + 1))

    return best_url


def score_candidate_video_url(url: str, path: str) -> int:
    try:
        parsed = urlparse(url)
    except Exception:
        return -100

    if parsed.scheme not in ("http", "https"):
        return -100
    if is_frame_view_url(url):
        return -100

    lower_url = url.lower()
    lower_path = path.lower()
    score = 0

    if VIDEO_EXT_RE.search(lower_url):
        score += 8
    if "response-content-type=video" in lower_url or "content-type=video" in lower_url:
        score += 6

    for hint in POSITIVE_URL_HINTS:
        if hint in lower_url or hint in lower_path:
            score += 2

    for hint in NEGATIVE_URL_HINTS:
        if hint in lower_url or hint in lower_path:
            score -= 4

    if IMAGE_EXT_RE.search(lower_url):
        score -= 8

    return score


def media_link_to_url(value) -> str | None:
    if isinstance(value, str) and value:
        return value
    if isinstance(value, dict):
        for key in ("href", "download", "download_url", "secure_download_url", "url", "src", "source_url"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate:
                return candidate
    return None


def frame_v4_get(path: str, token: str) -> dict:
    response = requests.get(
        f"{FRAME_IO_V4_API}{path}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
        timeout=30,
    )

    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if response.status_code >= 400:
        raise FrameIoV4Error(
            f"Frame.io V4 request failed ({response.status_code})",
            path,
            response.status_code,
            extract_v4_error_detail(payload),
        )

    if not isinstance(payload, dict):
        raise FrameIoV4Error("Frame.io V4 returned a non-object payload", path, response.status_code)

    return payload


def extract_v4_error_detail(payload: dict) -> str | None:
    if not isinstance(payload, dict):
        return None

    errors = payload.get("errors")
    if isinstance(errors, list) and errors and isinstance(errors[0], dict):
        detail = errors[0].get("detail")
        if isinstance(detail, str) and detail:
            return detail
        title = errors[0].get("title")
        if isinstance(title, str) and title:
            return title

    message = payload.get("message")
    return message if isinstance(message, str) and message else None


def unwrap_data_object(payload: dict, label: str) -> dict:
    data = payload.get("data")
    if isinstance(data, dict):
        return data
    if isinstance(payload, dict):
        return payload

    raise FrameIoV4Error(f"Frame.io V4 returned invalid {label} payload", f"unwrap:{label}")


def read_string(value) -> str | None:
    return value if isinstance(value, str) and value else None


def read_number(value) -> float | None:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def update_status(supabase, project_id: str, status: str, progress: int, debug_msg: str = ""):
    """Update project status and optionally store a debug message in error_message.

    The debug_msg is stored in `error_message` so the frontend can show real-time
    step-by-step progress via Supabase Realtime.  It is cleared when status=completed.
    """
    update_data: dict = {
        "status": status,
        "progress": progress,
    }
    if debug_msg:
        update_data["error_message"] = f"[DEBUG] {debug_msg}"
    if status == "completed":
        update_data["error_message"] = None

    supabase.table("projects").update(update_data).eq("id", project_id).execute()
    log_line = f"[{status} {progress}%] {debug_msg}" if debug_msg else f"[{status} {progress}%]"
    print(f"  >> {log_line}", flush=True)


def clear_previous_results(supabase, project_id: str):
    """Delete previous analysis artifacts so reruns do not duplicate rows."""
    for table_name in ("text_detections", "transcriptions", "spelling_errors", "mismatches"):
        supabase.table(table_name).delete().eq("project_id", project_id).execute()


# --- 1. Video Download ---
def download_video(video_url: str, tmp_dir: str) -> str:
    video_path = os.path.join(tmp_dir, "video.mp4")
    print(f"Downloading video from: {video_url[:120]}...", flush=True)
    response = requests.get(video_url, stream=True, timeout=600)
    response.raise_for_status()
    content_type = response.headers.get("Content-Type", "unknown")
    print(f"Response Content-Type: {content_type}", flush=True)
    total = 0
    with open(video_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
            total += len(chunk)
    size_mb = total / (1024 * 1024)
    print(f"Downloaded {size_mb:.1f} MB to {video_path}", flush=True)
    if "text/html" in content_type.lower() or total < 1000:
        with open(video_path, "rb") as f:
            raw_preview = f.read(500)
        preview = raw_preview.decode("utf-8", errors="replace")
        raise ValueError(
            "Video download did not return a valid media file "
            f"(content_type={content_type}, bytes={total}). "
            "The URL is likely a Frame.io page link or an expired temporary URL. "
            f"Preview: {preview}"
        )
    return video_path


# --- 2. Text Detection (Google Video Intelligence) ---
def detect_text_in_video(video_path: str) -> list[dict]:
    """Use Google Video Intelligence to detect text in video frames."""
    client = vi.VideoIntelligenceServiceClient()

    with open(video_path, "rb") as f:
        input_content = f.read()

    features = [vi.Feature.TEXT_DETECTION]
    operation = client.annotate_video(
        request={"input_content": input_content, "features": features}
    )
    result = operation.result(timeout=600)

    return extract_detections_from_vi_result(result)


def detect_text_in_video_with_raw(video_path: str) -> tuple[list[dict], dict]:
    """Detect text and return both flattened detections and raw VI payload."""
    client = vi.VideoIntelligenceServiceClient()

    with open(video_path, "rb") as f:
        input_content = f.read()

    features = [vi.Feature.TEXT_DETECTION]
    operation = client.annotate_video(
        request={"input_content": input_content, "features": features}
    )
    result = operation.result(timeout=600)
    detections = extract_detections_from_vi_result(result)

    raw_payload = MessageToDict(
        result._pb,
        preserving_proto_field_name=True,
    ) if hasattr(result, "_pb") else {}

    return detections, raw_payload


def extract_detections_from_vi_result(result) -> list[dict]:
    detections = []
    for annotation in result.annotation_results:
        for text_annotation in annotation.text_annotations:
            text = text_annotation.text
            for segment in text_annotation.segments:
                start = segment.segment.start_time_offset.total_seconds()
                end = segment.segment.end_time_offset.total_seconds()
                confidence = segment.confidence

                # Get bounding box from first frame
                bbox = {"top": 0, "left": 0, "bottom": 1, "right": 1}
                if segment.frames:
                    vertices = segment.frames[0].rotated_bounding_box.vertices
                    if vertices:
                        xs = [v.x for v in vertices]
                        ys = [v.y for v in vertices]
                        bbox = {
                            "top": min(ys),
                            "left": min(xs),
                            "bottom": max(ys),
                            "right": max(xs),
                        }

                detections.append({
                    "text": text,
                    "start_time": start,
                    "end_time": end,
                    "confidence": confidence,
                    "bbox": bbox,
                })
    return detections


def _parse_duration_seconds(value) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        raw = value[:-1] if value.endswith("s") else value
        try:
            return float(raw)
        except ValueError:
            return 0.0
    if isinstance(value, dict):
        seconds = value.get("seconds", 0)
        nanos = value.get("nanos", 0)
        try:
            return float(seconds) + (float(nanos) / 1_000_000_000)
        except (TypeError, ValueError):
            return 0.0
    return 0.0


def _to_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_transcription_time_seconds(value, fallback: float | None = None) -> float | None:
    """Parse transcription timestamps from multiple formats into seconds.

    Accepted formats:
    - number: 12.34
    - numeric string: "12.34"
    - suffixed seconds: "12.34s"
    - timecode: "MM:SS", "HH:MM:SS", optional decimals in last part
    - protobuf-like dict: {"seconds": 12, "nanos": 340000000}
    """
    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, dict):
        return _parse_duration_seconds(value)

    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return fallback

        # "12.3s"
        if raw.endswith("s"):
            raw_seconds = raw[:-1].strip()
            try:
                return float(raw_seconds)
            except ValueError:
                pass

        # "12.3"
        try:
            return float(raw)
        except ValueError:
            pass

        # "MM:SS(.sss)" or "HH:MM:SS(.sss)"
        if ":" in raw:
            parts = raw.split(":")
            if 2 <= len(parts) <= 3:
                try:
                    total = 0.0
                    for part in parts:
                        total = total * 60.0 + float(part.strip())
                    return total
                except ValueError:
                    pass

    return fallback


def extract_detections_from_raw_payload(raw_payload: dict) -> list[dict]:
    detections: list[dict] = []
    annotations = raw_payload.get("annotation_results", [])
    if not isinstance(annotations, list):
        return detections

    for annotation in annotations:
        if not isinstance(annotation, dict):
            continue
        text_annotations = annotation.get("text_annotations", [])
        if not isinstance(text_annotations, list):
            continue

        for text_annotation in text_annotations:
            if not isinstance(text_annotation, dict):
                continue
            text = read_string(text_annotation.get("text"))
            if not text:
                continue

            segments = text_annotation.get("segments", [])
            if not isinstance(segments, list):
                continue

            for segment in segments:
                if not isinstance(segment, dict):
                    continue
                segment_range = segment.get("segment", {}) if isinstance(segment.get("segment"), dict) else {}
                start = _parse_duration_seconds(segment_range.get("start_time_offset"))
                end = _parse_duration_seconds(segment_range.get("end_time_offset"))
                confidence = _to_float(segment.get("confidence"), 0.0)

                bbox = {"top": 0.0, "left": 0.0, "bottom": 1.0, "right": 1.0}
                frames = segment.get("frames", [])
                if isinstance(frames, list) and frames:
                    first_frame = frames[0] if isinstance(frames[0], dict) else {}
                    rotated = first_frame.get("rotated_bounding_box", {}) if isinstance(first_frame.get("rotated_bounding_box"), dict) else {}
                    vertices = rotated.get("vertices", [])
                    if isinstance(vertices, list) and vertices:
                        xs = [_to_float(v.get("x")) for v in vertices if isinstance(v, dict)]
                        ys = [_to_float(v.get("y")) for v in vertices if isinstance(v, dict)]
                        if xs and ys:
                            bbox = {
                                "top": min(ys),
                                "left": min(xs),
                                "bottom": max(ys),
                                "right": max(xs),
                            }

                detections.append({
                    "text": text,
                    "start_time": start,
                    "end_time": end,
                    "confidence": confidence,
                    "bbox": bbox,
                })

    return detections


# --- 3. Partial Sequence Merging ---
def bbox_overlap(a: dict, b: dict) -> float:
    """Calculate overlap ratio between two bounding boxes."""
    x_overlap = max(0, min(a["right"], b["right"]) - max(a["left"], b["left"]))
    y_overlap = max(0, min(a["bottom"], b["bottom"]) - max(a["top"], b["top"]))
    intersection = x_overlap * y_overlap

    area_a = (a["right"] - a["left"]) * (a["bottom"] - a["top"])
    area_b = (b["right"] - b["left"]) * (b["bottom"] - b["top"])

    if area_a == 0 or area_b == 0:
        return 0

    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0


def merge_partial_sequences(detections: list[dict]) -> list[dict]:
    """
    Groups text detections that are partial sequences of each other
    at the same spatial position.

    Handles animated text like: "H" -> "Ho" -> "Hor" -> "Horizonte"
    """
    if not detections:
        return []

    # Group by spatial proximity
    spatial_groups = []
    assigned = set()

    for i, det in enumerate(detections):
        if i in assigned:
            continue
        group = [det]
        assigned.add(i)

        for j, other in enumerate(detections):
            if j in assigned:
                continue
            if bbox_overlap(det["bbox"], other["bbox"]) > 0.6:
                group.append(other)
                assigned.add(j)

        spatial_groups.append(group)

    merged = []
    for group in spatial_groups:
        group.sort(key=lambda d: d["start_time"])

        current_sequence = [group[0]]
        for i in range(1, len(group)):
            prev_text = current_sequence[-1]["text"].strip()
            curr_text = group[i]["text"].strip()

            # Check if it's a growing prefix or shrinking suffix
            is_prefix = (
                curr_text.startswith(prev_text)
                or prev_text.startswith(curr_text)
            )
            time_gap = group[i]["start_time"] - current_sequence[-1]["end_time"]
            is_within_window = time_gap < 1.0

            if is_prefix and is_within_window:
                current_sequence.append(group[i])
            else:
                merged.append(_resolve_sequence(current_sequence))
                current_sequence = [group[i]]

        merged.append(_resolve_sequence(current_sequence))

    return merged


def _resolve_sequence(sequence: list[dict]) -> dict:
    """From a list of partial detections, produce one merged detection."""
    longest = max(sequence, key=lambda d: len(d["text"]))
    is_partial = len(sequence) > 1
    return {
        "text": longest["text"],
        "start_time": sequence[0]["start_time"],
        "end_time": sequence[-1]["end_time"],
        "confidence": longest["confidence"],
        "bbox": longest["bbox"],
        "is_partial_sequence": is_partial,
        "partial_members": [s["text"] for s in sequence] if is_partial else [],
    }


# --- 4. Subtitle vs Fixed Text Classification ---
def _normalize_repetition_text(text: str) -> str:
    """Normalize text key for repetition checks (case/spacing-insensitive)."""
    value = (text or "").strip().lower()
    return re.sub(r"\s+", " ", value)


def classify_subtitle_vs_fixed(
    detections: list[dict],
    video_duration: float,
    debug_scores: bool = False,
) -> list[dict]:
    """Classify each detection as subtitle or fixed text."""
    for det in detections:
        score_subtitle = 0
        score_fixed = 0
        bbox = det["bbox"]

        # Position heuristic: subtitles are in bottom 30%
        vertical_center = (bbox["top"] + bbox["bottom"]) / 2
        if vertical_center > 0.70:
            score_subtitle += 3
        elif vertical_center < 0.15:
            score_fixed += 3

        # Duration heuristic
        duration = det["end_time"] - det["start_time"]
        if 0.5 <= duration <= 8.0:
            score_subtitle += 2
        elif video_duration > 0 and duration > video_duration * 0.3:
            score_fixed += 4

        # Text length heuristic
        word_count = len(det["text"].split())
        if word_count >= 3:
            score_subtitle += 1
        elif word_count <= 2 and det["text"][0:1].isupper():
            score_fixed += 1

        # Repetition heuristic
        norm_text = _normalize_repetition_text(det.get("text", ""))
        same_text_same_pos = sum(
            1 for d in detections
            if _normalize_repetition_text(d.get("text", "")) == norm_text
            and d is not det
            and bbox_overlap(d["bbox"], det["bbox"]) >= 0.85
        )
        if same_text_same_pos >= 3:
            score_fixed += 4

        det["is_subtitle"] = score_subtitle > score_fixed
        det["is_fixed_text"] = score_fixed > score_subtitle
        det["repeat_count"] = same_text_same_pos
        det["score_subtitle"] = score_subtitle
        det["score_fixed"] = score_fixed
        det["decision_reason"] = (
            "subtitle_score_higher"
            if score_subtitle > score_fixed
            else "fixed_score_higher"
            if score_fixed > score_subtitle
            else "score_tie_unknown"
        )

        if debug_scores:
            print(
                "classification_debug "
                f"text='{det.get('text','')[:80]}' "
                f"repeat_count={same_text_same_pos} "
                f"score_subtitle={score_subtitle} "
                f"score_fixed={score_fixed} "
                f"is_subtitle={det['is_subtitle']} "
                f"is_fixed={det['is_fixed_text']}",
                flush=True,
            )

    return detections


# --- 5. Audio Transcription (Gemini) ---
def extract_audio(video_path: str, tmp_dir: str) -> str:
    _ensure_ffmpeg()
    audio_path = os.path.join(tmp_dir, "audio.wav")
    result = subprocess.run(
        [_FFMPEG_PATH, "-i", video_path, "-vn", "-acodec", "pcm_s16le",
         "-ar", "16000", "-ac", "1", audio_path, "-y"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"ffmpeg stderr: {result.stderr}", flush=True)
        raise RuntimeError(f"ffmpeg failed: {result.stderr[-500:]}")
    return audio_path


def transcribe_with_gemini(audio_path: str) -> list[dict]:
    """Transcribe audio using Gemini."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    genai.configure(api_key=GEMINI_API_KEY)
    audio_file = genai.upload_file(audio_path, mime_type="audio/wav")

    prompt = """Transcribe this audio precisely. Return the transcription as a JSON array where each element has:
- "text": the transcribed text for that segment
- "start_time": start time in seconds
- "end_time": end time in seconds
- "speaker": speaker label (e.g., "Speaker 1")

Return ONLY valid JSON, no markdown or other text."""

    candidate_models: list[str] = []
    configured_model = read_string(GEMINI_MODEL)
    if configured_model:
        candidate_models.append(configured_model)
    for fallback_model in GEMINI_FALLBACK_MODELS:
        if fallback_model not in candidate_models:
            candidate_models.append(fallback_model)

    last_error = None
    try:
        for model_name in candidate_models:
            try:
                print(f"Transcribing with Gemini model: {model_name}", flush=True)
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(
                    [prompt, audio_file],
                    request_options={"timeout": 600},
                )
                text = (response.text or "").strip()
                if not text:
                    raise RuntimeError("Gemini returned an empty transcription response")

                # Clean potential markdown wrapping
                if text.startswith("```"):
                    text = text.split("\n", 1)[1]
                    text = text.rsplit("```", 1)[0]

                import json
                segments = json.loads(text)
                if not isinstance(segments, list):
                    raise RuntimeError("Gemini transcription response was not a JSON array")
                return segments
            except Exception as error:
                last_error = error
                message = str(error)
                print(f"Gemini model {model_name} failed: {message}", flush=True)
                if not is_gemini_model_unavailable_error(message):
                    raise
    finally:
        try:
            if getattr(audio_file, "name", None):
                genai.delete_file(audio_file.name)
        except Exception:
            pass

    raise RuntimeError(
        "No available Gemini model for transcription. "
        f"Tried: {', '.join(candidate_models)}. Last error: {last_error}"
    )


def split_transcription_segments(segments: list[dict]) -> list[dict]:
    """Normalize transcription segments preserving original Gemini timestamps.

    Important: this function does NOT synthesize/chunk timestamps. It only parses
    and sanitizes the start/end times returned by Gemini, so UI cards align with
    real transcription timing.
    """
    if not segments:
        return []
    normalized_segments: list[dict] = []
    invalid_time_rows = 0

    for segment in segments:
        if not isinstance(segment, dict):
            continue

        text = (read_string(segment.get("text")) or "").strip()
        if not text:
            continue

        start_time = _parse_transcription_time_seconds(segment.get("start_time"), None)
        end_time = _parse_transcription_time_seconds(segment.get("end_time"), None)

        if start_time is None and end_time is None:
            invalid_time_rows += 1
            continue
        if start_time is None:
            start_time = end_time if end_time is not None else 0.0
        if end_time is None:
            end_time = start_time

        start_time = max(0.0, float(start_time))
        end_time = max(0.0, float(end_time))
        if end_time < start_time:
            start_time, end_time = end_time, start_time

        normalized_segments.append({
            "text": text,
            "start_time": start_time,
            "end_time": end_time,
            "speaker": read_string(segment.get("speaker")),
            "confidence": segment.get("confidence"),
        })

    if invalid_time_rows > 0:
        print(
            f"WARNING: skipped {invalid_time_rows} transcription segments due to invalid timestamps",
            flush=True,
        )
    normalized_segments.sort(key=lambda s: (s.get("start_time", 0.0), s.get("end_time", 0.0)))
    return normalized_segments


def is_gemini_model_unavailable_error(message: str) -> bool:
    lowered = message.lower()
    if "no longer available to new users" in lowered:
        return True
    if "model not found" in lowered:
        return True
    if "not found for api version" in lowered and "models/" in lowered:
        return True
    if "404" in lowered and "models/" in lowered:
        return True
    return False


# --- 6. Spelling & Grammar Check (API Ninjas Spellcheck) ---
def _normalize_spell_token(text: str) -> str:
    """Normalize token for typo comparison (ignore case/punctuation differences)."""
    if not text:
        return ""
    return re.sub(r"[^\w\s]", "", text).strip().lower()


def _prepare_spellcheck_text(text: str) -> str:
    """Prepare subtitle text for spellcheck while preserving contractions like I've/don't."""
    if not text:
        return ""
    # Normalize curly apostrophes and remove punctuation except apostrophes.
    value = text.replace("’", "'")
    value = re.sub(r"[^\w\s']", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def check_spelling(
    texts: list[dict],
    debug_by_detection_id: dict[str, list[dict]] | None = None,
) -> list[dict]:
    """Check typos with API Ninjas Spellcheck (send whole subtitle sentence)."""
    errors = []

    if not SPELLCHECK_API_KEY:
        raise ValueError("SPELLCHECK_API_KEY is not configured")

    for item in texts:
        raw_text = item["text"]
        timestamp = item.get("start_time", 0)
        detection_id = item.get("detection_id")
        if not raw_text or not raw_text.strip():
            continue

        # Keep apostrophes so contractions don't become false positives (e.g. I've -> Ive).
        text = _prepare_spellcheck_text(raw_text)
        if not text:
            continue

        response = requests.get(
            SPELLCHECK_API_URL,
            headers={"X-Api-Key": SPELLCHECK_API_KEY},
            params={"text": text},
            timeout=30,
        )
        response_payload: dict = {}
        if response.status_code == 200:
            parsed = response.json()
            response_payload = parsed if isinstance(parsed, dict) else {}
        else:
            print(
                f"Spellcheck API request failed (status={response.status_code}) for text: {text[:120]}",
                flush=True,
            )

        corrections = response_payload.get("corrections", [])
        if not isinstance(corrections, list):
            corrections = []

        if debug_by_detection_id is not None and detection_id:
            debug_by_detection_id.setdefault(detection_id, []).append({
                "provider": "api_ninjas",
                "request_text": text,
                "status_code": response.status_code,
                "response_json": response_payload,
                "correction_count": len(corrections),
            })

        if response.status_code != 200:
            continue

        for correction in corrections:
            if not isinstance(correction, dict):
                continue
            original_word = read_string(correction.get("word"))
            if not original_word:
                continue
            suggested = read_string(correction.get("correction"))
            candidates = correction.get("candidates", [])
            if not suggested and isinstance(candidates, list) and candidates:
                suggested = read_string(candidates[0])
            if not suggested:
                suggested = original_word

            original_norm = _normalize_spell_token(original_word)
            suggested_norm = _normalize_spell_token(suggested)
            errors.append({
                "original_text": original_word,
                "suggested_text": suggested,
                "context": raw_text,
                "timestamp": timestamp,
                "detection_id": detection_id,
                "rule_id": "API_NINJAS_SPELLCHECK",
                "source": "subtitle",
                "has_replacement": bool(original_norm and suggested_norm and suggested_norm != original_norm),
            })

    return errors


def filter_false_positives(errors: list[dict], detections: list[dict]) -> list[dict]:
    """Filter out spelling errors that are brand names or punctuation/case-only diffs."""
    brand_names = {
        d["text"].lower() for d in detections if d.get("is_fixed_text")
    }

    filtered = []
    for error in errors:
        original = error["original_text"]
        original_lower = original.lower()
        has_replacement = bool(error.get("has_replacement", True))

        # Skip non-actionable matches (same token after normalization).
        if not has_replacement:
            continue

        # Skip if it's a brand name
        if original_lower in brand_names:
            continue

        # Skip if only difference is capitalization/punctuation
        suggested = error.get("suggested_text", "")
        if (
            has_replacement
            and original
            and suggested
            and _normalize_spell_token(original) == _normalize_spell_token(suggested)
        ):
            continue

        filtered.append(error)

    return filtered


# --- 7. Mismatch Detection ---

_NUMBER_WORDS = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
    "ten": "10", "eleven": "11", "twelve": "12", "thirteen": "13",
    "fourteen": "14", "fifteen": "15", "sixteen": "16", "seventeen": "17",
    "eighteen": "18", "nineteen": "19", "twenty": "20", "twenties": "20s",
    "thirty": "30", "thirties": "30s", "forty": "40", "forties": "40s",
    "fifty": "50", "fifties": "50s", "sixty": "60", "seventy": "70",
    "eighty": "80", "ninety": "90", "hundred": "100", "thousand": "1000",
}


def _normalize_for_comparison(text: str) -> str:
    """Normalize text: lowercase, strip punctuation, unify numbers, collapse whitespace."""
    t = text.lower().strip()
    # Strip ALL punctuation, exclamation/question marks, periods, commas, apostrophes, etc.
    t = re.sub(r"[^\w\s]", "", t)
    # Normalize number words to digits
    for word, digit in _NUMBER_WORDS.items():
        t = re.sub(r"\b" + re.escape(word) + r"\b", digit, t)
    # Collapse multiple spaces/tabs into single space
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _normalize_for_contains(text: str) -> str:
    """Normalize text for strict contains checks (ignore punctuation/case/spacing)."""
    return _normalize_for_comparison(text).replace(" ", "")


OVERLAP_TOLERANCE = 1.5


def detect_mismatches(subtitles: list[dict], transcriptions: list[dict]) -> list[dict]:
    """Flag transcription rows not contained in nearby subtitles (±1.5s window)."""
    mismatches = []

    for t in transcriptions:
        # Join nearby subtitle text around the transcription window.
        nearby_subs = [
            s for s in subtitles
            if s["start_time"] <= (t["end_time"] + OVERLAP_TOLERANCE)
            and s["end_time"] >= (t["start_time"] - OVERLAP_TOLERANCE)
        ]

        if not nearby_subs:
            mismatches.append({
                "subtitle_text": "[no nearby subtitle]",
                "transcription_text": t["text"],
                "start_time": t["start_time"],
                "end_time": t["end_time"],
                "severity": "high",
                "mismatch_type": "missing_subtitle_window",
            })
            continue

        nearby_subs.sort(key=lambda s: (s.get("start_time", 0.0), s.get("end_time", 0.0)))
        joined_subtitles = " ".join(s.get("text", "") for s in nearby_subs if s.get("text"))
        norm_subtitles = _normalize_for_contains(joined_subtitles)
        norm_transcript = _normalize_for_contains(t.get("text", ""))

        # Contains-based check requested by product: transcription should appear in nearby subtitles.
        if not norm_transcript or norm_transcript not in norm_subtitles:
            mismatches.append({
                "subtitle_text": joined_subtitles or "[no nearby subtitle text]",
                "transcription_text": t.get("text", ""),
                "start_time": t["start_time"],
                "end_time": t["end_time"],
                "severity": "medium",
                "mismatch_type": "transcript_not_contained_in_subtitles",
            })

    return mismatches


# --- 8. Store Results in Supabase ---
def store_text_detections(supabase, project_id: str, detections: list[dict]):
    rows = []
    for d in detections:
        rows.append({
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "text": d["text"],
            "start_time": d["start_time"],
            "end_time": d["end_time"],
            "bbox_top": d["bbox"]["top"],
            "bbox_left": d["bbox"]["left"],
            "bbox_bottom": d["bbox"]["bottom"],
            "bbox_right": d["bbox"]["right"],
            "confidence": d.get("confidence"),
            "is_subtitle": d.get("is_subtitle", False),
            "is_fixed_text": d.get("is_fixed_text", False),
            "is_partial_sequence": d.get("is_partial_sequence", False),
        })
    if rows:
        supabase.table("text_detections").insert(rows).execute()


def store_transcriptions(supabase, project_id: str, segments: list[dict]):
    rows = []
    for s in segments:
        rows.append({
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "text": s["text"],
            "start_time": s["start_time"],
            "end_time": s["end_time"],
            "speaker": s.get("speaker"),
            "confidence": s.get("confidence"),
        })
    if rows:
        supabase.table("transcriptions").insert(rows).execute()


def store_spelling_errors(supabase, project_id: str, errors: list[dict]):
    rows = []
    for e in errors:
        # Defensive gate: do not persist non-actionable punctuation/case-only matches.
        if not bool(e.get("has_replacement", True)):
            continue
        rows.append({
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "source": e["source"],
            "original_text": e["original_text"],
            "suggested_text": e["suggested_text"],
            "context": e.get("context"),
            "timestamp": e["timestamp"],
            "rule_id": e.get("rule_id"),
            "is_false_positive": False,
        })
    if rows:
        supabase.table("spelling_errors").insert(rows).execute()


def store_mismatches(supabase, project_id: str, mismatches: list[dict]):
    rows = []
    for m in mismatches:
        rows.append({
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "subtitle_text": m["subtitle_text"],
            "transcription_text": m["transcription_text"],
            "start_time": m["start_time"],
            "end_time": m["end_time"],
            "severity": m["severity"],
            "mismatch_type": m.get("mismatch_type"),
            "is_dismissed": False,
        })
    if rows:
        supabase.table("mismatches").insert(rows).execute()


def save_ocr_raw_to_storage(project_id: str, video_url: str | None, raw_payload: dict) -> dict | None:
    """Persist raw OCR payload to Supabase Storage as latest.json."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Skipping OCR raw save: Supabase env missing", flush=True)
        return None

    generated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    object_path = f"projects/{project_id}/ocr-raw/latest.json"
    raw_document = {
        "version": 1,
        "source": "google_video_intelligence",
        "project_id": project_id,
        "generated_at": generated_at,
        "video_url": video_url,
        "raw_response": raw_payload,
    }

    body = json.dumps(raw_document, ensure_ascii=False).encode("utf-8")
    upload_url = f"{SUPABASE_URL}/storage/v1/object/ocr-raw/{object_path}"
    response = requests.post(
        upload_url,
        headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "apikey": SUPABASE_SERVICE_KEY,
            "x-upsert": "true",
            "Content-Type": "application/json",
        },
        data=body,
        timeout=60,
    )

    if response.status_code >= 400:
        print(
            f"Failed to upload OCR raw payload (status={response.status_code} body={response.text[:300]})",
            flush=True,
        )
        return None

    return {
        "storage_path": object_path,
        "generated_at": generated_at,
        "size_bytes": len(body),
    }


def update_project_ocr_raw_metadata(supabase, project_id: str, raw_meta: dict):
    if not raw_meta:
        return
    supabase.table("projects").update({
        "ocr_raw_storage_path": raw_meta["storage_path"],
        "ocr_raw_generated_at": raw_meta["generated_at"],
        "ocr_raw_size_bytes": raw_meta["size_bytes"],
    }).eq("id", project_id).execute()


def build_filtered_subtitles(detections: list[dict]) -> list[dict]:
    fixed_text_set = {
        d["text"].strip().lower()
        for d in detections
        if d.get("is_fixed_text")
    }
    return [
        d for d in detections
        if d.get("is_subtitle")
        and not d.get("is_partial_sequence")
        and _to_float(d.get("confidence"), 0.0) >= MIN_SUBTITLE_CONFIDENCE
        and d["text"].strip().lower() not in fixed_text_set
    ]


def _normalize_semantic_text(text: str) -> str:
    value = (text or "").strip().lower()
    value = re.sub(r"\s+", " ", value)
    return value


def _looks_like_proper_name(text: str) -> bool:
    tokens = re.findall(r"[A-Za-z][A-Za-z'\-]*", text)
    if len(tokens) < 2 or len(tokens) > 4:
        return False
    if not all(token[0].isupper() for token in tokens):
        return False
    # Avoid all-caps acronyms being treated as people names.
    if any(token.isupper() and len(token) > 1 for token in tokens):
        return False
    return True


def _looks_like_brand(text: str) -> bool:
    letters_only = re.sub(r"[^A-Za-z]", "", text)
    if len(letters_only) < 3:
        return False
    upper_ratio = sum(1 for ch in letters_only if ch.isupper()) / len(letters_only)
    return upper_ratio >= 0.8


def classify_semantic_tags(detections: list[dict]) -> list[dict]:
    if not detections:
        return detections

    text_counts: dict[str, int] = {}
    for det in detections:
        norm = _normalize_semantic_text(det.get("text", ""))
        if not norm:
            continue
        text_counts[norm] = text_counts.get(norm, 0) + 1

    for det in detections:
        text = det.get("text", "")
        norm = _normalize_semantic_text(text)
        repeats = text_counts.get(norm, 0)
        tags: list[str] = []

        if _looks_like_proper_name(text):
            tags.append("proper_name")

        if (
            _looks_like_brand(text)
            or (det.get("is_fixed_text") and repeats >= 2)
            or (det.get("is_fixed_text") and len(text.split()) <= 3 and text[:1].isupper())
        ):
            tags.append("brand_name")

        # de-duplicate preserving order
        seen = set()
        dedup_tags = []
        for tag in tags:
            if tag in seen:
                continue
            seen.add(tag)
            dedup_tags.append(tag)

        det["semantic_tags"] = dedup_tags

    return detections


def structural_classification(det: dict) -> str:
    if det.get("is_partial_sequence"):
        return "sequential"
    if det.get("is_fixed_text"):
        return "fixed"
    if det.get("is_subtitle"):
        return "subtitle"
    return "unknown"


def _serialize_spelling_items(items: list[dict]) -> list[dict]:
    serialized: list[dict] = []
    for item in items:
        serialized.append({
            "original_text": item.get("original_text"),
            "suggested_text": item.get("suggested_text"),
            "rule_id": item.get("rule_id"),
            "has_replacement": bool(item.get("has_replacement", True)),
        })
    return serialized


def build_testing_audit_rows(
    detections: list[dict],
    filtered_subtitle_ids: set[str],
    spellcheck_checked_ids: set[str],
    raw_spelling_by_detection_id: dict[str, list[dict]],
    kept_spelling_by_detection_id: dict[str, list[dict]],
    spelling_debug_by_detection_id: dict[str, list[dict]],
) -> list[dict]:
    rows: list[dict] = []
    for idx, det in enumerate(detections, start=1):
        detection_id = det.get("detection_id")
        text = det.get("text", "")
        is_in_filtered = detection_id in filtered_subtitle_ids
        is_spellchecked = detection_id in spellcheck_checked_ids

        if det.get("is_partial_sequence"):
            subtitle_filter_reason = "excluded_partial_sequence"
        elif not det.get("is_subtitle"):
            subtitle_filter_reason = "excluded_not_subtitle"
        elif _to_float(det.get("confidence"), 0.0) < MIN_SUBTITLE_CONFIDENCE:
            subtitle_filter_reason = "excluded_low_confidence"
        elif not is_in_filtered:
            subtitle_filter_reason = "excluded_matches_fixed_text"
        else:
            subtitle_filter_reason = "included_in_final_subtitles"

        raw_spelling = raw_spelling_by_detection_id.get(detection_id, []) if detection_id else []
        kept_spelling = kept_spelling_by_detection_id.get(detection_id, []) if detection_id else []

        if not is_spellchecked:
            spelling_status = "not_checked"
        elif not raw_spelling:
            spelling_status = "no_error"
        elif kept_spelling:
            spelling_status = "error_detected"
        else:
            spelling_status = "error_filtered_out"

        rows.append({
            "order": idx,
            "detection_id": detection_id,
            "text": text,
            "start_time": det.get("start_time", 0),
            "end_time": det.get("end_time", 0),
            "bbox_top": (det.get("bbox") or {}).get("top"),
            "bbox_left": (det.get("bbox") or {}).get("left"),
            "confidence": det.get("confidence"),
            "repeat_count": int(det.get("repeat_count", 0) or 0),
            "score_subtitle": int(det.get("score_subtitle", 0) or 0),
            "score_fixed": int(det.get("score_fixed", 0) or 0),
            "decision_reason": det.get("decision_reason", "unknown"),
            "structural_classification": structural_classification(det),
            "semantic_tags": det.get("semantic_tags", []),
            "included_in_final_subtitles": is_in_filtered,
            "checked_in_spelling": is_spellchecked,
            "subtitle_filter_reason": subtitle_filter_reason,
            "spelling_status": spelling_status,
            "spelling_raw_match_count": len(raw_spelling),
            "spelling_kept_match_count": len(kept_spelling),
            "spelling_raw_matches": _serialize_spelling_items(raw_spelling),
            "spelling_kept_matches": _serialize_spelling_items(kept_spelling),
            "spelling_debug": spelling_debug_by_detection_id.get(detection_id, []) if detection_id else [],
        })

    return rows


# --- Main Cloud Function Entry Point ---
@functions_framework.http
def analyze_video(request):
    """HTTP Cloud Function: orchestrates the full video analysis pipeline."""
    t0 = time.time()
    print("=" * 60, flush=True)
    print("analyze_video STARTED", flush=True)

    # IAM auth on the Cloud Run service is the primary gatekeeper.
    if CLOUD_FUNCTION_SECRET:
        secret_header = request.headers.get("X-Function-Secret", "")
        if secret_header != CLOUD_FUNCTION_SECRET:
            print("WARNING: X-Function-Secret mismatch; relying on IAM auth", flush=True)

    data = request.get_json(silent=True)
    if not data:
        return {"error": "Missing request body"}, 400

    mode = data.get("mode", "analyze")
    project_id = data.get("project_id")
    video_url = data.get("video_url")
    frame_io_url = data.get("frame_io_url")
    raw_ocr_payload = data.get("raw_ocr_payload")

    print(f"project_id: {project_id}", flush=True)
    print(f"mode: {mode}", flush=True)
    print(f"video_url:  {(video_url or '')[:120]}", flush=True)
    print(f"frame_io_url: {frame_io_url}", flush=True)

    if mode not in ("analyze", "classify_ocr_payload"):
        return {"error": f"Unsupported mode: {mode}"}, 400

    if mode == "analyze" and not project_id:
        return {"error": "Missing project_id"}, 400
    if mode == "classify_ocr_payload" and not isinstance(raw_ocr_payload, dict):
        return {"error": "Missing or invalid raw_ocr_payload", "error_code": "invalid_payload"}, 400

    supabase = get_supabase()

    try:
        if mode == "classify_ocr_payload":
            source_payload = raw_ocr_payload.get("raw_response") if isinstance(raw_ocr_payload.get("raw_response"), dict) else raw_ocr_payload
            raw_detections = extract_detections_from_raw_payload(source_payload)
            merged = merge_partial_sequences(raw_detections)
            inferred_duration = max((d.get("end_time", 0) for d in merged), default=0.0)
            classified = classify_subtitle_vs_fixed(merged, inferred_duration, debug_scores=True)
            classified = classify_semantic_tags(classified)
            classified = sorted(
                classified,
                key=lambda d: (
                    d.get("start_time", 0),
                    d.get("end_time", 0),
                    (d.get("text") or "").lower(),
                ),
            )

            for index, det in enumerate(classified):
                det["detection_id"] = f"det_{index:04d}"

            filtered_subtitles = build_filtered_subtitles(classified)
            filtered_subtitle_ids = {d.get("detection_id") for d in filtered_subtitles if d.get("detection_id")}

            spelling_input = [
                {
                    "detection_id": d["detection_id"],
                    "text": d["text"],
                    "start_time": d["start_time"],
                }
                for d in filtered_subtitles
            ]
            spellcheck_checked_ids = {d["detection_id"] for d in spelling_input}
            spelling_debug_by_detection_id: dict[str, list[dict]] = {}
            raw_spelling_errors = check_spelling(spelling_input, spelling_debug_by_detection_id)
            filtered_spelling_errors = filter_false_positives(raw_spelling_errors, classified)

            raw_spelling_by_detection_id: dict[str, list[dict]] = {}
            for error in raw_spelling_errors:
                detection_id = error.get("detection_id")
                if detection_id:
                    raw_spelling_by_detection_id.setdefault(detection_id, []).append(error)

            kept_spelling_by_detection_id: dict[str, list[dict]] = {}
            for error in filtered_spelling_errors:
                detection_id = error.get("detection_id")
                if detection_id:
                    kept_spelling_by_detection_id.setdefault(detection_id, []).append(error)

            audit_rows = build_testing_audit_rows(
                classified,
                filtered_subtitle_ids,
                spellcheck_checked_ids,
                raw_spelling_by_detection_id,
                kept_spelling_by_detection_id,
                spelling_debug_by_detection_id,
            )

            counts = {
                "raw": len(raw_detections),
                "merged": len(merged),
                "subtitle": sum(1 for d in classified if d.get("is_subtitle")),
                "fixed": sum(1 for d in classified if d.get("is_fixed_text")),
                "partial": sum(1 for d in classified if d.get("is_partial_sequence")),
                "filtered_subtitles": len(filtered_subtitles),
                "brand_name": sum(1 for d in classified if "brand_name" in (d.get("semantic_tags") or [])),
                "proper_name": sum(1 for d in classified if "proper_name" in (d.get("semantic_tags") or [])),
                "spelling_checked": len(spelling_input),
                "spelling_raw_matches": len(raw_spelling_errors),
                "spelling_kept_matches": len(filtered_spelling_errors),
                "spelling_with_error": sum(1 for row in audit_rows if row.get("spelling_status") == "error_detected"),
                "spelling_filtered_out": sum(1 for row in audit_rows if row.get("spelling_status") == "error_filtered_out"),
                "spelling_no_error": sum(1 for row in audit_rows if row.get("spelling_status") == "no_error"),
            }

            return {
                "status": "ok",
                "mode": "classify_ocr_payload",
                "counts": counts,
                "raw_detections": raw_detections,
                "audit_rows": audit_rows,
            }, 200

        with tempfile.TemporaryDirectory() as tmp_dir:
            if not video_url:
                raise ValueError("No video URL available; resolve Frame.io metadata before triggering analysis")

            clear_previous_results(supabase, project_id)

            # ── Step 1: Download video ──────────────────────────────
            t1 = time.time()
            update_status(supabase, project_id, "fetching_video", 10,
                          "Downloading video...")
            video_path = download_video(video_url, tmp_dir)
            file_size_mb = os.path.getsize(video_path) / (1024 * 1024)
            elapsed = time.time() - t1
            update_status(supabase, project_id, "fetching_video", 15,
                          f"Video downloaded: {file_size_mb:.1f} MB in {elapsed:.1f}s")

            # ── Step 2: Detect text in video (Video Intelligence) ───
            t2 = time.time()
            update_status(supabase, project_id, "detecting_text", 20,
                          "Sending video to Google Video Intelligence API...")
            raw_detections, raw_payload = detect_text_in_video_with_raw(video_path)
            elapsed = time.time() - t2
            update_status(supabase, project_id, "detecting_text", 30,
                          f"Video Intelligence done: {len(raw_detections)} raw text detections in {elapsed:.1f}s")

            raw_meta = save_ocr_raw_to_storage(project_id, video_url, raw_payload)
            update_project_ocr_raw_metadata(supabase, project_id, raw_meta)

            merged = merge_partial_sequences(raw_detections)
            print(f"  Merged partial sequences: {len(raw_detections)} -> {len(merged)} detections", flush=True)

            # Get video duration for classification
            _ensure_ffmpeg()
            probe = subprocess.run(
                [_FFPROBE_PATH, "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", video_path],
                capture_output=True, text=True,
            )
            video_duration = float(probe.stdout.strip()) if probe.stdout.strip() else 0
            print(f"  Video duration: {video_duration:.1f}s", flush=True)

            classified = classify_subtitle_vs_fixed(merged, video_duration)
            n_subtitles = sum(1 for d in classified if d.get("is_subtitle"))
            n_fixed = sum(1 for d in classified if d.get("is_fixed_text"))
            store_text_detections(supabase, project_id, classified)
            update_status(supabase, project_id, "detecting_text", 40,
                          f"Text classified: {n_subtitles} subtitles, {n_fixed} fixed texts")

            # ── Step 3: Transcribe audio (Gemini) ───────────────────
            t3 = time.time()
            update_status(supabase, project_id, "transcribing_audio", 50,
                          "Extracting audio track with ffmpeg...")
            audio_path = extract_audio(video_path, tmp_dir)
            audio_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
            print(f"  Audio extracted: {audio_size_mb:.1f} MB", flush=True)

            update_status(supabase, project_id, "transcribing_audio", 55,
                          "Sending audio to Gemini for transcription...")
            raw_transcription_segments = transcribe_with_gemini(audio_path)
            transcription_segments = split_transcription_segments(raw_transcription_segments)
            elapsed = time.time() - t3
            store_transcriptions(supabase, project_id, transcription_segments)
            update_status(supabase, project_id, "transcribing_audio", 65,
                          (
                              "Transcription done: "
                              f"{len(raw_transcription_segments)} raw segments -> "
                              f"{len(transcription_segments)} normalized segments in {elapsed:.1f}s"
                          ))

            # ── Step 4: Check spelling (API Ninjas) ─────────────────
            t4 = time.time()
            subtitle_texts = [
                {"text": d["text"], "start_time": d["start_time"]}
                for d in build_filtered_subtitles(classified)
            ]
            update_status(supabase, project_id, "checking_spelling", 70,
                          f"Checking spelling on {len(subtitle_texts)} subtitle segments...")
            spelling_errors = check_spelling(subtitle_texts)
            filtered_errors = filter_false_positives(spelling_errors, classified)
            store_spelling_errors(supabase, project_id, filtered_errors)
            elapsed = time.time() - t4
            update_status(supabase, project_id, "checking_spelling", 80,
                          f"Spelling done: {len(spelling_errors)} raw, {len(filtered_errors)} after filtering in {elapsed:.1f}s")

            # ── Step 5: Detect mismatches ───────────────────────────
            t5 = time.time()
            update_status(supabase, project_id, "detecting_mismatches", 85,
                          "Comparing subtitles against transcription...")
            filtered_subs = build_filtered_subtitles(classified)
            mismatches = detect_mismatches(filtered_subs, transcription_segments)
            store_mismatches(supabase, project_id, mismatches)
            elapsed = time.time() - t5
            update_status(supabase, project_id, "detecting_mismatches", 95,
                          f"Mismatches done: {len(mismatches)} found in {elapsed:.1f}s")

            # ── Done ────────────────────────────────────────────────
            total_elapsed = time.time() - t0
            update_status(supabase, project_id, "completed", 100)
            print(f"analyze_video COMPLETED in {total_elapsed:.1f}s", flush=True)
            print("=" * 60, flush=True)

        return {"status": "completed", "project_id": project_id}, 200

    except Exception as e:
        total_elapsed = time.time() - t0
        print(f"ERROR in analyze_video after {total_elapsed:.1f}s: {e}", flush=True)
        traceback.print_exc()
        try:
            update_status(supabase, project_id, "error", 0)
            supabase.table("projects").update({
                "error_message": str(e)[:500],
            }).eq("id", project_id).execute()
        except Exception as db_err:
            print(f"Failed to update error status in DB: {db_err}", flush=True)
        return {"error": str(e)}, 500
