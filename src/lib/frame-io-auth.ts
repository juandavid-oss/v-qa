import { createAdminClient } from "@/lib/supabase/admin";

const FRAME_PROVIDER = "frameio_v4";
const TOKEN_ENDPOINT = "https://ims-na1.adobelogin.com/ims/token/v3";
const REFRESH_SKEW_MS = 5 * 60 * 1000;

interface StoredIntegrationToken {
  provider: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
  updated_at: string;
}

export interface OAuthTokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export class FrameAuthError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FrameAuthError";
    this.status = status;
  }
}

export async function getValidFrameToken(): Promise<string> {
  const tokenRow = await getStoredFrameToken();
  if (!tokenRow) {
    throw new FrameAuthError("Frame.io token is not connected. Complete OAuth first.", 401);
  }

  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (Number.isNaN(expiresAt)) {
    throw new FrameAuthError("Stored Frame.io token has invalid expiration", 500);
  }

  if (expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return tokenRow.access_token;
  }

  const refreshed = await refreshFrameToken(tokenRow.refresh_token);
  await upsertFrameToken(refreshed);
  return refreshed.access_token;
}

export async function forceRefreshFrameToken(): Promise<string> {
  const tokenRow = await getStoredFrameToken();
  if (!tokenRow) {
    throw new FrameAuthError("Frame.io token is not connected. Complete OAuth first.", 401);
  }

  const refreshed = await refreshFrameToken(tokenRow.refresh_token);
  await upsertFrameToken(refreshed);
  return refreshed.access_token;
}

export async function exchangeCodeForFrameToken(code: string): Promise<OAuthTokenSet> {
  const clientId = process.env.FRAME_IO_CLIENT_ID;
  const clientSecret = process.env.FRAME_IO_CLIENT_SECRET;
  const redirectUri = process.env.FRAME_IO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new FrameAuthError("Frame.io OAuth env vars are missing", 500);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  return requestOAuthToken(body);
}

export async function refreshFrameToken(refreshToken: string): Promise<OAuthTokenSet> {
  const clientId = process.env.FRAME_IO_CLIENT_ID;
  const clientSecret = process.env.FRAME_IO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new FrameAuthError("Frame.io OAuth env vars are missing", 500);
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  return requestOAuthToken(body);
}

export async function upsertFrameToken(tokenSet: OAuthTokenSet): Promise<void> {
  validateTokenSet(tokenSet);

  const current = await getStoredFrameToken();
  const refreshToken = tokenSet.refresh_token || current?.refresh_token;
  if (!refreshToken) {
    throw new FrameAuthError("OAuth response did not include a refresh token", 502);
  }

  const expiresAt = new Date(Date.now() + tokenSet.expires_in * 1000).toISOString();
  const admin = createAdminClient();
  const { error } = await admin.from("integration_tokens").upsert(
    {
      provider: FRAME_PROVIDER,
      access_token: tokenSet.access_token,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      scope: tokenSet.scope ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" }
  );

  if (error) {
    throw new FrameAuthError(`Failed to persist Frame.io token: ${error.message}`, 500);
  }
}

async function getStoredFrameToken(): Promise<StoredIntegrationToken | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integration_tokens")
    .select("provider, access_token, refresh_token, expires_at, scope, updated_at")
    .eq("provider", FRAME_PROVIDER)
    .maybeSingle();

  if (error) {
    throw new FrameAuthError(`Failed to read stored Frame.io token: ${error.message}`, 500);
  }

  return data as StoredIntegrationToken | null;
}

async function requestOAuthToken(body: URLSearchParams): Promise<OAuthTokenSet> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object") {
    const detail = extractOAuthError(payload) || `HTTP ${response.status}`;
    throw new FrameAuthError(`Frame.io OAuth token request failed: ${detail}`, 502);
  }

  const tokenSet = payload as Partial<OAuthTokenSet>;
  validateTokenSet(tokenSet);

  return {
    access_token: tokenSet.access_token,
    refresh_token: tokenSet.refresh_token ?? "",
    expires_in: tokenSet.expires_in,
    scope: tokenSet.scope,
    token_type: tokenSet.token_type,
  };
}

function extractOAuthError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const error = typeof data.error === "string" ? data.error : null;
  const description =
    typeof data.error_description === "string" ? data.error_description : null;
  if (error && description) return `${error}: ${description}`;
  return error || description;
}

function validateTokenSet(tokenSet: Partial<OAuthTokenSet>): asserts tokenSet is OAuthTokenSet {
  if (!tokenSet.access_token || typeof tokenSet.access_token !== "string") {
    throw new FrameAuthError("OAuth response missing access_token", 502);
  }
  if (typeof tokenSet.expires_in !== "number" || tokenSet.expires_in <= 0) {
    throw new FrameAuthError("OAuth response missing expires_in", 502);
  }
}

