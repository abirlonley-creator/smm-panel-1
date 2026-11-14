import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const filter = url.searchParams.get("filter") || "ALL";

    // 1. If an Order ID or Order Ref was searched, find which user placed it first
    let matchedUserIdByOrder: string | null = null;
    if (search) {
      const orderMatch = await prisma.order.findFirst({
        where: {
          OR: [
            { orderRef: { contains: search, mode: "insensitive" } },
            { id: { contains: search, mode: "insensitive" } },
            { providerOrderId: { contains: search, mode: "insensitive" } },
          ],
        },
        select: { userId: true },
      });

      if (orderMatch?.userId) {
        matchedUserIdByOrder = orderMatch.userId;
      } else {
        const engOrderMatch = await prisma.engagementOrder.findFirst({
          where: {
            OR: [
              { orderRef: { contains: search, mode: "insensitive" } },
              { id: { contains: search, mode: "insensitive" } },
            ],
          },
          select: { userId: true },
        });
        if (engOrderMatch?.userId) {
          matchedUserIdByOrder = engOrderMatch.userId;
        }
      }
    }

    // 2. Build Prisma where clause
    const whereClause: any = {};

    if (matchedUserIdByOrder) {
      whereClause.id = matchedUserIdByOrder;
    } else if (search) {
      const cleanSearch = search.replace(/^@/, "");
      whereClause.OR = [
        { username: { contains: cleanSearch, mode: "insensitive" } },
        { id: { contains: cleanSearch, mode: "insensitive" } },
        { passkeys: { some: { label: { contains: cleanSearch, mode: "insensitive" } } } },
        { orders: { some: { orderRef: { contains: cleanSearch, mode: "insensitive" } } } },
        { engagementOrders: { some: { orderRef: { contains: cleanSearch, mode: "insensitive" } } } },
      ];
    }

    // 3. Fetch Users with Orders, Transactions, and Passkeys
    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        passkeys: {
          select: {
            id: true,
            label: true,
            role: true,
            status: true,
            expiresAt: true,
            durationDays: true,
            lastUsedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        orders: {
          select: {
            id: true,
            orderRef: true,
            serviceId: true,
            service: { select: { name: true, platform: true } },
            targetUrl: true,
            requestedQuantity: true,
            deliveredQuantity: true,
            refundedAmount: true,
            totalCost: true,
            status: true,
            isScheduled: true,
            scheduleMode: true,
            providerOrderId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        engagementOrders: {
          select: {
            id: true,
            orderRef: true,
            platform: true,
            targetUrl: true,
            baseViews: true,
            deliveredViews: true,
            totalCost: true,
            refundedAmount: true,
            status: true,
            durationHours: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        walletTransactions: {
          select: {
            id: true,
            type: true,
            amount: true,
            balanceAfter: true,
            referenceId: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        deposits: {
          select: {
            id: true,
            depositRef: true,
            inrAmount: true,
            usdtAmount: true,
            txnId: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // 4. Transform into rich simplified live situation items
    const formattedUsers = users.map((u) => {
      // Primary name from passkey label or capitalized username
      const primaryPasskey = u.passkeys[0];
      const displayName = primaryPasskey?.label?.trim() || u.username;

      // Consolidate standard & engagement orders
      const standardOrders = u.orders.map((o) => ({
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

      const engagementOrders = u.engagementOrders.map((eo) => ({
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

      // Calculate live breakdown metrics
      const activeOrders = allOrders.filter(
        (o) =>
          o.status === "PENDING" ||
          o.status === "PROCESSING" ||
          o.status === "SCHEDULED" ||
          o.status === "PAUSED"
      );
      const completedOrders = allOrders.filter((o) => o.status === "COMPLETED");
      const cancelledOrders = allOrders.filter(
        (o) => o.status === "CANCELLED" || o.status === "FAILED"
      );
      const refundedOrders = allOrders.filter((o) => o.isRefunded);

      const totalRefundedAmount = allOrders.reduce(
        (sum, o) => sum + (o.refundedAmount || 0),
        0
      );
      const totalSpent = allOrders.reduce((sum, o) => sum + (o.totalCost || 0), 0);

      // Refund transactions count and amount from wallet
      const refundTransactions = u.walletTransactions.filter(
        (t) => t.type === "REFUND" || t.description.toLowerCase().includes("refund")
      );

      return {
        id: u.id,
        username: u.username,
        name: displayName,
        role: u.role,
        status: u.status,
        walletBalance: u.walletBalance,
        createdAt: u.createdAt,
        passkey: primaryPasskey
          ? {
              label: primaryPasskey.label,
              expiresAt: primaryPasskey.expiresAt,
              status: primaryPasskey.status,
            }
          : null,
        liveMetrics: {
          totalOrders: allOrders.length,
          activeCount: activeOrders.length,
          completedCount: completedOrders.length,
          cancelledCount: cancelledOrders.length,
          refundedCount: refundedOrders.length || refundTransactions.length,
          totalRefundedAmount,
          totalSpent,
          transactionCount: u.walletTransactions.length,
          depositCount: u.deposits.length,
        },
        orders: allOrders,
        transactions: u.walletTransactions,
        deposits: u.deposits,
      };
    });

    // Apply optional status filters
    let filteredUsers = formattedUsers;
    if (filter === "ACTIVE_ORDERS") {
      filteredUsers = formattedUsers.filter((u) => u.liveMetrics.activeCount > 0);
    } else if (filter === "CANCELLED_REFUNDED") {
      filteredUsers = formattedUsers.filter(
        (u) => u.liveMetrics.cancelledCount > 0 || u.liveMetrics.refundedCount > 0
      );
    } else if (filter === "HAS_BALANCE") {
      filteredUsers = formattedUsers.filter((u) => u.walletBalance > 0);
    }

    // Global counts for top summary bar
    const globalStats = {
      totalUsers: formattedUsers.length,
      usersWithActiveOrders: formattedUsers.filter((u) => u.liveMetrics.activeCount > 0).length,
      usersWithRefunds: formattedUsers.filter((u) => u.liveMetrics.refundedCount > 0).length,
      totalBalances: formattedUsers.reduce((sum, u) => sum + u.walletBalance, 0),
      totalRefunds: formattedUsers.reduce((sum, u) => sum + u.liveMetrics.totalRefundedAmount, 0),
    };

    return NextResponse.json({
      success: true,
      users: filteredUsers,
      stats: globalStats,
      searchedOrderUserFound: Boolean(matchedUserIdByOrder),
    });
  } catch (error: any) {
    console.error("[ADMIN_USERS_API] Error retrieving users:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve users" },
      { status: 500 }
    );
  }
}
