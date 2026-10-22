import { NextResponse } from "next/server";
import { verifyPasskey, createSession } from "@/lib/auth/passkey-service";
import { SESSION_COOKIE_NAME, ADMIN_COOKIE_NAME } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { z } from "zod";

const loginSchema = z.object({
  passkey: z.string().min(1, "Passkey is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Passkey is required" },
        { status: 400 }
      );
    }

    const { passkey } = parsed.data;
    const verification = await verifyPasskey(passkey);

    if (!verification.valid || !verification.user) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error || "Invalid, expired, or revoked passkey.",
          isExpired: verification.isExpired || false,
        },
        { status: 401 }
      );
    }

    // Create session in database
    const session = await createSession(
      verification.user.id,
      verification.passkey?.id
    );

    // Set HTTP-only cookie
    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
      path: "/",
    });

    // Also set admin cookie if user has ADMIN role (backward compatibility)
    if (verification.role === "ADMIN") {
      cookieStore.set(ADMIN_COOKIE_NAME, passkey.trim(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
        path: "/",
      });
    }

    return NextResponse.json({
      success: true,
      user: verification.user,
      passkey: verification.passkey,
      role: verification.role,
      remainingDays: verification.remainingDays,
      remainingHours: verification.remainingHours,
      expiresAt: verification.expiresAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Authentication error occurred" },
      { status: 500 }
    );
  }
}
