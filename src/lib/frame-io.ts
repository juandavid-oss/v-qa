const FRAME_IO_V4_API = "https://api.frame.io/v4";

type JsonRecord = Record<string, unknown>;

export interface FrameIoMetadata {
  asset_id: string;
  account_id: string;
  name: string | null;
  duration: number | null;
  thumbnail_url: string | null;
  video_url: string | null;
}

export class FrameIoV4Error extends Error {
  status?: number;
  endpoint: string;
  detail?: string;

  constructor(message: string, endpoint: string, status?: number, detail?: string) {
    super(message);
    this.name = "FrameIoV4Error";
    this.status = status;
    this.endpoint = endpoint;
    this.detail = detail;
  }
}

export function parseFrameIoUrl(url: string): string | null {
  const rawUrl = url.trim();
  if (!rawUrl) return null;

  const parsed = tryParseUrl(rawUrl);
  if (!parsed) return null;

  const host = parsed.hostname.toLowerCase();
  const isFrameHost = host === "frame.io" || host.endsWith(".frame.io") || host === "f.io";

  // Accept both app.frame.io and share host f.io.
  if (!isFrameHost) {
    return null;
  }

  const pathnameParts = parsed.pathname.split("/").filter(Boolean);

  // /player/:assetId
  if (pathnameParts[0] === "player" && pathnameParts[1]) {
    return normalizeAssetId(pathnameParts[1]);
  }

  // /reviews/:reviewId/:assetId and /review/:reviewId/:assetId
  if (
    (pathnameParts[0] === "reviews" || pathnameParts[0] === "review") &&
    pathnameParts[2]
  ) {
    return normalizeAssetId(pathnameParts[2]);
  }

  // /f/:assetId
  if (pathnameParts[0] === "f" && pathnameParts[1]) {
    return normalizeAssetId(pathnameParts[1]);
  }

  // New Frame.io web app format:
  // /project/:projectId/view/:assetId
  if (pathnameParts[0] === "project" && pathnameParts[2] === "view" && pathnameParts[3]) {
    return normalizeAssetId(pathnameParts[3]);
  }

  // Common plural variant.
  // /projects/:projectId/view/:assetId
  if (pathnameParts[0] === "projects" && pathnameParts[2] === "view" && pathnameParts[3]) {
    return normalizeAssetId(pathnameParts[3]);
  }

  // Fallback for links with query params.
  const queryAssetId =
    parsed.searchParams.get("asset_id") ?? parsed.searchParams.get("assetId");
  if (queryAssetId) {
    return normalizeAssetId(queryAssetId);
  }

  return null;
}

export async function resolveFrameIoMetadata(assetId: string, token: string): Promise<FrameIoMetadata> {
  const accountId = await getFrameAccountId(token);
  let fileData: JsonRecord;

  try {
    fileData = await getFileById(accountId, assetId, token);
  } catch (error) {
    if (isFrameResourceLookupError(error)) {
      const versionStack = await getVersionStackById(accountId, assetId, token);
      fileData = await resolveHeadVersionFile(accountId, versionStack, token);
    } else {
      throw error;
    }
  }

  const metadata = extractMetadataFromFileLike(fileData);
  return {
    asset_id: assetId,
    account_id: accountId,
    name: metadata.name,
    duration: metadata.duration,
    thumbnail_url: metadata.thumbnail_url,
    video_url: metadata.video_url,
  };
}

export async function getFrameAccountId(token: string): Promise<string> {
  const payload = await fetchFrameIoV4("/accounts", token);
  const data = payload["data"];

  if (Array.isArray(data) && data.length > 0 && isRecord(data[0])) {
    const accountId = readString(data[0]["id"]);
    if (accountId) return accountId;
  }

  throw new FrameIoV4Error("No account available in Frame.io V4 response", "/accounts");
}

export async function getFileById(accountId: string, fileId: string, token: string): Promise<JsonRecord> {
  const payload = await fetchFrameIoV4(
    `/accounts/${encodeURIComponent(accountId)}/files/${encodeURIComponent(fileId)}?include=media_links`,
    token
  );
  return unwrapObjectData(payload, "file");
}

export async function getVersionStackById(
  accountId: string,
  versionStackId: string,
  token: string
): Promise<JsonRecord> {
  const payload = await fetchFrameIoV4(
    `/accounts/${encodeURIComponent(accountId)}/version_stacks/${encodeURIComponent(versionStackId)}?include=media_links`,
    token
  );
  return unwrapObjectData(payload, "version stack");
}

