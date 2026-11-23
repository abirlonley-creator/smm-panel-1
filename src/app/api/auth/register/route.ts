import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashUserPassword, createSession } from "@/lib/auth/passkey-service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { z } from "zod";

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be under 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const errorMsg = parsed.error.issues?.[0]?.message || "Invalid registration data";
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }

    const cleanUsername = parsed.data.username.toLowerCase().trim();
    const { password } = parsed.data;

    // Check if username is already taken (case-insensitive)
    const existing = await prisma.user.findFirst({
      where: {
        username: { equals: cleanUsername, mode: "insensitive" },
      },
      include: { passkeys: true },
    });

    if (existing) {
      if (existing.passkeys && existing.passkeys.length > 0) {
        return NextResponse.json(
          { success: false, error: "This username is already taken. Please choose another or sign in." },
          { status: 409 }
        );
      }
      // Clean up orphaned user record and its relations from prior aborted attempt
      await prisma.session.deleteMany({ where: { userId: existing.id } }).catch(() => {});
      await prisma.userProviderConnection.deleteMany({ where: { userId: existing.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: existing.id } }).catch(() => {});
    }

    // Hash user password with username salt to ensure global uniqueness on Passkey.keyHash
    const keyHash = hashUserPassword(cleanUsername, password);

    // Check if credentials already exist
    const existingPasskey = await prisma.passkey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (existingPasskey) {
      if (existingPasskey.user) {
        return NextResponse.json(
          { success: false, error: "An account with these credentials already exists. Please sign in." },
          { status: 409 }
        );
      }
      // Clean up orphaned passkey record
      await prisma.session.deleteMany({ where: { passkeyId: existingPasskey.id } }).catch(() => {});
      await prisma.passkey.delete({ where: { id: existingPasskey.id } }).catch(() => {});
    }

    // Atomically create User, Provider Connection, and Passkey
    const { user, passkeyRecord } = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: cleanUsername,
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
          label: "Account Password",
          keyPrefix: `usr_${cleanUsername.slice(0, 4)}`,
          keyHash,
          role: "USER",
          status: "ACTIVE",
          expiresAt: null, // User login credentials do not expire
        },
      });

      return { user: newUser, passkeyRecord: newPasskey };
    });

    // Create session and set HTTP-only cookie for immediate login
    const session = await createSession(user.id, passkeyRecord.id);

    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
      path: "/",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        walletBalance: user.walletBalance,
      },
      message: "Account created successfully! Welcome to AuraSMM.",
    });
  } catch (error: any) {
    console.error("[REGISTER_ERROR]", error);
    const isUniqueCollision =
      error?.code === "P2002" ||
      String(error?.message || "").includes("Unique constraint failed") ||
      String(error?.message || "").includes("keyHash");

    if (isUniqueCollision) {
      return NextResponse.json(
        { success: false, error: "Username or credentials already exist. Please try signing in or use another username." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to create account. Please try again or use another username." },
      { status: 500 }
    );
  }
}
