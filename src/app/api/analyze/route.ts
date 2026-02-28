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

  if (!cloudFunctionUrl || !cloudFunctionSecret) {
    return NextResponse.json(
      { error: "Cloud Function not configured" },
      { status: 500 }
    );
  }

  try {
    let resolvedVideoUrl = project.video_url as string | null;

    // Ensure Cloud Function receives a direct video URL and doesn't need token logic.
    if (!resolvedVideoUrl && project.frame_io_url) {
      const assetId = parseFrameIoUrl(project.frame_io_url);
      if (!assetId) {
        throw new Error("Invalid Frame.io URL");
      }

      const token = await getValidFrameToken();
      const metadata = await resolveFrameIoMetadata(assetId, token);
      resolvedVideoUrl = metadata.video_url;

      if (!resolvedVideoUrl) {
        throw new Error("Frame.io resolved but no downloadable video URL was found");
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
    }

    if (!resolvedVideoUrl) {
      throw new Error("No video URL available");
    }

    // Trigger the Cloud Function with GCP Identity Token for IAM auth
    const identityToken = await getGcpIdentityToken(cloudFunctionUrl);
    const response = await fetch(cloudFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${identityToken}`,
        "X-Function-Secret": cloudFunctionSecret,
      },
      body: JSON.stringify({
        project_id: project.id,
        video_url: resolvedVideoUrl,
        frame_io_url: project.frame_io_url,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cloud Function returned ${response.status}`);
    }

    // Update project status to indicate processing started
    await supabase
      .from("projects")
      .update({ status: "fetching_video", progress: 5 })
      .eq("id", project_id);

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
