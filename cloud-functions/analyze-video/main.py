import os
import re
import uuid
import subprocess
import tempfile
from difflib import SequenceMatcher
from urllib.parse import urlparse, parse_qs

import functions_framework
import requests
from google.cloud import videointelligence_v1 as vi
import google.generativeai as genai
from supabase import create_client

# --- Configuration ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
LANGUAGETOOL_URL = os.environ.get("LANGUAGETOOL_URL", "https://api.languagetool.org/v2/check")
CLOUD_FUNCTION_SECRET = os.environ.get("CLOUD_FUNCTION_SECRET")
FRAME_IO_TOKEN = os.environ.get("FRAME_IO_TOKEN") or os.environ.get("FRAME_IO_V4_TOKEN")
FRAME_IO_V4_API = "https://api.frame.io/v4"


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
    payload = frame_v4_get(
        f"/accounts/{account_id}/files/{file_id}?include=media_links",
        token,
    )
    return unwrap_data_object(payload, "file")


def get_version_stack_by_id(account_id: str, version_stack_id: str, token: str) -> dict:
    payload = frame_v4_get(
        f"/accounts/{account_id}/version_stacks/{version_stack_id}?include=media_links",
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
        media_link_to_url(media_links.get("high_quality"))
        or media_link_to_url(media_links.get("original"))
        or media_link_to_url(media_links.get("efficient"))
        or read_string(file_data.get("view_url"))
    )

    thumbnail_url = media_link_to_url(media_links.get("thumbnail")) or find_thumbnail_link(media_links)
    if not thumbnail_url:
        thumbnail_url = read_string(file_data.get("thumbnail_url"))

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


def media_link_to_url(value) -> str | None:
    if isinstance(value, str) and value:
        return value
    if isinstance(value, dict):
        for key in ("href", "download", "url"):
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


def update_status(supabase, project_id: str, status: str, progress: int):
    supabase.table("projects").update({
        "status": status,
        "progress": progress,
    }).eq("id", project_id).execute()


def clear_previous_results(supabase, project_id: str):
    """Delete previous analysis artifacts so reruns do not duplicate rows."""
    for table_name in ("text_detections", "transcriptions", "spelling_errors", "mismatches"):
        supabase.table(table_name).delete().eq("project_id", project_id).execute()


# --- 1. Video Download ---
def download_video(video_url: str, tmp_dir: str) -> str:
    video_path = os.path.join(tmp_dir, "video.mp4")
    response = requests.get(video_url, stream=True, timeout=600)
    response.raise_for_status()
    with open(video_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
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
def classify_subtitle_vs_fixed(detections: list[dict], video_duration: float) -> list[dict]:
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
        same_text_same_pos = sum(
            1 for d in detections
            if d["text"] == det["text"]
            and d is not det
            and bbox_overlap(d["bbox"], det["bbox"]) > 0.9
        )
        if same_text_same_pos > 3:
            score_fixed += 3

        det["is_subtitle"] = score_subtitle > score_fixed
        det["is_fixed_text"] = score_fixed > score_subtitle

    return detections


# --- 5. Audio Transcription (Gemini) ---
def extract_audio(video_path: str, tmp_dir: str) -> str:
    audio_path = os.path.join(tmp_dir, "audio.wav")
    subprocess.run(
        ["ffmpeg", "-i", video_path, "-vn", "-acodec", "pcm_s16le",
         "-ar", "16000", "-ac", "1", audio_path, "-y"],
        check=True, capture_output=True,
    )
    return audio_path


def transcribe_with_gemini(audio_path: str) -> list[dict]:
    """Transcribe audio using Gemini."""
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.0-flash")

    audio_file = genai.upload_file(audio_path, mime_type="audio/wav")

    prompt = """Transcribe this audio precisely. Return the transcription as a JSON array where each element has:
- "text": the transcribed text for that segment
- "start_time": start time in seconds
- "end_time": end time in seconds
- "speaker": speaker label (e.g., "Speaker 1")

Return ONLY valid JSON, no markdown or other text."""

    response = model.generate_content([prompt, audio_file])
    text = response.text.strip()

    # Clean potential markdown wrapping
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0]

    import json
    segments = json.loads(text)
    return segments


# --- 6. Spelling & Grammar Check (LanguageTool) ---
def check_spelling(texts: list[dict]) -> list[dict]:
    """Check spelling/grammar using LanguageTool API."""
    errors = []

    for item in texts:
        text = item["text"]
        timestamp = item.get("start_time", 0)

        response = requests.post(
            LANGUAGETOOL_URL,
            data={"text": text, "language": "auto"},
            timeout=30,
        )
        if response.status_code != 200:
            continue

        result = response.json()
        for match in result.get("matches", []):
            replacements = match.get("replacements", [])
            if not replacements:
                continue

            original = text[match["offset"]:match["offset"] + match["length"]]
            suggested = replacements[0]["value"]

            # Build context
            start = max(0, match["offset"] - 20)
            end = min(len(text), match["offset"] + match["length"] + 20)
            context = text[start:end]

            errors.append({
                "original_text": original,
                "suggested_text": suggested,
                "context": context,
                "timestamp": timestamp,
                "rule_id": match.get("rule", {}).get("id", ""),
                "source": "subtitle",
            })

    return errors


