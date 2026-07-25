import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, fmt, getStoredUser } from "@/lib/api";
import Header from "@/components/Header";
import { CreditCard, AlertTriangle, Users, TrendingUp, ChevronRight, ShieldCheck, Target, CheckCircle2, Clock } from "lucide-react";

type TodaySummary = {
  totalAmount: number;
  totalCount: number;
  cashAmount: number;
  upiAmount: number;
  bankAmount: number;
  cardAmount: number;
};

type RecoverySummary = {
  pending: number;
  inProgress: number;
  resolved: number;
  critical: number;
};

type TargetSummary = {
  totalTargetCustomers: number;
  paidCount: number;
  pendingCount: number;
  totalTargetAmount: number;
  collectedAmount: number;
  remainingAmount: number;
  progressPercentage: number;
};

export default function HomePage() {
  const user = getStoredUser();

  const { data: todaySummary } = useQuery<TodaySummary>({
    queryKey: ["today-summary", user?.branchId],
    queryFn: () => api.get(`/collections/today-summary${user?.branchId ? `?branchId=${user.branchId}` : ""}`),
    refetchInterval: 30_000,
  });

  const { data: targetSummary } = useQuery<TargetSummary>({
    queryKey: ["today-target-summary", user?.branchId],
    queryFn: () => api.get(`/collections/today-target-summary${user?.branchId ? `?branchId=${user.branchId}` : ""}`),
    refetchInterval: 30_000,
  });

  const { data: recovery } = useQuery<RecoverySummary>({
    queryKey: ["recovery-summary", user?.branchId],
    queryFn: () => api.get(`/recovery/summary${user?.branchId ? `?branchId=${user.branchId}` : ""}`),
    refetchInterval: 60_000,
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const progress = targetSummary?.progressPercentage ?? 0;

  return (
    <>
      <Header title="Collector Dashboard" />

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Greeting Banner */}
        <div className="bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-card border border-amber-500/30 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <ShieldCheck size={80} className="text-amber-500" />
          </div>
          <p className="text-xs font-bold text-amber-500 dark:text-amber-400 tracking-wider uppercase">
            {greeting()},
          </p>
          <h2 className="text-2xl font-black text-foreground mt-0.5 tracking-tight">
            {user?.name ?? "Collector"}
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {/* TODAY'S COLLECTION TARGET CARD */}
        <div className="bg-card border border-border hover:border-amber-500/40 rounded-2xl p-5 shadow-sm space-y-4 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
                <Target size={22} />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground tracking-tight">Today's Target</h3>
                <p className="text-xs text-muted-foreground font-medium">Daily Collection Target & Progress</p>
              </div>
            </div>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30">
              {progress}% Completed
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-muted-foreground">
                {targetSummary?.paidCount ?? 0} of {targetSummary?.totalTargetCustomers ?? 0} Customers Collected
              </span>
              <span className="text-amber-500 dark:text-amber-400">
                {fmt.currency(targetSummary?.collectedAmount ?? 0)} / {fmt.currency(targetSummary?.totalTargetAmount ?? 0)}
              </span>
            </div>
            <div className="w-full bg-muted/60 rounded-full h-3 overflow-hidden border border-border p-0.5">
              <div
                className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>

          {/* Target Stats Grid */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="bg-muted/30 border border-border p-2.5 rounded-xl text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Target</p>
              <p className="text-sm font-black text-foreground mt-0.5">{fmt.currency(targetSummary?.totalTargetAmount ?? 0)}</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-center">
              <p className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">Collected</p>
              <p className="text-sm font-black text-emerald-500 dark:text-emerald-400 mt-0.5">{fmt.currency(targetSummary?.collectedAmount ?? 0)}</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-center">
              <p className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider">Remaining</p>
              <p className="text-sm font-black text-amber-500 dark:text-amber-400 mt-0.5">{fmt.currency(targetSummary?.remainingAmount ?? 0)}</p>
            </div>
          </div>

          <Link
            href="/collections"
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl py-3 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all text-xs active:scale-[0.99]"
          >
            View Target Customer List ({targetSummary?.pendingCount ?? 0} Pending) <ChevronRight size={16} />
          </Link>
        </div>

        {/* Today's Stats Cards */}
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Payment Summary
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<TrendingUp className="text-emerald-500 dark:text-emerald-400" size={20} />}
              label="Total Collected Today"
              value={fmt.currency(todaySummary?.totalAmount ?? 0)}
              iconBg="bg-emerald-500/15 border-emerald-500/30"
            />
            <StatCard
              icon={<CreditCard className="text-amber-500 dark:text-amber-400" size={20} />}
              label="Payments Recorded"
              value={String(todaySummary?.totalCount ?? 0)}
              iconBg="bg-amber-500/15 border-amber-500/30"
            />
          </div>
        </div>

        {/* Recovery stats */}
        {(recovery?.pending ?? 0) > 0 && (
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Recovery Tasks
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<AlertTriangle className="text-amber-500 dark:text-amber-400" size={20} />}
                label="Pending Tasks"
                value={String(recovery?.pending ?? 0)}
                iconBg="bg-amber-500/15 border-amber-500/30"
              />
              <StatCard
                icon={<AlertTriangle className="text-rose-500 dark:text-rose-400" size={20} />}
                label="Critical Overdue"
                value={String(recovery?.critical ?? 0)}
                iconBg="bg-rose-500/15 border-rose-500/30"
              />
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Quick Actions
          </h3>
          <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
            <QuickLink
              href="/collections"
              icon={<Target className="text-amber-500 dark:text-amber-400" size={20} />}
              label="Today's Target List"
              desc="Collect payments from due target customers"
            />
            <QuickLink
              href="/customers"
              icon={<Users className="text-amber-500 dark:text-amber-400" size={20} />}
              label="Customer Lookup"
              desc="Search customer ledger & phone directory"
            />
            <QuickLink
              href="/recovery"
              icon={<AlertTriangle className="text-amber-500 dark:text-amber-400" size={20} />}
              label="Recovery Operations"
              desc="Manage overdue tasks & call logs"
            />
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconBg: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:border-amber-500/30 transition-all">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border mb-3 ${iconBg}`}>
        {icon}
      </div>
      <p className="text-xl font-black text-foreground leading-none tracking-tight">{value}</p>
      <p className="text-xs font-semibold text-muted-foreground mt-1.5">{label}</p>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight size={16} className="text-muted-foreground shrink-0" />
    </Link>
  );
}
