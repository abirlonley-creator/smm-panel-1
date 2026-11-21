import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { hashKey } from "@/lib/auth/passkey-service";
import { z } from "zod";

const activateSchema = z.object({
  passkey: z.string().min(1, "Please enter a valid passkey"),
});

export async function POST(request: Request) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = activateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid passkey." },
        { status: 400 }
      );
    }

    const cleanKey = parsed.data.passkey.trim();
    const keyHash = hashKey(cleanKey);

    // Look for matching passkey in database
    const passkeyRecord = await prisma.passkey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!passkeyRecord) {
      return NextResponse.json(
        { success: false, error: "Invalid passkey. Key not found in system." },
        { status: 404 }
      );
    }

    if (passkeyRecord.label === "Account Password") {
      return NextResponse.json(
        { success: false, error: "Cannot use an account password as a VIP activation passkey." },
        { status: 400 }
      );
    }

    if (passkeyRecord.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "This passkey is inactive, revoked, or disabled." },
        { status: 400 }
      );
    }

    if (passkeyRecord.expiresAt && passkeyRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: "This passkey has already expired." },
        { status: 400 }
      );
    }

    // Link the passkey to the current user
    const updated = await prisma.passkey.update({
      where: { id: passkeyRecord.id },
      data: {
        userId: session.user.id,
        lastUsedAt: new Date(),
      },
    });

    // Calculate days remaining if duration exists
    let remainingDays: number | null = null;
    if (updated.expiresAt) {
      const diffMs = updated.expiresAt.getTime() - Date.now();
      remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return NextResponse.json({
      success: true,
      message: `VIP Passkey "${updated.label}" activated successfully! Wholesale 0% markup pricing unlocked on TikTok and Instagram.`,
      label: updated.label,
      expiresAt: updated.expiresAt,
      durationDays: updated.durationDays,
      remainingDays,
      isVip: true,
    });
  } catch (error: any) {
    console.error("[ACTIVATE_PASSKEY_ERROR]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to activate passkey." },
      { status: 500 }
    );
  }
}
