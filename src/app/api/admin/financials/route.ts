import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
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

    // 1. Fetch Engagement Orders and Runs
    const [engOrders, orders, depositsVerified, depositsPending, userLiabilities] = await Promise.all([
      prisma.engagementOrder.findMany({
        where: whereDate,
        include: {
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

      // 2. Fetch Direct SMM Orders
      prisma.order.findMany({
        where: whereDate,
        select: {
          id: true,
          orderRef: true,
          totalCost: true,
          refundedAmount: true,
          status: true,
          submittedQuantity: true,
          deliveredQuantity: true,
          createdAt: true,
          service: { select: { name: true, ratePer1000: true } },
        },
        orderBy: { createdAt: "desc" },
      }),

      // 3. Binance Pay Deposits (Verified & Pending)
      prisma.paymentDeposit.aggregate({
        where: {
          status: "VERIFIED",
          ...(startDate ? { verifiedAt: { gte: startDate } } : {}),
        },
        _sum: { inrAmount: true, usdtAmount: true },
        _count: { id: true },
      }),

      prisma.paymentDeposit.aggregate({
        where: { status: "PENDING" },
        _sum: { inrAmount: true, usdtAmount: true },
        _count: { id: true },
      }),

      // 4. User Active Balance Liability
      prisma.user.aggregate({
        where: { role: "USER" },
        _sum: { walletBalance: true },
        _count: { id: true },
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

          const runCost = (r.quantity / 1000) * wholesaleRate;
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

    // Recent Transactions Profit Ledger (combining top 40 engagement & direct orders)
    const recentLedger: Array<{
      id: string;
      orderRef: string;
      type: "ENGAGEMENT" | "ORDER";
      name: string;
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
      recentLedger.push({
        id: eo.id,
        orderRef: eo.orderRef,
        type: "ENGAGEMENT",
        name: `TikTok Engagement (${eo.baseViews} Base Views)`,
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
        recentLedger.push({
          id: o.id,
          orderRef: o.orderRef,
          type: "ORDER",
          name: o.service?.name || "Direct SMM Order",
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
