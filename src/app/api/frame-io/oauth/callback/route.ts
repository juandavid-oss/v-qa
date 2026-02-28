import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  FrameAuthError,
  exchangeCodeForFrameToken,
  upsertFrameToken,
} from "@/lib/frame-io-auth";

const STATE_COOKIE = "frame_oauth_state";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;

  const done = (target: string) => {
    const response = NextResponse.redirect(new URL(target, request.url));
    response.cookies.set(STATE_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  };

  if (oauthError) {
    return done(`/projects?frame_oauth=error&reason=${encodeURIComponent(oauthError)}`);
  }

  if (!state || !expectedState || state !== expectedState) {
    return done("/projects?frame_oauth=error&reason=state_mismatch");
  }

  if (!code) {
    return done("/projects?frame_oauth=error&reason=missing_code");
  }

  try {
    const tokenSet = await exchangeCodeForFrameToken(code);
    await upsertFrameToken(tokenSet);
    return done("/projects?frame_oauth=connected");
  } catch (error) {
    const reason =
      error instanceof FrameAuthError
        ? `oauth_failed:${error.message}`
        : "oauth_failed:unexpected_error";

    return done(`/projects?frame_oauth=error&reason=${encodeURIComponent(reason)}`);
  }
}

