import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseFrameIoUrl, resolveFrameIoMetadata } from "@/lib/frame-io";
import { FrameAuthError, getValidFrameToken } from "@/lib/frame-io-auth";
import { getGcpIdentityToken } from "@/lib/gcp-auth";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { project_id } = await request.json();

  // Verify project ownership
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", project_id)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const cloudFunctionUrl = process.env.CLOUD_FUNCTION_ANALYZE_URL;
  const cloudFunctionSecret = process.env.CLOUD_FUNCTION_SECRET;

  if (!cloudFunctionUrl) {
    return NextResponse.json(
      { error: "Cloud Function URL is not configured" },
      { status: 500 }
    );
  }

  try {
    // Always re-resolve Frame.io URLs — download URLs are signed and expire.
    let resolvedVideoUrl: string | null = null;

    if (project.frame_io_url) {
      const assetId = parseFrameIoUrl(project.frame_io_url);
      if (!assetId) {
        throw new Error("Invalid Frame.io URL");
      }

      const token = await getValidFrameToken();
      const metadata = await resolveFrameIoMetadata(assetId, token);
      resolvedVideoUrl = metadata.video_url;

      if (!resolvedVideoUrl) {
        throw new Error(
          "Frame.io resolved but no downloadable video URL was found. " +
          "The V4 API may not be returning media_links for this asset."
        );
      }

      await supabase
        .from("projects")
        .update({
          frame_io_asset_id: metadata.asset_id,
          video_url: metadata.video_url,
          thumbnail_url: metadata.thumbnail_url,
          duration_seconds: metadata.duration,
          error_message: null,
        })
        .eq("id", project_id);
    } else if (project.video_url) {
      resolvedVideoUrl = project.video_url as string;
    }

    if (!resolvedVideoUrl) {
      throw new Error("No video URL available");
    }

    // Set status BEFORE calling CF — the CF will update status from here on.
    await supabase
      .from("projects")
      .update({ status: "fetching_video", progress: 5, error_message: null })
      .eq("id", project_id);

    // Trigger the Cloud Function with GCP Identity Token for IAM auth.
    // Use a 10s timeout — we only need to confirm the CF accepted the request.
    // The CF runs for minutes; it updates Supabase directly. We don't block.
    const identityToken = await getGcpIdentityToken(cloudFunctionUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(cloudFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${identityToken}`,
          ...(cloudFunctionSecret ? { "X-Function-Secret": cloudFunctionSecret } : {}),
        },
        body: JSON.stringify({
          project_id: project.id,
          video_url: resolvedVideoUrl,
          frame_io_url: project.frame_io_url,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // If CF responded quickly with an error, report it
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const trimmed = errorText.replace(/\s+/g, " ").trim();
        throw new Error(
          `Cloud Function returned ${response.status}${trimmed ? `: ${trimmed.slice(0, 240)}` : ""}`
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      // AbortError = timeout = CF is still processing. This is expected.
      if (error instanceof Error && error.name === "AbortError") {
        console.log("CF request timed out locally — CF continues processing in GCP");
      } else {
        throw error;
      }
    }

    // Don't update status here — the CF manages its own status in Supabase.
    return NextResponse.json({ status: "processing" });
  } catch (error) {
    const message =
      error instanceof FrameAuthError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to start analysis";

    await supabase
      .from("projects")
      .update({ status: "error", error_message: message })
      .eq("id", project_id);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
