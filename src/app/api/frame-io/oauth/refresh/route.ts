import { NextResponse } from "next/server";
import { FrameAuthError, forceRefreshFrameToken } from "@/lib/frame-io-auth";

export async function POST(request: Request) {
  const expectedSecret = process.env.FRAME_IO_INTERNAL_SHARED_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "FRAME_IO_INTERNAL_SHARED_SECRET is not configured" },
      { status: 500 }
    );
  }

  const providedSecret = request.headers.get("x-frame-internal-secret");
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessToken = await forceRefreshFrameToken();
    return NextResponse.json({
      status: "ok",
      access_token_prefix: accessToken.slice(0, 12),
    });
  } catch (error) {
    const message = error instanceof FrameAuthError ? error.message : "Failed to refresh token";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

