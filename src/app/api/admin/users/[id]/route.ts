import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchUserSchema = z.object({
  username: z.string().min(2).max(40).optional(),
  name: z.string().min(2).max(60).optional(),
  status: z.enum(["ACTIVE", "DISABLED", "REVOKED", "EXPIRED"]).optional(),
  walletBalance: z.number().min(0).optional(),
  adjustmentNote: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = params.id;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        passkeys: {
          orderBy: { createdAt: "desc" },
        },
        orders: {
          include: {
            service: { select: { name: true, platform: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        engagementOrders: {
          orderBy: { createdAt: "desc" },
        },
        walletTransactions: {
          orderBy: { createdAt: "desc" },
        },
        deposits: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const primaryPasskey = user.passkeys[0];
    const displayName = primaryPasskey?.label?.trim() || user.username;

    // Consolidate standard and engagement orders
    const standardOrders = user.orders.map((o) => ({
      id: o.id,
      orderRef: o.orderRef,
      type: "STANDARD" as const,
      serviceName: o.service?.name || "Direct SMM Service",
      platform: o.service?.platform || "General",
      targetUrl: o.targetUrl,
      requestedQuantity: o.requestedQuantity,
      deliveredQuantity: o.deliveredQuantity,
      totalCost: o.totalCost,
      refundedAmount: o.refundedAmount,
      isRefunded: o.refundedAmount > 0 || o.status === "REFUNDED",
      status: o.status,
      isScheduled: o.isScheduled,
      scheduleMode: o.scheduleMode,
      providerOrderId: o.providerOrderId,
      createdAt: o.createdAt,
    }));

    const engagementOrders = user.engagementOrders.map((eo) => ({
      id: eo.id,
      orderRef: eo.orderRef,
      type: "ENGAGEMENT" as const,
      serviceName: `TikTok Organic S-Curve (${eo.baseViews.toLocaleString()} Views)`,
      platform: eo.platform || "TikTok",
      targetUrl: eo.targetUrl,
      requestedQuantity: eo.baseViews,
      deliveredQuantity: eo.deliveredViews,
      totalCost: eo.totalCost,
      refundedAmount: eo.refundedAmount,
      isRefunded: eo.refundedAmount > 0 || eo.status === "CANCELLED",
      status: eo.status,
      isScheduled: true,
      scheduleMode: "ORGANIC_ENGAGEMENT",
      providerOrderId: null,
      createdAt: eo.createdAt,
    }));

    const allOrders = [...standardOrders, ...engagementOrders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: displayName,
        role: user.role,
        status: user.status,
        walletBalance: user.walletBalance,
        createdAt: user.createdAt,
        passkeys: user.passkeys,
      },
      orders: allOrders,
      transactions: user.walletTransactions,
      deposits: user.deposits,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load user profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = params.id;
  try {
    const body = await request.json();
    const parsed = patchUserSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    });

    if (!existingUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const updates: any = {};

    // 1. Username update
    if (parsed.username && parsed.username.trim() !== existingUser.username) {
      const cleanUsername = parsed.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const conflict = await prisma.user.findUnique({
        where: { username: cleanUsername },
      });
      if (conflict && conflict.id !== userId) {
        return NextResponse.json(
          { success: false, error: `Username @${cleanUsername} is already taken.` },
          { status: 400 }
        );
      }
      updates.username = cleanUsername;
    }

    // 2. Status update
    if (parsed.status) {
      updates.status = parsed.status;
    }

    // 3. Balance adjustment with audit transaction record
    if (typeof parsed.walletBalance === "number" && parsed.walletBalance !== existingUser.walletBalance) {
      const diff = parsed.walletBalance - existingUser.walletBalance;
      updates.walletBalance = parsed.walletBalance;

      await prisma.walletTransaction.create({
        data: {
          userId,
          type: diff >= 0 ? "CREDIT" : "DEBIT",
          amount: Math.abs(diff),
          balanceAfter: parsed.walletBalance,
          referenceId: `ADMIN-ADJ-${Date.now().toString(36).toUpperCase()}`,
          description: parsed.adjustmentNote || `Admin manual balance adjustment by ${session.label || "Admin"}`,
        },
      });
    }

    // Apply User updates
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates,
    });

    // 4. Update Name in Passkey if provided
    if (parsed.name && parsed.name.trim()) {
      if (existingUser.passkeys.length > 0) {
        await prisma.passkey.update({
          where: { id: existingUser.passkeys[0].id },
          data: { label: parsed.name.trim() },
        });
      }
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: "User profile updated successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update user" },
      { status: 400 }
    );
  }
}
