import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { 
  ArrowRight, 
  TrendingUp, 
  PlusCircle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Layers, 
  Zap
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await getAuthSession();
  const userId = session.authenticated && session.user ? session.user.id : null;
  const isAdmin = session.authenticated && session.role === "ADMIN";

  // When not authenticated or for a regular user, filter strictly by authenticated userId
  const orderWhere = userId && !isAdmin ? { userId } : userId && isAdmin ? {} : { userId: "unauthenticated-empty" };
  const auditWhere = userId && !isAdmin ? { userId } : userId && isAdmin ? {} : { userId: "unauthenticated-empty" };
  const stepWhere = userId && !isAdmin 
    ? { status: "PENDING", order: { userId } } 
    : userId && isAdmin 
    ? { status: "PENDING" } 
    : { status: "PENDING", order: { userId: "unauthenticated-empty" } };

  // Per-user isolated database statistics
  const [
    totalOrders,
    activeOrders,
    scheduledSteps,
    servicesCount,
    recentOrders,
    recentAuditLogs
  ] = await Promise.all([
    userId ? prisma.order.count({ where: orderWhere }) : 0,
    userId ? prisma.order.count({
      where: { ...orderWhere, status: { in: ["PENDING", "PROCESSING", "SCHEDULED"] } },
    }) : 0,
    userId ? prisma.scheduledDeliveryStep.count({
      where: stepWhere,
    }) : 0,
    prisma.service.count({ where: { active: true } }),
    userId ? prisma.order.findMany({
      where: orderWhere,
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { service: true },
    }) : [],
    userId ? prisma.auditLog.findMany({
      where: auditWhere,
      take: 4,
      orderBy: { createdAt: "desc" },
    }) : [],
  ]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner / Hero Header */}
      <div className="bg-[#252943] text-white rounded-2xl p-6 sm:p-8 shadow-card border border-[#323758]/60 relative overflow-hidden">
        <div className="max-w-3xl space-y-3 z-10 relative">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Clean, Transparent SMM Operations
          </h1>
          <p className="text-sm sm:text-base text-[#DEE0ED]/80 leading-relaxed max-w-2xl">
            Order standard catalog items or configure deterministic growth schedules with clear delivery previews,
            safe retries, and strict provider constraint validation.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/order"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-sm font-medium transition-all press-scale shadow-subtle"
            >
              <PlusCircle className="w-4 h-4 text-[#E3FF3B]" />
              New Instant Order
            </Link>
            <Link
              href="/planner"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-all press-scale border border-white/10"
            >
              <TrendingUp className="w-4 h-4 text-[#E3FF3B]" />
              Open Growth Planner
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs text-[#DEE0ED]/70 hover:text-white transition-colors"
            >
              Browse {servicesCount} Services <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Primary Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-[#DEE0ED] shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#252943]/60 font-medium mb-2">
            <span>Active Orders</span>
            <Clock className="w-4 h-4 text-[#3A4EFB]" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#252943] tabular-nums">
            {activeOrders.toLocaleString()}
          </div>
          <p className="text-xs text-[#252943]/50 mt-1">
            {totalOrders} lifetime total
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#DEE0ED] shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#252943]/60 font-medium mb-2">
            <span>Pending Scheduled Steps</span>
            <TrendingUp className="w-4 h-4 text-[#252943]" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#252943] tabular-nums">
            {scheduledSteps.toLocaleString()}
          </div>
          <p className="text-xs text-[#252943]/50 mt-1">
            Awaiting execution time
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#DEE0ED] shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#252943]/60 font-medium mb-2">
            <span>Active Services</span>
            <Layers className="w-4 h-4 text-[#3A4EFB]" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#252943] tabular-nums">
            {servicesCount}
          </div>
          <p className="text-xs text-[#252943]/50 mt-1">
            Verified provider catalog
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#DEE0ED] shadow-subtle">
          <div className="flex items-center justify-between text-xs text-[#252943]/60 font-medium mb-2">
            <span>Scheduler Health</span>
            <Zap className="w-4 h-4 text-[#3A4EFB]" />
          </div>
          <div className="text-base font-semibold text-[#252943] flex items-center gap-1.5 mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3A4EFB]"></span>
            <span>Reliable (DB-backed)</span>
          </div>
          <p className="text-xs text-[#252943]/50 mt-1">
            Idempotent step locking
          </p>
        </div>
      </div>

      {/* Main Grid: Recent Orders + Scheduling Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
          <div className="p-5 border-b border-[#DEE0ED] flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#252943]">Recent Orders</h2>
              <p className="text-xs text-[#252943]/60">Track latest provider submissions and schedules</p>
            </div>
            <Link
              href="/orders"
              className="text-xs font-medium text-[#3A4EFB] hover:underline flex items-center gap-1"
            >
              View all orders <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#DEE0ED]/50 flex items-center justify-center mx-auto text-[#252943]/40">
                <Layers className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-[#252943]">No orders placed yet</p>
              <p className="text-xs text-[#252943]/60 max-w-sm mx-auto">
                Place an instant order or configure a drip-feed schedule in the Growth Planner.
              </p>
              <div className="pt-2">
                <Link
                  href="/order"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#3A4EFB] text-white text-xs font-medium"
                >
                  Create First Order
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FD] border-b border-[#DEE0ED] text-[#252943]/60 font-medium">
                  <tr>
                    <th className="py-3 px-4">Order Ref</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEE0ED]/60">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-[#F8F9FD]/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#252943]">
                        {order.orderRef}
                      </td>
                      <td className="py-3.5 px-4 max-w-[200px] truncate font-semibold text-[#252943]">
                        {order.service.name}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-[#252943]">
                        {order.requestedQuantity.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#DEE0ED]/60 text-[#252943]">
                          {order.scheduleMode || "INSTANT"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-[#3A4EFB] hover:text-[#2C3FE0] font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Side Column: Growth Planner Highlight + Audit Trail */}
        <div className="space-y-6">
          {/* Growth Planner Feature Box */}
          <div className="bg-white rounded-2xl border border-[#DEE0ED] p-5 shadow-subtle space-y-3">
            <div className="flex items-center gap-2 text-[#3A4EFB]">
              <TrendingUp className="w-5 h-5 text-[#3A4EFB]" />
              <h3 className="text-sm font-semibold text-[#252943]">Intelligent Growth Planner</h3>
            </div>
            <p className="text-xs text-[#252943]/70 leading-relaxed">
              Instead of dumping artificial volume all at once, schedule delivery in balanced steps:
            </p>
            <ul className="text-xs text-[#252943]/80 space-y-2 pt-1">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#3A4EFB] shrink-0 mt-0.5" />
                <span><strong>Even Drip:</strong> Equal distribution across hours or days.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#3A4EFB] shrink-0 mt-0.5" />
                <span><strong>Front-Loaded:</strong> Strong launch boost tapering to organic rate.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#3A4EFB] shrink-0 mt-0.5" />
                <span><strong>Gradual Ramp:</strong> Conservative start accelerating over time.</span>
              </li>
            </ul>
            <div className="pt-2">
              <Link
                href="/planner"
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#252943] text-white hover:bg-[#1A1D31] text-xs font-medium transition-all press-scale"
              >
                Launch Planner <ArrowRight className="w-3.5 h-3.5 text-[#E3FF3B]" />
              </Link>
            </div>
          </div>

          {/* Recent Audit Events */}
          <div className="bg-white rounded-2xl border border-[#DEE0ED] p-5 shadow-subtle space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#252943]">Audit & Operations Log</h3>
              <ShieldCheck className="w-4 h-4 text-[#252943]/50" />
            </div>
            <div className="space-y-2.5">
              {recentAuditLogs.length === 0 ? (
                <p className="text-xs text-[#252943]/50 py-3 text-center">No recent activity logged</p>
              ) : (
                recentAuditLogs.map((log) => (
                  <div key={log.id} className="text-xs border-b border-[#DEE0ED]/40 pb-2 last:border-none last:pb-0">
                    <div className="flex items-center justify-between text-[#252943]/50 text-[10px]">
                      <span className="font-bold text-[#252943]">{log.action}</span>
                      <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-[#252943]/80 font-medium text-[11px] mt-0.5">{log.details}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let badgeColor = "bg-[#DEE0ED]/60 text-[#252943]";
  if (status === "COMPLETED") badgeColor = "bg-[#E3FF3B] text-[#252943] font-semibold";
  else if (status === "PROCESSING") badgeColor = "bg-[#3A4EFB]/15 text-[#3A4EFB] font-medium";
  else if (status === "SCHEDULED") badgeColor = "bg-[#252943] text-white font-medium";
  else if (status === "FAILED") badgeColor = "bg-red-100 text-red-700 font-medium";
  else if (status === "REQUIRES_RECONCILIATION") badgeColor = "bg-amber-100 text-amber-800 font-medium";

  return (
    <span className={`inline-block text-[10px] tracking-wide px-2 py-0.5 rounded-full ${badgeColor}`}>
      {status}
    </span>
  );
}
