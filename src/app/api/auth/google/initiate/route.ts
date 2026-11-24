import { NextResponse } from "next/server";
import { generatePKCE, generateStateAndNonce, getGoogleOAuthUrl } from "@/lib/auth/google";
import { redis } from "@/lib/security/redis";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { success: false, error: "Google OAuth is not configured on this server." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get("returnTo") || "/dashboard";

  const { codeVerifier, codeChallenge } = generatePKCE();
  const { state, nonce } = generateStateAndNonce();

  // Determine redirect URI dynamically based on current origin
  const reqUrl = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || reqUrl.host;
  const proto = request.headers.get("x-forwarded-proto") || (reqUrl.protocol.replace(":", "") || "https");
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  // Store state and PKCE verifier in Redis with 10-minute expiry
  await redis.set(
    `aurasmm:oauth:${state}`,
    JSON.stringify({
      state,
      nonce,
      codeVerifier,
      redirectUri,
      returnTo,
      createdAt: Date.now(),
    }),
    { ex: 600 }
  );

  // Set companion HttpOnly cookie
  const cookieStore = cookies();
  cookieStore.set("smm_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const authUrl = getGoogleOAuthUrl({
    clientId,
    redirectUri,
    state,
    nonce,
    codeChallenge,
  });

  return NextResponse.redirect(authUrl);
}
