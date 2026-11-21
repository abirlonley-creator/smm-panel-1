import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashKey, createSession } from "@/lib/auth/passkey-service";
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

    // Check if username is already taken
    const existing = await prisma.user.findUnique({
      where: { username: cleanUsername },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "This username is already taken. Please choose another." },
        { status: 409 }
      );
    }

    // Create the User
    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        role: "USER",
        status: "ACTIVE",
        walletBalance: 0.0,
      },
    });

    // Create default provider connection for user
    await prisma.userProviderConnection.create({
      data: {
        userId: user.id,
        name: "Standard SMM Provider",
        apiUrl: "https://api.smmprovider.com/v2",
        isMock: true,
        active: true,
        currency: "INR",
      },
    });

    // Store user's password as their initial account passkey
    const keyHash = hashKey(password);
    const passkeyRecord = await prisma.passkey.create({
      data: {
        userId: user.id,
        label: "Account Password",
        keyPrefix: `usr_${cleanUsername.slice(0, 4)}`,
        keyHash,
        role: "USER",
        status: "ACTIVE",
        expiresAt: null, // User login credentials do not expire
      },
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
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create account" },
      { status: 500 }
    );
  }
}