def filter_false_positives(errors: list[dict], detections: list[dict]) -> list[dict]:
    """Filter out spelling errors that are brand names or partial sequences."""
    brand_names = {
        d["text"].lower() for d in detections if d.get("is_fixed_text")
    }

    filtered = []
    for error in errors:
        original_lower = error["original_text"].lower()

        # Skip if it's a brand name
        if original_lower in brand_names:
            continue

        # Skip common false positives for proper nouns
        if error.get("rule_id") == "MORFOLOGIK_RULE_EN_US" and error["original_text"][0].isupper():
            continue

        filtered.append(error)

    return filtered


# --- 7. Mismatch Detection ---
def detect_mismatches(subtitles: list[dict], transcriptions: list[dict]) -> list[dict]:
    """Compare subtitles against audio transcription to find mismatches."""
    mismatches = []

    for sub in subtitles:
        if not sub.get("is_subtitle"):
            continue

        # Find overlapping transcription segments
        overlapping = [
            t for t in transcriptions
            if t["start_time"] < sub["end_time"] and t["end_time"] > sub["start_time"]
        ]

        if not overlapping:
            mismatches.append({
                "subtitle_text": sub["text"],
                "transcription_text": "[no audio detected]",
                "start_time": sub["start_time"],
                "end_time": sub["end_time"],
                "severity": "high",
                "mismatch_type": "missing_audio",
            })
            continue

        combined_transcript = " ".join(t["text"] for t in overlapping)

        ratio = SequenceMatcher(
            None,
            sub["text"].lower().strip(),
            combined_transcript.lower().strip(),
        ).ratio()

        if ratio < 0.85:
            severity = "high" if ratio < 0.5 else "medium" if ratio < 0.75 else "low"
            mismatches.append({
                "subtitle_text": sub["text"],
                "transcription_text": combined_transcript,
                "start_time": sub["start_time"],
                "end_time": sub["end_time"],
                "severity": severity,
                "mismatch_type": _classify_mismatch(sub["text"], combined_transcript),
            })

    return mismatches


def _classify_mismatch(subtitle: str, transcript: str) -> str:
    sub_words = set(subtitle.lower().split())
    trans_words = set(transcript.lower().split())

    missing = sub_words - trans_words
    extra = trans_words - sub_words

    if missing and not extra:
        return "missing_word"
    elif extra and not missing:
        return "extra_word"
    else:
        return "different_word"


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


# --- Main Cloud Function Entry Point ---
@functions_framework.http
def analyze_video(request):
    """HTTP Cloud Function: orchestrates the full video analysis pipeline."""
    # Verify app-level secret (GCP IAM already validated the Identity Token in Authorization header)
    secret_header = request.headers.get("X-Function-Secret", "")
    if secret_header != CLOUD_FUNCTION_SECRET:
        return {"error": "Unauthorized"}, 403

    data = request.get_json(silent=True)
    if not data:
        return {"error": "Missing request body"}, 400

    project_id = data.get("project_id")
    video_url = data.get("video_url")
    frame_io_url = data.get("frame_io_url")

    if not project_id:
        return {"error": "Missing project_id"}, 400

    supabase = get_supabase()

    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            if not video_url:
                raise ValueError("No video URL available; resolve Frame.io metadata before triggering analysis")

            clear_previous_results(supabase, project_id)

            # Step 1: Download video
            update_status(supabase, project_id, "fetching_video", 10)
            video_path = download_video(video_url, tmp_dir)

            # Step 2: Detect text in video
            update_status(supabase, project_id, "detecting_text", 20)
            raw_detections = detect_text_in_video(video_path)
            merged = merge_partial_sequences(raw_detections)

            # Get video duration for classification
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", video_path],
                capture_output=True, text=True,
            )
            video_duration = float(probe.stdout.strip()) if probe.stdout.strip() else 0

            classified = classify_subtitle_vs_fixed(merged, video_duration)
            store_text_detections(supabase, project_id, classified)
            update_status(supabase, project_id, "detecting_text", 40)

            # Step 3: Transcribe audio
            update_status(supabase, project_id, "transcribing_audio", 50)
            audio_path = extract_audio(video_path, tmp_dir)
            transcription_segments = transcribe_with_gemini(audio_path)
            store_transcriptions(supabase, project_id, transcription_segments)
            update_status(supabase, project_id, "transcribing_audio", 65)

            # Step 4: Check spelling
            update_status(supabase, project_id, "checking_spelling", 70)
            subtitle_texts = [
                {"text": d["text"], "start_time": d["start_time"]}
                for d in classified
                if d.get("is_subtitle") and not d.get("is_partial_sequence")
            ]
            spelling_errors = check_spelling(subtitle_texts)
            filtered_errors = filter_false_positives(spelling_errors, classified)
            store_spelling_errors(supabase, project_id, filtered_errors)
            update_status(supabase, project_id, "checking_spelling", 80)

            # Step 5: Detect mismatches
            update_status(supabase, project_id, "detecting_mismatches", 85)
            mismatches = detect_mismatches(classified, transcription_segments)
            store_mismatches(supabase, project_id, mismatches)

            # Done
            update_status(supabase, project_id, "completed", 100)

        return {"status": "completed", "project_id": project_id}, 200

    except Exception as e:
        update_status(supabase, project_id, "error", 0)
        supabase.table("projects").update({
            "error_message": str(e)[:500],
        }).eq("id", project_id).execute()
        return {"error": str(e)}, 500
