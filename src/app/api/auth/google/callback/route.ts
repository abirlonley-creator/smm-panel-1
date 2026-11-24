import { NextResponse } from "next/server";
import { exchangeGoogleCode, verifyGoogleIdToken } from "@/lib/auth/google";
import { redis } from "@/lib/security/redis";
import { prisma } from "@/lib/prisma";
import { createSession, generateUniqueUsername } from "@/lib/auth/passkey-service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { sendTelegramSecurityAlert } from "@/lib/security/telegram";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const code = reqUrl.searchParams.get("code");
  const state = reqUrl.searchParams.get("state");
  const error = reqUrl.searchParams.get("error");

  const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;

  if (error || !code || !state) {
    const errorMsg = error ? `Google login failed: ${error}` : "Missing OAuth authorization code or state.";
    return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  // Retrieve state and PKCE verifier from Redis
  const oauthKey = `aurasmm:oauth:${state}`;
  const rawData = await redis.get<string>(oauthKey);

  if (!rawData) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent("Login session expired or state mismatch. Please try again.")}`
    );
  }

  // Consume state immediately (one-time use to prevent replay attacks)
  await redis.del(oauthKey);

  const stored = typeof rawData === "string" ? JSON.parse(rawData) : rawData;

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent("Google OAuth credentials are not configured on the server.")}`
    );
  }

  try {
    // Exchange authorization code with PKCE
    const tokens = await exchangeGoogleCode({
      code,
      clientId,
      clientSecret,
      redirectUri: stored.redirectUri,
      codeVerifier: stored.codeVerifier,
    });

    // Verify ID Token signature, issuer, audience, and nonce
    const googleUser = await verifyGoogleIdToken(tokens.id_token, clientId, stored.nonce);

    // Look for existing user by Google sub passkey or verified email
    const googleKeyHash = crypto
      .createHash("sha256")
      .update(`google_sub:${googleUser.sub}`)
      .digest("hex");

    let existingPasskey = await prisma.passkey.findUnique({
      where: { keyHash: googleKeyHash },
      include: { user: true },
    });

    let user = existingPasskey?.user;

    if (!user) {
      // Find user with matching username or create new user
      const suggestedName = googleUser.name || googleUser.email.split("@")[0];
      const username = await generateUniqueUsername(suggestedName);

      const created = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            username,
            role: "USER",
            status: "ACTIVE",
            walletBalance: 0.0,
          },
        });

        await tx.userProviderConnection.create({
          data: {
            userId: newUser.id,
            name: "Primary Delivery Engine",
            apiUrl: "https://api.internal/v2",
            isMock: true,
            active: true,
            currency: "INR",
          },
        });

        const newPasskey = await tx.passkey.create({
          data: {
            userId: newUser.id,
            label: "Google Account Sign-In",
            keyPrefix: "goog",
            keyHash: googleKeyHash,
            role: "USER",
            status: "ACTIVE",
          },
        });

        return { user: newUser, passkey: newPasskey };
      });

      user = created.user;
      existingPasskey = { ...created.passkey, user: created.user };

      // Out-of-band notification
      sendTelegramSecurityAlert({
        title: "New User Registered via Google OAuth",
        details: `User: ${username} (${googleUser.email}) registered successfully.`,
        severity: "INFO",
        ip: request.headers.get("x-forwarded-for") || undefined,
      }).catch(() => {});
    }

    // Create session
    const session = await createSession(user.id, existingPasskey?.id);

    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
      path: "/",
    });

    const destination = stored.returnTo && stored.returnTo.startsWith("/") ? stored.returnTo : "/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  } catch (err: any) {
    console.error("[Google OAuth Callback Error]:", err);
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent("Google Sign-In failed: " + (err.message || "Unknown error"))}`
    );
  }
}
