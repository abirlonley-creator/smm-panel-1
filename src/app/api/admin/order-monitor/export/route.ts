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
    const exportType = url.searchParams.get("type") === "runs" ? "runs" : "orders";

    if (exportType === "runs") {
      const runs = await prisma.engagementRun.findMany({
        include: {
          engagementOrder: { select: { orderRef: true, platform: true, targetUrl: true } },
          provider: { select: { name: true } },
        },
        orderBy: { scheduledAt: "desc" },
        take: 5000,
      });

      const headers = [
        "Run ID",
        "Order Ref",
        "Platform",
        "Type",
        "Run #",
        "Provider",
        "Service ID",
        "Status",
        "Scheduled At",
        "Sent At",
        "Lateness (s)",
        "Planned Qty",
        "Delivered Qty",
        "Provider Order ID",
        "Cost (INR)",
        "Error",
      ];

      const csvRows = [headers.join(",")];

      for (const r of runs) {
        csvRows.push(
          [
            `"${r.id}"`,
            `"${r.engagementOrder?.orderRef || ""}"`,
            `"${r.engagementOrder?.platform || ""}"`,
            `"${r.engagementType}"`,
            r.runNumber || 1,
            `"${r.provider?.name || "Provider"}"`,
            `"${r.providerServiceId || ""}"`,
            `"${r.status}"`,
            `"${r.scheduledAt.toISOString()}"`,
            `"${r.sentAt ? r.sentAt.toISOString() : ""}"`,
            r.latenessSeconds || 0,
            r.quantity,
            r.deliveredQuantity ?? 0,
            `"${r.providerOrderId || ""}"`,
            r.cost.toFixed(2),
            `"${(r.errorMessage || "").replace(/"/g, '""')}"`,
          ].join(",")
        );
      }

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="aurasmm-runs-${Date.now()}.csv"`,
        },
      });
    }

    // Export orders
    const orders = await prisma.engagementOrder.findMany({
      include: {
        user: { select: { username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const headers = [
      "Order Ref",
      "User",
      "Platform",
      "Target URL",
      "Status",
      "Duration (Hours)",
      "Total Cost (INR)",
      "Refunded (INR)",
      "Planned Views",
      "Delivered Views",
      "Planned Likes",
      "Delivered Likes",
      "Deviation Status",
      "Created At",
    ];

    const csvRows = [headers.join(",")];

    for (const o of orders) {
      csvRows.push(
        [
          `"${o.orderRef}"`,
          `"${o.user?.username || "Guest"}"`,
          `"${o.platform}"`,
          `"${o.targetUrl.replace(/"/g, '""')}"`,
          `"${o.status}"`,
          o.durationHours,
          o.totalCost.toFixed(2),
          o.refundedAmount.toFixed(2),
          o.plannedViews,
          o.deliveredViews,
          o.plannedLikes,
          o.deliveredLikes,
          `"${o.deviationStatus}"`,
          `"${o.createdAt.toISOString()}"`,
        ].join(",")
      );
    }

    return new NextResponse(csvRows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aurasmm-orders-${Date.now()}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("[EXPORT] Error generating CSV:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate CSV export" },
      { status: 500 }
    );
  }
}
