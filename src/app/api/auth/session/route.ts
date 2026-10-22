import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const session = await getAuthSession(request);

    if (!session.authenticated || !session.user) {
      return NextResponse.json({
        authenticated: false,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: session.user,
      passkey: session.passkey,
      role: session.role,
      label: session.label,
      remainingDays: session.remainingDays,
      remainingHours: session.remainingHours,
      expiresAt: session.passkey?.expiresAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error.message },
      { status: 500 }
    );
  }
}
