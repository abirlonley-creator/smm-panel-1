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
    const deposits = await prisma.paymentDeposit.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            walletBalance: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const totalVerifiedInr = await prisma.paymentDeposit.aggregate({
      where: { status: "VERIFIED" },
      _sum: { inrAmount: true, usdtAmount: true },
    });

    const pendingCount = await prisma.paymentDeposit.count({
      where: { status: "PENDING" },
    });

    return NextResponse.json({
      success: true,
      deposits,
      metrics: {
        totalVerifiedInr: totalVerifiedInr._sum.inrAmount || 0,
        totalVerifiedUsdt: totalVerifiedInr._sum.usdtAmount || 0,
        pendingCount,
        totalCount: deposits.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load admin deposits" },
      { status: 500 }
    );
  }
}
