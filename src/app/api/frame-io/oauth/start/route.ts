import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STATE_COOKIE = "frame_oauth_state";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.FRAME_IO_CLIENT_ID;
  const redirectUri = process.env.FRAME_IO_REDIRECT_URI;
  const scopes = process.env.FRAME_IO_SCOPES || "openid,profile,offline_access";

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Frame.io OAuth is not configured" },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();
  const url = new URL("https://ims-na1.adobelogin.com/ims/authorize/v2");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}

