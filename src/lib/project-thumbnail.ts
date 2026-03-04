import { createAdminClient } from "@/lib/supabase/admin";

const THUMBNAIL_BUCKET = "project-thumbnails";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

function isImageContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.toLowerCase().startsWith("image/");
}

export async function persistProjectThumbnail(
  projectId: string,
  sourceUrl: string | null,
): Promise<string | null> {
  if (!sourceUrl) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(sourceUrl, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`thumbnail fetch failed (${response.status})`);
    }

    const contentType = response.headers.get("content-type");
    if (!isImageContentType(contentType)) {
      throw new Error(`unexpected thumbnail content type: ${contentType ?? "unknown"}`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new Error("thumbnail payload is empty");
    }
    if (buffer.byteLength > MAX_BYTES) {
      throw new Error(`thumbnail too large (${buffer.byteLength} bytes)`);
    }

    const admin = createAdminClient();
    const path = `projects/${projectId}/latest.jpg`;

    const { error: uploadError } = await admin.storage
      .from(THUMBNAIL_BUCKET)
      .upload(path, buffer, {
        upsert: true,
        contentType: contentType ?? "image/jpeg",
        cacheControl: "3600",
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = admin.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path);
    return data.publicUrl ?? sourceUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn("[thumbnail] persist failed:", message);
    return sourceUrl;
  }
}
