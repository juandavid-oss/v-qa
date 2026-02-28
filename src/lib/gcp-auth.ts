import { importPKCS8, SignJWT } from "jose";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getGcpIdentityToken(targetAudience: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const keyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error("GCP_SERVICE_ACCOUNT_KEY env var is missing");
  }

  const key: ServiceAccountKey = JSON.parse(keyJson);
  const privateKey = await importPKCS8(key.private_key, "RS256");

  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    target_audience: targetAudience,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(key.client_email)
    .setSubject(key.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.id_token) {
    throw new Error(
      `Failed to get GCP identity token: ${payload.error_description || payload.error || response.status}`
    );
  }

  cachedToken = {
    token: payload.id_token,
    expiresAt: Date.now() + 3500_000,
  };

  return payload.id_token;
}
