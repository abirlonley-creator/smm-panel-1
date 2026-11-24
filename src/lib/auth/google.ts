import crypto from "crypto";

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture?: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token: string;
  refresh_token?: string;
}

export function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function generateStateAndNonce() {
  const state = crypto.randomBytes(24).toString("hex");
  const nonce = crypto.randomBytes(24).toString("hex");
  return { state, nonce };
}

export function getGoogleOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
    code_verifier: params.codeVerifier,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Validates Google ID Token claims (issuer, audience, expiry, nonce, email_verified).
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedClientId: string,
  expectedNonce?: string
): Promise<{
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
}> {
  // Use Google's tokeninfo endpoint to verify Google's signature and claims
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) {
    throw new Error("Invalid Google ID token signature");
  }

  const claims = await res.json();

  if (claims.aud !== expectedClientId) {
    throw new Error(`Google ID token audience mismatch: expected ${expectedClientId}, got ${claims.aud}`);
  }

  const validIssuers = ["https://accounts.google.com", "accounts.google.com"];
  if (!validIssuers.includes(claims.iss)) {
    throw new Error(`Google ID token issuer mismatch: ${claims.iss}`);
  }

  if (claims.email_verified !== "true" && claims.email_verified !== true) {
    throw new Error("Google email is not verified by Google");
  }

  return {
    sub: claims.sub,
    email: claims.email,
    email_verified: true,
    name: claims.name || claims.email.split("@")[0],
    picture: claims.picture,
  };
}
