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
    const now = new Date();

    const [
      systemProviderConfig,
      orderCounts,
      stepCounts,
      jobCounts,
      totalUsers,
      activeUsers,
      disabledUsers,
      totalConfiguredProviders,
      workingProviders,
      workerStatus,
      lastSuccessfulOp,
      recentErrors,
      ordersNeedingAttention,
      failedSteps,
      recentRequests,
      recentAuditLogs,
      userProviders,
    ] = await Promise.all([
      prisma.provider.findFirst({ where: { active: true } }),
      prisma.order.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.scheduledDeliveryStep.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.scheduledOrderJob.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: { in: ["DISABLED", "EXPIRED", "REVOKED"] } } }),
      prisma.userProviderConnection.count({
        where: { apiKeyEncrypted: { not: null } },
      }),
      prisma.userProviderConnection.count({
        where: {
          apiKeyEncrypted: { not: null },
          balance: { not: null },
        },
      }),
      prisma.workerStatus.findUnique({ where: { id: "singleton" } }),
      prisma.providerRequestRecord.findFirst({
        where: { success: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.findFirst({
        where: { errorMessage: { not: null } },
        orderBy: { updatedAt: "desc" },
        select: { errorMessage: true, updatedAt: true, orderRef: true },
      }),
      prisma.order.findMany({
        where: {
          status: { in: ["REQUIRES_RECONCILIATION", "FAILED"] },
        },
        include: { service: true, user: { select: { username: true } } },
        take: 10,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.scheduledDeliveryStep.findMany({
        where: { status: "FAILED" },
        include: { order: { select: { orderRef: true, targetUrl: true } } },
        take: 10,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.providerRequestRecord.findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
      prisma.userProviderConnection.findMany({
        include: { user: { select: { username: true, role: true } } },
        take: 10,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    // Calculate background worker status
    const workerAgeMs = workerStatus?.lastHeartbeatAt
      ? now.getTime() - workerStatus.lastHeartbeatAt.getTime()
      : null;
    const workerIsRunning = workerAgeMs !== null && workerAgeMs < 45000; // active within 45 seconds

    const orderStatsMap = Object.fromEntries(orderCounts.map((o) => [o.status, o._count.id]));
    const jobStatsMap = Object.fromEntries(jobCounts.map((j) => [j.status, j._count.id]));

    // Total orders count
    const totalOrders = Object.values(orderStatsMap).reduce((a, b) => a + b, 0);
    const processingOrders = (orderStatsMap["PROCESSING"] || 0) + (orderStatsMap["PENDING"] || 0);
    const completedOrders = orderStatsMap["COMPLETED"] || 0;
    const failedOrders = orderStatsMap["FAILED"] || 0;
    const cancelledOrders = orderStatsMap["CANCELLED"] || 0;
    const awaitingExecution = (jobStatsMap["SCHEDULED"] || 0) + (jobStatsMap["QUEUED"] || 0);

    return NextResponse.json({
      success: true,
      systemStatus: {
        backendStatus: "Running",
        workerStatus: workerIsRunning ? "Active & Processing" : "Degraded / Pending Tick",
        lastWorkerHeartbeat: workerStatus?.lastHeartbeatAt || null,
        activeWorkers: workerStatus?.activeWorkers || 1,
        lastHealthCheckAt: now.toISOString(),
        lastSuccessfulProviderOp: lastSuccessfulOp
          ? {
              action: lastSuccessfulOp.action,
              endpoint: lastSuccessfulOp.endpoint,
              createdAt: lastSuccessfulOp.createdAt,
              durationMs: lastSuccessfulOp.durationMs,
            }
          : null,
        pendingJobsCount: jobStatsMap["SCHEDULED"] || 0,
        processingJobsCount: jobStatsMap["PROCESSING"] || 0,
        completedJobsCount: jobStatsMap["COMPLETED"] || 0,
        failedJobsCount: jobStatsMap["FAILED"] || 0,
        mostRecentError: recentErrors
          ? {
              message: recentErrors.errorMessage,
              orderRef: recentErrors.orderRef,
              timestamp: recentErrors.updatedAt,
            }
          : null,
      },
      orderProcessing: {
        totalOrders,
        processingOrders,
        completedOrders,
        awaitingExecution,
        failedOrders,
        cancelledOrders,
        breakdownByStatus: orderStatsMap,
      },
      userStatistics: {
        totalUsers,
        activeUsers,
        disabledUsers,
        totalConfiguredProviders,
        workingProviders,
      },
      providerHealth: {
        systemConfig: systemProviderConfig
          ? {
              name: systemProviderConfig.name,
              apiUrl: systemProviderConfig.apiUrl,
              isMock: systemProviderConfig.isMock,
              balance: systemProviderConfig.balance,
              currency: systemProviderConfig.currency,
              lastSyncAt: systemProviderConfig.lastSyncAt,
            }
          : null,
        userProviders: userProviders.map((up) => ({
          id: up.id,
          username: up.user.username,
          name: up.name,
          apiUrl: up.apiUrl,
          isMock: up.isMock,
          balance: up.balance,
          currency: up.currency,
          lastSyncAt: up.lastSyncAt,
          lastError: up.lastError,
          status: up.lastError ? "Error" : up.balance !== null ? "Connected" : "Configured",
        })),
      },
      ordersNeedingAttention,
      failedSteps,
      recentRequests,
      recentAuditLogs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load live diagnostics" },
      { status: 500 }
    );
  }
}
