import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { requireAdminPermission } from "@/lib/auth/admin-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const perm = await requireAdminPermission(request, "canViewFinancials");
  if (!perm.allowed) {
    return NextResponse.json({ success: false, error: perm.error }, { status: perm.status });
  }

  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "all";

  // Calculate time filter
  let startDate: Date | undefined;
  const now = new Date();
  if (range === "today") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === "7d") {
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === "30d") {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  try {
    const whereDate = startDate ? { createdAt: { gte: startDate } } : {};
    // Strictly track registered customers/users only (exclude admin accounts & non-user orders)
    const userOnlyFilter = {
      user: {
        role: "USER",
      },
    };

    // 1. Fetch Engagement Orders, Direct Orders, Deposits, Liabilities, and Customers
    const [engOrders, orders, depositsVerified, depositsPending, userLiabilities, customerUsers] = await Promise.all([
      prisma.engagementOrder.findMany({
        where: {
          ...whereDate,
          ...userOnlyFilter,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              role: true,
              passkeys: { select: { label: true }, take: 1 },
            },
          },
          runs: {
            select: {
              id: true,
              quantity: true,
              cost: true,
              engagementType: true,
              status: true,
              service: { select: { ratePer1000: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // 2. Fetch Direct SMM Orders (Users only)
      prisma.order.findMany({
        where: {
          ...whereDate,
          ...userOnlyFilter,
        },
        select: {
          id: true,
          orderRef: true,
          totalCost: true,
          refundedAmount: true,
          status: true,
          submittedQuantity: true,
          deliveredQuantity: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true,
              role: true,
              passkeys: { select: { label: true }, take: 1 },
            },
          },
          service: { select: { name: true, ratePer1000: true } },
        },
        orderBy: { createdAt: "desc" },
      }),

      // 3. Binance Pay Deposits (Verified & Pending) - Users only
      prisma.paymentDeposit.aggregate({
        where: {
          status: "VERIFIED",
          ...userOnlyFilter,
          ...(startDate ? { verifiedAt: { gte: startDate } } : {}),
        },
        _sum: { inrAmount: true, usdtAmount: true },
        _count: { id: true },
      }),

      prisma.paymentDeposit.aggregate({
        where: {
          status: "PENDING",
          ...userOnlyFilter,
        },
        _sum: { inrAmount: true, usdtAmount: true },
        _count: { id: true },
      }),

      // 4. User Active Balance Liability
      prisma.user.aggregate({
        where: { role: "USER" },
        _sum: { walletBalance: true },
        _count: { id: true },
      }),

      // 5. Customer Users (Sakib, Flex, John) for individual real breakdown
      prisma.user.findMany({
        where: { role: "USER" },
        include: {
          passkeys: { select: { label: true }, orderBy: { createdAt: "asc" } },
          sessions: {
            select: { lastActivityAt: true, expiresAt: true },
            orderBy: { lastActivityAt: "desc" },
            take: 1,
          },
          orders: {
            where: whereDate,
            select: {
              id: true,
              totalCost: true,
              refundedAmount: true,
              status: true,
              submittedQuantity: true,
              deliveredQuantity: true,
              service: { select: { ratePer1000: true } },
            },
          },
          engagementOrders: {
            where: whereDate,
            select: {
              id: true,
              totalCost: true,
              refundedAmount: true,
              status: true,
              runs: {
                select: {
                  quantity: true,
                  cost: true,
                  engagementType: true,
                  status: true,
                  service: { select: { ratePer1000: true } },
                },
              },
            },
          },
          deposits: {
            where: {
              status: "VERIFIED",
              ...(startDate ? { verifiedAt: { gte: startDate } } : {}),
            },
            select: { inrAmount: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Calculate Engagement Financials
    let engRevenue = 0;
    let engUpstreamCost = 0;
    let engDeliveredRuns = 0;

    for (const eo of engOrders) {
      const net = Math.max(0, eo.totalCost - (eo.refundedAmount || 0));
      engRevenue += net;
      for (const r of eo.runs) {
        if (r.status === "sent" || r.status === "confirmed") {
          engDeliveredRuns++;
          let wholesaleRate = r.service?.ratePer1000 ?? 2.23;
          if (r.engagementType === "likes") wholesaleRate = r.service?.ratePer1000 ?? 0.88;
          else if (r.engagementType === "saves" || r.engagementType === "shares") wholesaleRate = r.service?.ratePer1000 ?? 0.22;
          else if (r.engagementType === "comments") wholesaleRate = r.service?.ratePer1000 ?? 5.0;

          const runCost = r.cost && r.cost > 0 ? r.cost : (r.quantity / 1000) * wholesaleRate;
          engUpstreamCost += runCost;
        }
      }
    }

    // Calculate Direct SMM Orders Financials
    let ordersRevenue = 0;
    let ordersUpstreamCost = 0;

    for (const o of orders) {
      if (o.status !== "FAILED" && o.status !== "CANCELLED") {
        const net = Math.max(0, o.totalCost - (o.refundedAmount || 0));
        ordersRevenue += net;
        const qty = o.deliveredQuantity || o.submittedQuantity || 0;
        const srvRate = o.service?.ratePer1000 || 0;
        ordersUpstreamCost += (qty / 1000) * srvRate;
      }
    }

    // Totals
    const totalRevenue = engRevenue + ordersRevenue;
    const totalUpstreamCost = engUpstreamCost + ordersUpstreamCost;
    const totalProfit = totalRevenue - totalUpstreamCost;
    const marginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const engProfit = engRevenue - engUpstreamCost;
    const engMargin = engRevenue > 0 ? (engProfit / engRevenue) * 100 : 0;

    const ordersProfit = ordersRevenue - ordersUpstreamCost;
    const ordersMargin = ordersRevenue > 0 ? (ordersProfit / ordersRevenue) * 100 : 0;

    // Build Individual Customer Breakdown (Sakib, Flex, John) with 100% real math
    const nowTimestamp = Date.now();
    const customerBreakdown = customerUsers.map((u) => {
      const passkeyLabel = u.passkeys[0]?.label?.trim();
      let displayName = passkeyLabel || u.username;
      if (displayName.toLowerCase() === "sakib") displayName = "Sakib";
      if (displayName.toLowerCase() === "flex") displayName = "Flex";
      if (displayName.toLowerCase() === "john") displayName = "John";

      // Real direct orders totals
      let uOrdersRev = 0;
      let uOrdersCost = 0;
      for (const o of u.orders) {
        if (o.status !== "FAILED" && o.status !== "CANCELLED") {
          const net = Math.max(0, o.totalCost - (o.refundedAmount || 0));
          uOrdersRev += net;
          const qty = o.deliveredQuantity || o.submittedQuantity || 0;
          const srvRate = o.service?.ratePer1000 || 0;
          uOrdersCost += (qty / 1000) * srvRate;
        }
      }

      // Real organic engagement totals
      let uEngRev = 0;
      let uEngCost = 0;
      for (const eo of u.engagementOrders) {
        const net = Math.max(0, eo.totalCost - (eo.refundedAmount || 0));
        uEngRev += net;
        for (const r of eo.runs) {
          if (r.status === "sent" || r.status === "confirmed") {
            let wholesaleRate = r.service?.ratePer1000 ?? 2.23;
            if (r.engagementType === "likes") wholesaleRate = r.service?.ratePer1000 ?? 0.88;
            else if (r.engagementType === "saves" || r.engagementType === "shares") wholesaleRate = r.service?.ratePer1000 ?? 0.22;
            else if (r.engagementType === "comments") wholesaleRate = r.service?.ratePer1000 ?? 5.0;
            const runCost = r.cost && r.cost > 0 ? r.cost : (r.quantity / 1000) * wholesaleRate;
            uEngCost += runCost;
          }
        }
      }

      const userTotalRevenue = uOrdersRev + uEngRev;
      const userTotalCost = uOrdersCost + uEngCost;
      const userNetProfit = userTotalRevenue - userTotalCost;
      const userMargin = userTotalRevenue > 0 ? (userNetProfit / userTotalRevenue) * 100 : 0;
      const totalDeposited = u.deposits.reduce((sum, d) => sum + (d.inrAmount || 0), 0);
      const totalOrdersCount = u.orders.length + u.engagementOrders.length;

      const lastSession = u.sessions[0];
      const isOnline = lastSession
        ? nowTimestamp - new Date(lastSession.lastActivityAt).getTime() <= 15 * 60 * 1000
        : false;
      const isActiveToday = lastSession
        ? nowTimestamp - new Date(lastSession.lastActivityAt).getTime() <= 24 * 60 * 60 * 1000
        : false;

      return {
        id: u.id,
        username: u.username,
        name: displayName,
        passkeyLabel: passkeyLabel || null,
        walletBalance: Number(u.walletBalance.toFixed(2)),
        totalDeposited: Number(totalDeposited.toFixed(2)),
        ordersCount: totalOrdersCount,
        revenue: Number(userTotalRevenue.toFixed(2)),
        upstreamCost: Number(userTotalCost.toFixed(2)),
        profit: Number(userNetProfit.toFixed(2)),
        marginPercent: Number(userMargin.toFixed(1)),
        isOnline,
        isActiveToday,
      };
    });

    // Priority order for the 3 registered customers
    const priorityNames = ["sakib", "flex", "john"];
    customerBreakdown.sort((a, b) => {
      const aIdx = priorityNames.indexOf(a.name.toLowerCase());
      const bIdx = priorityNames.indexOf(b.name.toLowerCase());
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return b.revenue - a.revenue;
    });

    // Recent Transactions Profit Ledger (combining top 40 engagement & direct orders)
    const recentLedger: Array<{
      id: string;
      orderRef: string;
      type: "ENGAGEMENT" | "ORDER";
      name: string;
      customerName: string;
      customerUsername: string;
      customerPaid: number;
      upstreamCost: number;
      profit: number;
      marginPercent: number;
      status: string;
      createdAt: string;
    }> = [];

    for (const eo of engOrders.slice(0, 20)) {
      const net = Math.max(0, eo.totalCost - (eo.refundedAmount || 0));
      let eoUpstream = 0;
      for (const r of eo.runs) {
        if (r.status === "sent" || r.status === "confirmed") {
          let wholesaleRate = r.service?.ratePer1000 ?? 2.23;
          if (r.engagementType === "likes") wholesaleRate = r.service?.ratePer1000 ?? 0.88;
          else if (r.engagementType === "saves" || r.engagementType === "shares") wholesaleRate = r.service?.ratePer1000 ?? 0.22;
          else if (r.engagementType === "comments") wholesaleRate = r.service?.ratePer1000 ?? 5.0;
          eoUpstream += (r.quantity / 1000) * wholesaleRate;
        }
      }
      const p = net - eoUpstream;
      const m = net > 0 ? (p / net) * 100 : 0;
      const custDisplayName = eo.user?.passkeys?.[0]?.label || eo.user?.username || "Customer";

      recentLedger.push({
        id: eo.id,
        orderRef: eo.orderRef,
        type: "ENGAGEMENT",
        name: `TikTok Engagement (${eo.baseViews} Base Views)`,
        customerName: custDisplayName,
        customerUsername: eo.user?.username || "",
        customerPaid: Number(net.toFixed(2)),
        upstreamCost: Number(eoUpstream.toFixed(2)),
        profit: Number(p.toFixed(2)),
        marginPercent: Number(m.toFixed(1)),
        status: eo.status,
        createdAt: eo.createdAt.toISOString(),
      });
    }

    for (const o of orders.slice(0, 20)) {
      if (o.status !== "FAILED" && o.status !== "CANCELLED") {
        const net = Math.max(0, o.totalCost - (o.refundedAmount || 0));
        const qty = o.deliveredQuantity || o.submittedQuantity || 0;
        const srvRate = o.service?.ratePer1000 || 0;
        const upCost = (qty / 1000) * srvRate;
        const p = net - upCost;
        const m = net > 0 ? (p / net) * 100 : 0;
        const custDisplayName = o.user?.passkeys?.[0]?.label || o.user?.username || "Customer";

        recentLedger.push({
          id: o.id,
          orderRef: o.orderRef,
          type: "ORDER",
          name: o.service?.name || "Direct SMM Order",
          customerName: custDisplayName,
          customerUsername: o.user?.username || "",
          customerPaid: Number(net.toFixed(2)),
          upstreamCost: Number(upCost.toFixed(2)),
          profit: Number(p.toFixed(2)),
          marginPercent: Number(m.toFixed(1)),
          status: o.status,
          createdAt: o.createdAt.toISOString(),
        });
      }
    }

    // Sort recent ledger by date desc
    recentLedger.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      range,
      summary: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalUpstreamCost: Number(totalUpstreamCost.toFixed(2)),
        totalProfit: Number(totalProfit.toFixed(2)),
        marginPercent: Number(marginPercent.toFixed(1)),
        totalDepositsVerified: Number((depositsVerified._sum.inrAmount || 0).toFixed(2)),
        totalDepositsVerifiedUsdt: Number((depositsVerified._sum.usdtAmount || 0).toFixed(2)),
        verifiedDepositsCount: depositsVerified._count.id,
        totalDepositsPending: Number((depositsPending._sum.inrAmount || 0).toFixed(2)),
        pendingDepositsCount: depositsPending._count.id,
        userWalletLiability: Number((userLiabilities._sum.walletBalance || 0).toFixed(2)),
        activeUsersCount: userLiabilities._count.id,
      },
      breakdown: {
        engagement: {
          revenue: Number(engRevenue.toFixed(2)),
          upstreamCost: Number(engUpstreamCost.toFixed(2)),
          profit: Number(engProfit.toFixed(2)),
          marginPercent: Number(engMargin.toFixed(1)),
          ordersCount: engOrders.length,
          deliveredRuns: engDeliveredRuns,
        },
        smmOrders: {
          revenue: Number(ordersRevenue.toFixed(2)),
          upstreamCost: Number(ordersUpstreamCost.toFixed(2)),
          profit: Number(ordersProfit.toFixed(2)),
          marginPercent: Number(ordersMargin.toFixed(1)),
          ordersCount: orders.length,
        },
      },
      customers: customerBreakdown,
      recentLedger: recentLedger.slice(0, 30),
    });
  } catch (err: any) {
    console.error("[ADMIN_FINANCIALS_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to calculate financials" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === "reset") {
      // 1. Delete scheduled steps & runs
      await prisma.scheduledDeliveryStep.deleteMany({});
      await prisma.dripFeedRun.deleteMany({});
      await prisma.providerRequestRecord.deleteMany({});
      // 2. Delete all orders & engagement runs/logs
      await prisma.order.deleteMany({});
      await prisma.engagementRun.deleteMany({});
      await prisma.orderEventLog.deleteMany({});
      await prisma.engagementOrder.deleteMany({});
      // 3. Delete all payment deposits & transactions
      await prisma.paymentDeposit.deleteMany({});
      await prisma.walletTransaction.deleteMany({});
      // 4. Reset user wallet balances to 0 for users
      await prisma.user.updateMany({
        where: { role: "USER" },
        data: { walletBalance: 0 },
      });

      return NextResponse.json({
        success: true,
        message: "Financial metrics, orders, and deposits have been successfully reset to 0.",
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[ADMIN_FINANCIALS_RESET_ERROR]", err);
    return NextResponse.json({ success: false, error: err.message || "Reset failed" }, { status: 500 });
  }
}