async function resolveHeadVersionFile(
  accountId: string,
  versionStack: JsonRecord,
  token: string
): Promise<JsonRecord> {
  const headVersion = versionStack["head_version"];
  if (isRecord(headVersion)) {
    return headVersion;
  }

  const headVersionId =
    readString(versionStack["head_version"]) ?? readString(versionStack["head_version_id"]);

  if (!headVersionId) {
    throw new FrameIoV4Error(
      "Version stack does not include head_version information",
      `/accounts/${encodeURIComponent(accountId)}/version_stacks`
    );
  }

  return getFileById(accountId, headVersionId, token);
}

function extractMetadataFromFileLike(fileLike: JsonRecord): {
  name: string | null;
  duration: number | null;
  thumbnail_url: string | null;
  video_url: string | null;
} {
  const mediaLinks = isRecord(fileLike["media_links"]) ? fileLike["media_links"] : null;
  const videoUrl =
    pickMediaLink(mediaLinks, "high_quality") ||
    pickMediaLink(mediaLinks, "original") ||
    pickMediaLink(mediaLinks, "efficient") ||
    readString(fileLike["view_url"]) ||
    null;

  const thumbnailUrl = pickThumbnailLink(mediaLinks) || readString(fileLike["thumbnail_url"]) || null;

  return {
    name: readString(fileLike["name"]) || null,
    duration: pickDuration(fileLike),
    thumbnail_url: thumbnailUrl,
    video_url: videoUrl,
  };
}

function pickDuration(fileLike: JsonRecord): number | null {
  const direct = readNumber(fileLike["duration"]);
  if (direct !== null) return direct;

  const metadata = fileLike["metadata"];
  if (isRecord(metadata)) {
    const nested =
      readNumber(metadata["duration"]) ??
      readNumber(metadata["duration_seconds"]) ??
      readNumber(metadata["durationSeconds"]);
    if (nested !== null) return nested;
  }

  return null;
}

function pickThumbnailLink(mediaLinks: JsonRecord | null): string | null {
  const primary = pickMediaLink(mediaLinks, "thumbnail");
  if (primary) return primary;

  if (!mediaLinks) return null;

  for (const [key, value] of Object.entries(mediaLinks)) {
    const lower = key.toLowerCase();
    if (lower.includes("thumbnail") || lower.includes("thumb") || lower.includes("poster")) {
      const found = mediaLinkToUrl(value);
      if (found) return found;
    }
  }

  return null;
}

function pickMediaLink(mediaLinks: JsonRecord | null, key: string): string | null {
  if (!mediaLinks) return null;
  return mediaLinkToUrl(mediaLinks[key]);
}

function mediaLinkToUrl(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (!isRecord(value)) return null;

  const href = readString(value["href"]);
  if (href) return href;

  const download = readString(value["download"]);
  if (download) return download;

  const url = readString(value["url"]);
  if (url) return url;

  return null;
}

function isFrameResourceLookupError(error: unknown): boolean {
  return (
    error instanceof FrameIoV4Error &&
    (error.status === 404 || error.status === 422)
  );
}

async function fetchFrameIoV4(path: string, token: string): Promise<JsonRecord> {
  const response = await fetch(`${FRAME_IO_V4_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new FrameIoV4Error(
      `Frame.io V4 request failed (${response.status})`,
      path,
      response.status,
      extractErrorDetail(payload)
    );
  }

  if (!isRecord(payload)) {
    throw new FrameIoV4Error("Frame.io V4 returned a non-object payload", path, response.status);
  }

  return payload;
}

function extractErrorDetail(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;

  const errors = payload["errors"];
  if (Array.isArray(errors) && errors.length > 0 && isRecord(errors[0])) {
    return readString(errors[0]["detail"]) || readString(errors[0]["title"]) || undefined;
  }

  return readString(payload["message"]) || undefined;
}

function unwrapObjectData(payload: JsonRecord, resourceLabel: string): JsonRecord {
  const data = payload["data"];
  if (isRecord(data)) return data;
  if (data === undefined) return payload;

  throw new FrameIoV4Error(
    `Frame.io V4 returned invalid ${resourceLabel} payload`,
    `unwrap:${resourceLabel}`
  );
}

function tryParseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    try {
      return new URL(`https://${rawUrl}`);
    } catch {
      return null;
    }
  }
}

function normalizeAssetId(value: string): string | null {
  const cleaned = decodeURIComponent(value.trim());
  return /^[A-Za-z0-9_-]+$/.test(cleaned) ? cleaned : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
