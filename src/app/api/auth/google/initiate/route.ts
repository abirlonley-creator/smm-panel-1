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

  // Determine redirect URI cleanly (prefer explicit GOOGLE_REDIRECT_URI if configured)
  const reqUrl = new URL(request.url);
  const rawHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || reqUrl.host;
  const host = rawHost.split(",")[0].trim();
  const rawProto = request.headers.get("x-forwarded-proto") || reqUrl.protocol.replace(":", "") || "https";
  const proto = rawProto.split(",")[0].trim();
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() || `${proto}://${host}/api/auth/google/callback`;

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
