import { NextResponse } from "next/server";
import { verifyAdminCredential } from "@/lib/auth/keys";
import { verifyPasskey, createSession } from "@/lib/auth/passkey-service";
import { ADMIN_COOKIE_NAME, getAdminSession } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { z } from "zod";

const loginSchema = z.object({
  key: z.string().min(1, "Access key is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Access key is required" },
        { status: 400 }
      );
    }

    const { key } = parsed.data;
    const verification = await verifyAdminCredential(key);

    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: "Invalid, expired, or revoked access key." },
        { status: 401 }
      );
    }

    // Set HTTP-only cookie
    const cookieStore = cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, key.trim(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    try {
      const passkeyRes = await verifyPasskey(key);
      if (passkeyRes.valid && passkeyRes.user) {
        const session = await createSession(passkeyRes.user.id, passkeyRes.passkey?.id);
        cookieStore.set("smm_session_token", session.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
          path: "/",
        });
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      role: verification.role,
      label: verification.label,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Authentication error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  return NextResponse.json({
    authenticated: session.authenticated,
    role: session.role || null,
    label: session.label || null,
  });
}

export async function DELETE() {
  const cookieStore = cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  return NextResponse.json({ success: true, message: "Logged out successfully" });
}
