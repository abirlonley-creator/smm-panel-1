import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getAuthSession(request);

    if (!session.authenticated || !session.user) {
      return NextResponse.json({
        authenticated: false,
      });
    }

    // Check if user has an active VIP Passkey granted by admin
    const userPasskeys = await prisma.passkey.findMany({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
        label: { not: "Account Password" },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    const isVip = userPasskeys.length > 0 || session.role === "ADMIN";
    const activePasskey = userPasskeys[0] || session.passkey;

    return NextResponse.json({
      authenticated: true,
      user: session.user,
      passkey: activePasskey,
      role: session.role,
      isVip,
      label: activePasskey?.label || session.user.username,
      remainingDays: session.remainingDays,
      remainingHours: session.remainingHours,
      expiresAt: activePasskey?.expiresAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error.message },
      { status: 500 }
    );
  }
}
