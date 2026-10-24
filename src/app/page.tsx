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
  Zap,
  Activity,
  BarChart3,
  Tag,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await getAuthSession();
  const userId = session.authenticated && session.user ? session.user.id : null;
  const isAdmin = session.authenticated && session.role === "ADMIN";

  const orderWhere = userId && !isAdmin ? { userId } : userId && isAdmin ? {} : { userId: "unauthenticated-empty" };
  const auditWhere = userId && !isAdmin ? { userId } : userId && isAdmin ? {} : { userId: "unauthenticated-empty" };
  const stepWhere =
    userId && !isAdmin
      ? { status: "PENDING", order: { userId } }
      : userId && isAdmin
      ? { status: "PENDING" }
      : { status: "PENDING", order: { userId: "unauthenticated-empty" } };

  const [
    totalOrders,
    activeOrders,
    scheduledSteps,
    servicesCount,
    recentOrders,
    recentAuditLogs,
  ] = await Promise.all([
    userId ? prisma.order.count({ where: orderWhere }) : 0,
    userId
      ? prisma.order.count({
          where: { ...orderWhere, status: { in: ["PENDING", "PROCESSING", "SCHEDULED"] } },
        })
      : 0,
    userId ? prisma.scheduledDeliveryStep.count({ where: stepWhere }) : 0,
    prisma.service.count({ where: { active: true } }),
    userId
      ? prisma.order.findMany({
          where: orderWhere,
          take: 6,
          orderBy: { createdAt: "desc" },
          include: { service: true },
        })
      : [],
    userId
      ? prisma.auditLog.findMany({
          where: auditWhere,
          take: 4,
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);

  return (
    <div className="space-y-6 animate-fadeIn max-w-6xl mx-auto">

      {/* ── Hero Block ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl bg-[#252943] border border-[#323758]/70 px-7 py-8 sm:px-10 sm:py-10">
        {/* Subtle grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#E3FF3B 1px, transparent 1px), linear-gradient(90deg, #E3FF3B 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Glow accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #3A4EFB 0%, transparent 70%)" }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-10">
          <div className="flex-1 space-y-4">
            {/* Eyebrow pill */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E3FF3B]/20 bg-[#E3FF3B]/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#E3FF3B] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E3FF3B] animate-pulse" />
              Live · {servicesCount.toLocaleString()} Services
            </span>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight max-w-xl">
              Clean, Deterministic<br className="hidden sm:block" /> SMM Operations
            </h1>

            <p className="text-sm text-[#DEE0ED]/65 leading-relaxed max-w-lg">
              Order instantly or configure precision growth schedules — with
              transparent delivery previews, safe retries, and strict provider
              constraint validation.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Link
                href="/order"
                className="inline-flex items-center gap-2 rounded-xl bg-[#3A4EFB] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#2C3FE0] press-scale shadow-sm"
              >
                <PlusCircle className="w-4 h-4 text-[#E3FF3B]" />
                New Order
              </Link>
              <Link
                href="/planner"
                className="inline-flex items-center gap-2 rounded-xl bg-white/8 border border-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/12 press-scale"
              >
                <TrendingUp className="w-4 h-4 text-[#E3FF3B]" />
                Growth Planner
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#E3FF3B]/15 border border-[#E3FF3B]/30 px-3.5 py-2.5 text-xs font-semibold text-[#E3FF3B] hover:bg-[#E3FF3B]/25 transition-all press-scale"
              >
                <Tag className="w-3.5 h-3.5" />
                Plans & Pricing
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-[#DEE0ED]/60 hover:text-white transition-colors"
              >
                Browse Services
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Mini stats panel on the right */}
          <div className="shrink-0 hidden sm:grid grid-cols-2 gap-2.5 min-w-[230px]">
            {[
              { label: "Total Orders", value: totalOrders.toLocaleString(), icon: Activity },
              { label: "Active", value: activeOrders.toLocaleString(), icon: Zap },
              { label: "Scheduled Steps", value: scheduledSteps.toLocaleString(), icon: Clock },
              { label: "Services", value: servicesCount.toLocaleString(), icon: Layers },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-xl bg-white/6 border border-white/8 px-3.5 py-3 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-[#DEE0ED]/50 uppercase tracking-wide">
                    {label}
                  </span>
                  <Icon className="w-3.5 h-3.5 text-[#E3FF3B]/70" />
                </div>
                <p className="text-xl font-bold tabular-nums text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mobile Stats Row (shown on sm only) ─────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        {[
          { label: "Active Orders", value: activeOrders, sub: `${totalOrders} total`, icon: Clock, accent: "#3A4EFB" },
          { label: "Scheduled Steps", value: scheduledSteps, sub: "Awaiting execution", icon: TrendingUp, accent: "#252943" },
          { label: "Services", value: servicesCount, sub: "Verified catalog", icon: Layers, accent: "#3A4EFB" },
          { label: "Scheduler", value: "Online", sub: "DB-backed & reliable", icon: Zap, accent: "#3A4EFB" },
        ].map(({ label, value, sub, icon: Icon, accent }) => (
          <div key={label} className="bg-white rounded-xl p-4 border border-[#DEE0ED] shadow-subtle">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-[#252943]/50 uppercase tracking-wide">{label}</span>
              <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
            </div>
            <p className="text-2xl font-bold tabular-nums text-[#252943]">{typeof value === "number" ? value.toLocaleString() : value}</p>
            <p className="text-[10px] text-[#252943]/45 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent Orders – 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#DEE0ED]">
            <div>
              <h2 className="text-sm font-semibold text-[#252943]">Recent Orders</h2>
              <p className="text-[11px] text-[#252943]/50 mt-0.5">Latest provider submissions & schedules</p>
            </div>
            <Link
              href="/orders"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#3A4EFB] hover:text-[#2C3FE0] transition-colors"
            >
              All orders <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#F0F1FA] flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#252943]/30" />
              </div>
              <p className="text-sm font-semibold text-[#252943]">No orders yet</p>
              <p className="text-xs text-[#252943]/50 max-w-xs">
                Place an instant order or use the Growth Planner for drip-feed scheduling.
              </p>
              <Link
                href="/order"
                className="mt-1 inline-flex items-center gap-2 rounded-xl bg-[#3A4EFB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2C3FE0] press-scale transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Create First Order
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F8F9FD] border-b border-[#DEE0ED]">
                    {["Order Ref", "Service", "Qty", "Mode", "Status", ""].map((h) => (
                      <th
                        key={h}
                        className="py-3 px-4 text-[10px] font-semibold uppercase tracking-widest text-[#252943]/40"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEE0ED]/50">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="group hover:bg-[#F8F9FD]/70 transition-colors">
                      <td className="py-3.5 px-4 text-xs font-mono font-bold text-[#252943]">
                        {order.orderRef}
                      </td>
                      <td className="py-3.5 px-4 max-w-[180px] truncate text-xs font-medium text-[#252943]">
                        {order.service.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-[#252943] tabular-nums">
                        {order.requestedQuantity.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F0F1FA] text-[#252943]/70 uppercase tracking-wide">
                          {order.scheduleMode || "Instant"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-xs font-semibold text-[#3A4EFB] opacity-0 group-hover:opacity-100 hover:text-[#2C3FE0] transition-all"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">

          {/* Growth Planner Card */}
          <div className="bg-white rounded-2xl border border-[#DEE0ED] p-5 shadow-subtle space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-[#252943]">Growth Planner</h3>
                <p className="text-[11px] text-[#252943]/50">Intelligent drip-feed scheduling</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-[#3A4EFB]/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-[#3A4EFB]" />
              </div>
            </div>

            <ul className="space-y-2.5">
              {[
                { label: "Even Drip", desc: "Equal distribution across intervals" },
                { label: "Front-Loaded", desc: "Strong boost that tapers naturally" },
                { label: "Gradual Ramp", desc: "Conservative start, accelerating" },
              ].map(({ label, desc }) => (
                <li key={label} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#3A4EFB] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-semibold text-[#252943]">{label} </span>
                    <span className="text-xs text-[#252943]/55">— {desc}</span>
                  </div>
                </li>
              ))}
            </ul>

            <Link
              href="/planner"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#252943] hover:bg-[#1A1D31] text-white text-xs font-semibold py-2.5 transition-colors press-scale"
            >
              Open Planner <ArrowRight className="w-3.5 h-3.5 text-[#E3FF3B]" />
            </Link>
          </div>

          {/* Audit Log Card */}
          <div className="bg-white rounded-2xl border border-[#DEE0ED] p-5 shadow-subtle">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-sm font-semibold text-[#252943]">Operations Log</h3>
              <ShieldCheck className="w-4 h-4 text-[#252943]/35" />
            </div>

            {recentAuditLogs.length === 0 ? (
              <p className="text-xs text-[#252943]/40 text-center py-4">No recent activity</p>
            ) : (
              <ul className="space-y-3">
                {recentAuditLogs.map((log) => (
                  <li key={log.id} className="border-b border-[#DEE0ED]/40 pb-3 last:border-none last:pb-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-bold text-[#252943] tracking-wide uppercase">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-[#252943]/40 tabular-nums">
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#252943]/60 leading-relaxed truncate">
                      {log.details}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Scheduler Status Pill */}
          <div className="flex items-center gap-3 bg-white rounded-xl border border-[#DEE0ED] px-4 py-3 shadow-subtle">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3A4EFB] opacity-40" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#3A4EFB]" />
            </span>
            <div>
              <p className="text-xs font-semibold text-[#252943]">Scheduler Online</p>
              <p className="text-[10px] text-[#252943]/45">Idempotent DB-backed step locking</p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED:
      "bg-[#E3FF3B] text-[#252943] font-bold",
    PROCESSING:
      "bg-[#3A4EFB]/12 text-[#3A4EFB] font-semibold",
    SCHEDULED:
      "bg-[#252943] text-white font-semibold",
    PENDING:
      "bg-[#F0F1FA] text-[#252943]/70 font-medium",
    FAILED:
      "bg-red-50 text-red-600 font-semibold",
    CANCELLED:
      "bg-[#DEE0ED]/60 text-[#252943]/60 font-medium",
    REQUIRES_RECONCILIATION:
      "bg-amber-50 text-amber-700 font-semibold",
  };

  const cls = map[status] ?? "bg-[#F0F1FA] text-[#252943]/60 font-medium";

  return (
    <span className={`inline-block text-[10px] tracking-wide px-2 py-0.5 rounded-full ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
