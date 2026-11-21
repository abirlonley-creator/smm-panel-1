import { NextResponse } from "next/server";
import { verifyPasskey, createSession, hashKey } from "@/lib/auth/passkey-service";
import { SESSION_COOKIE_NAME, ADMIN_COOKIE_NAME } from "@/lib/auth/session";
import { getMaintenanceState } from "@/lib/maintenance/maintenance-service";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  passkey: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Please enter your username and password, or passkey." },
        { status: 400 }
      );
    }

    const { username, password, passkey } = parsed.data;

    // Check if Under Update / Maintenance mode is active
    const maintenance = await getMaintenanceState();

    // 1. Direct Passkey Login (Admin passkey like 'abir90' or raw passkey)
    if (passkey && passkey.trim()) {
      const cleanKey = passkey.trim();
      const verification = await verifyPasskey(cleanKey);

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

      if (maintenance.enabled && verification.role !== "ADMIN") {
        return NextResponse.json(
          {
            success: false,
            underMaintenance: true,
            error: "Currently we're updating the website. Please hold on for a moment while admin updates the website.",
          },
          { status: 503 }
        );
      }

      const session = await createSession(
        verification.user.id,
        verification.passkey?.id
      );

      const cookieStore = cookies();
      cookieStore.set(SESSION_COOKIE_NAME, session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
        path: "/",
      });

      if (verification.role === "ADMIN") {
        cookieStore.set(ADMIN_COOKIE_NAME, cleanKey, {
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
    }

    // 2. Standard Username + Password Login
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required." },
        { status: 400 }
      );
    }

    const cleanUsername = username.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { username: cleanUsername },
      include: {
        passkeys: {
          where: { status: "ACTIVE" },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // Match password hash against user's stored account credentials or passkeys
    const pwdHash = hashKey(password);
    const matchingKey = user.passkeys.find((pk) => pk.keyHash === pwdHash);

    if (!matchingKey) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password." },
        { status: 401 }
      );
    }

    if (maintenance.enabled && user.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          underMaintenance: true,
          error: "Currently we're updating the website. Please hold on for a moment while admin updates the website.",
        },
        { status: 503 }
      );
    }

    const session = await createSession(user.id, matchingKey.id);

    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
      path: "/",
    });

    if (user.role === "ADMIN") {
      cookieStore.set(ADMIN_COOKIE_NAME, password, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
        path: "/",
      });
    }

    // Check if user has VIP status from an admin passkey
    const hasVipPasskey = user.passkeys.some(
      (pk) =>
        pk.label !== "Account Password" &&
        (!pk.expiresAt || pk.expiresAt > new Date())
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        walletBalance: user.walletBalance,
      },
      isVip: hasVipPasskey || user.role === "ADMIN",
      role: user.role,
    });
  } catch (error: any) {
    console.error("[LOGIN_ERROR]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Authentication error occurred" },
      { status: 500 }
    );
  }
}
