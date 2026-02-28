import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FrameIoV4Error, parseFrameIoUrl, resolveFrameIoMetadata } from "@/lib/frame-io";
import { FrameAuthError, getValidFrameToken } from "@/lib/frame-io-auth";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await request.json();

  const assetId = parseFrameIoUrl(url);
  if (!assetId) {
    return NextResponse.json({ error: "Invalid Frame.io URL" }, { status: 400 });
  }

  try {
    const token = await getValidFrameToken();
    const metadata = await resolveFrameIoMetadata(assetId, token);

    if (!metadata.video_url) {
      return NextResponse.json(
        { error: "Frame.io resource resolved but no downloadable video URL was found" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      asset_id: assetId,
      name: metadata.name,
      duration: metadata.duration,
      thumbnail_url: metadata.thumbnail_url,
      video_url: metadata.video_url,
    });
  } catch (error) {
    if (error instanceof FrameAuthError) {
      const status = error.status ?? 502;
      return NextResponse.json({ error: error.message }, { status });
    }

    if (error instanceof FrameIoV4Error) {
      if (error.endpoint === "/accounts") {
        return NextResponse.json(
          { error: "Frame.io V4 auth/account lookup failed" },
          { status: 502 }
        );
      }

      if (error.status === 401 || error.status === 403) {
        return NextResponse.json(
          { error: "Frame.io V4 authorization failed for this resource" },
          { status: 502 }
        );
      }

      if (error.status === 404 || error.status === 422) {
        return NextResponse.json(
          { error: "Frame.io resource not found as file/version stack in this account" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: `Frame.io V4 request failed at ${error.endpoint}${
            error.detail ? `: ${error.detail}` : ""
          }`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: "Failed to fetch asset from Frame.io V4" }, { status: 502 });
  }
}
