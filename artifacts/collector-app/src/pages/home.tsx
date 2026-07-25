import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, fmt, getStoredUser } from "@/lib/api";
import { safeArray } from "@/lib/utils";
import Header from "@/components/Header";
import {
  CreditCard,
  AlertTriangle,
  Users,
  TrendingUp,
  ChevronRight,
  Target,
  CheckCircle2,
  Wallet,
  Smartphone,
  Building2,
  BookOpen,
  Sparkles,
  ArrowRight,
  Zap,
  HandCoins,
  Search,
  Phone,
  FileText,
} from "lucide-react";

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

  // Fetch total customers count
  const { data: customersData } = useQuery<any>({
    queryKey: ["customers-count"],
    queryFn: () => api.get("/customers?limit=1"),
  });
  const totalCustomers = Array.isArray(customersData)
    ? customersData.length
    : (customersData as any)?.total ?? (customersData as any)?.count ?? 0;

  // Fetch recent collections
  const { data: rawRecentCollections } = useQuery<any>({
    queryKey: ["recent-collections"],
    queryFn: () => api.get("/collections?limit=5"),
  });
  const recentCollections = safeArray<any>(rawRecentCollections).slice(0, 5);

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

      <div className="p-4 space-y-5 max-w-lg mx-auto">
        {/* ── Premium Greeting Banner ── */}
        <div
          className="rounded-2xl p-5 relative overflow-hidden float-up border"
          style={{
            background: "linear-gradient(135deg, rgba(212, 160, 23, 0.15) 0%, rgba(212, 160, 23, 0.05) 50%, rgba(20, 10, 8, 0.02) 100%)",
            borderColor: "rgba(212, 160, 23, 0.25)",
          }}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-amber-500 dark:text-amber-400 tracking-[0.2em] uppercase">
                {greeting()},
              </p>
              <h2 className="text-2xl font-extrabold text-foreground mt-1 tracking-tight">
                {user?.name ?? "Collector"}
              </h2>
              <p className="text-xs text-muted-foreground font-medium mt-1.5 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/10 border border-amber-500/15 flex items-center justify-center">
              <Sparkles className="text-amber-500 dark:text-amber-400" size={28} />
            </div>
          </div>

          {/* Quick stats row */}
          <div className="relative z-10 flex items-center gap-3 mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Users size={13} className="text-amber-500 dark:text-amber-400/70" />
              <span className="text-xs font-bold text-muted-foreground">{totalCustomers || "—"} Customers</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5">
              <HandCoins size={13} className="text-amber-500 dark:text-amber-400/70" />
              <span className="text-xs font-bold text-muted-foreground">{todaySummary?.totalCount ?? 0} Today</span>
            </div>
          </div>
        </div>

        {/* ── TODAY'S COLLECTION TARGET CARD ── */}
        <div className="glass-card rounded-2xl p-5 space-y-4 float-up-delay-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-650/15 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400">
                <Target size={22} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-foreground dark:text-white tracking-tight">Today's Target</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Daily Collection Progress</p>
              </div>
            </div>
            <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${
              progress >= 100
                ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/20"
                : progress > 50
                  ? "bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/20"
                  : "bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-550/10"
            }`}>
              {progress}% Done
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-500 dark:text-slate-400">
                {targetSummary?.paidCount ?? 0} of {targetSummary?.totalTargetCustomers ?? 0} Collected
              </span>
              <span className="text-amber-500 dark:text-amber-400">
                {fmt.currency(targetSummary?.collectedAmount ?? 0)} / {fmt.currency(targetSummary?.totalTargetAmount ?? 0)}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800/60 rounded-full h-3 overflow-hidden border border-border dark:border-slate-700/50 p-0.5">
              <div
                className="bg-gradient-to-r from-amber-450 via-amber-500 to-emerald-550 h-full rounded-full transition-all duration-700 shadow-sm shadow-amber-500/30"
                style={{ width: `${Math.min(100, Math.max(2, progress))}%` }}
              />
            </div>
          </div>

          {/* Target Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/40 p-2.5 rounded-xl text-center">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Target</p>
              <p className="text-sm font-extrabold text-foreground dark:text-white mt-0.5">{fmt.currency(targetSummary?.totalTargetAmount ?? 0)}</p>
            </div>
            <div className="bg-emerald-500/8 border border-emerald-500/15 p-2.5 rounded-xl text-center">
              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Collected</p>
              <p className="text-sm font-extrabold text-emerald-500 dark:text-emerald-450 mt-0.5">{fmt.currency(targetSummary?.collectedAmount ?? 0)}</p>
            </div>
            <div className="bg-amber-500/8 border border-amber-500/15 p-2.5 rounded-xl text-center">
              <p className="text-[9px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider">Remaining</p>
              <p className="text-sm font-extrabold text-amber-500 dark:text-amber-400 mt-0.5">{fmt.currency(targetSummary?.remainingAmount ?? 0)}</p>
            </div>
          </div>

          <Link
            href="/collections"
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-550 text-slate-950 font-bold rounded-xl py-3 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all text-xs active:scale-[0.98]"
          >
            <Zap size={14} /> View Target List ({targetSummary?.pendingCount ?? 0} Pending) <ChevronRight size={16} />
          </Link>
        </div>

        {/* ── Payment Summary ── */}
        <div className="float-up-delay-2">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2.5 px-1 flex items-center gap-1.5">
            <TrendingUp size={12} /> Payment Summary
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<TrendingUp className="text-emerald-500" size={20} />}
              label="Total Collected"
              value={fmt.currency(todaySummary?.totalAmount ?? 0)}
              gradientFrom="from-emerald-500/10"
              gradientTo="to-emerald-500/5"
              borderColor="border-emerald-500/15"
            />
            <StatCard
              icon={<CreditCard className="text-amber-500 dark:text-amber-400" size={20} />}
              label="Payments Done"
              value={String(todaySummary?.totalCount ?? 0)}
              gradientFrom="from-amber-500/10"
              gradientTo="to-amber-500/5"
              borderColor="border-amber-500/15"
            />
          </div>

          {/* Payment mode breakdown */}
          {(todaySummary?.totalCount ?? 0) > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-3">
              <MiniStat icon={<Wallet size={14} />} label="Cash" value={fmt.currency(todaySummary?.cashAmount ?? 0)} />
              <MiniStat icon={<Smartphone size={14} />} label="UPI" value={fmt.currency(todaySummary?.upiAmount ?? 0)} />
              <MiniStat icon={<Building2 size={14} />} label="Bank" value={fmt.currency(todaySummary?.bankAmount ?? 0)} />
              <MiniStat icon={<CreditCard size={14} />} label="Card" value={fmt.currency(todaySummary?.cardAmount ?? 0)} />
            </div>
          )}
        </div>

        {/* ── Recovery Stats ── */}
        {(recovery?.pending ?? 0) > 0 && (
          <div className="float-up-delay-3">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2.5 px-1 flex items-center gap-1.5">
              <AlertTriangle size={12} /> Recovery Tasks
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<AlertTriangle className="text-amber-500" size={20} />}
                label="Pending Tasks"
                value={String(recovery?.pending ?? 0)}
                gradientFrom="from-amber-500/10"
                gradientTo="to-amber-500/5"
                borderColor="border-amber-500/15"
              />
              <StatCard
                icon={<AlertTriangle className="text-rose-500" size={20} />}
                label="Critical Overdue"
                value={String(recovery?.critical ?? 0)}
                gradientFrom="from-rose-500/10"
                gradientTo="to-rose-500/5"
                borderColor="border-rose-500/15"
              />
            </div>
          </div>
        )}

        {/* ── Recent Collections ── */}
        {recentCollections.length > 0 && (
          <div className="float-up-delay-3">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2.5 px-1 flex items-center gap-1.5">
              <BookOpen size={12} /> Recent Collections
            </h3>
            <div className="glass-card rounded-2xl divide-y divide-slate-200 dark:divide-slate-700/30 overflow-hidden">
              {recentCollections.map((c: any, i: number) => (
                <div key={c.id ?? i} className="flex items-center justify-between px-4 py-3 bg-card">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0">
                      <HandCoins size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground dark:text-white truncate">{c.customerName ?? `Customer #${c.customerId}`}</p>
                      <p className="text-[10px] text-slate-500">{c.paymentMode ?? "cash"} · {c.collectedAt ? fmt.shortDate(c.collectedAt) : "Today"}</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-500 shrink-0 ml-2">
                    {fmt.currency(typeof c.amount === "string" ? parseFloat(c.amount) : c.amount ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Actions ── */}
        <div className="float-up-delay-4">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2.5 px-1 flex items-center gap-1.5">
            <Zap size={12} /> Quick Actions
          </h3>
          <div className="glass-card rounded-2xl divide-y divide-slate-200 dark:divide-slate-700/30 overflow-hidden">
            <QuickLink
              href="/collections"
              icon={<Target className="text-amber-500 dark:text-amber-400" size={20} />}
              label="Today's Target List"
              desc="Collect payments from due customers"
              color="amber"
            />
            <QuickLink
              href="/customers"
              icon={<Search className="text-amber-500 dark:text-amber-400" size={20} />}
              label="Customer Directory"
              desc="Search customer ledger & phone book"
              color="amber"
            />
            <QuickLink
              href="/recovery"
              icon={<Phone className="text-amber-500 dark:text-amber-400" size={20} />}
              label="Recovery Operations"
              desc="Manage overdue tasks & call logs"
              color="amber"
            />
            <QuickLink
              href="/kyc"
              icon={<FileText className="text-amber-500 dark:text-amber-400" size={20} />}
              label="KYC Verification"
              desc="Submit & track customer KYC documents"
              color="amber"
            />
          </div>
        </div>

        {/* ── How to Use Guide ── */}
        <div className="float-up-delay-4">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2.5 px-1 flex items-center gap-1.5">
            <BookOpen size={12} /> How to Use This App
          </h3>
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <GuideStep
              step={1}
              title="View Today's Target"
              desc="Go to Collections tab to see today's assigned customers and their due amounts."
            />
            <GuideStep
              step={2}
              title="Collect Payment"
              desc="Tap on a customer → Enter amount → Select payment mode (Cash/UPI/Bank) → Submit."
            />
            <GuideStep
              step={3}
              title="Search Customers"
              desc="Use Customers tab to search any customer by name or mobile number."
            />
            <GuideStep
              step={4}
              title="Recovery Tasks"
              desc="Check Recovery tab for overdue payments and make recovery calls."
            />
          </div>
        </div>

        {/* Spacer for bottom nav */}
        <div className="h-4" />
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  gradientFrom,
  gradientTo,
  borderColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  gradientFrom: string;
  gradientTo: string;
  borderColor: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${gradientFrom} ${gradientTo} border ${borderColor} rounded-2xl p-4 transition-all bg-card`}>
      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/40 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-xl font-extrabold text-foreground dark:text-white leading-none tracking-tight">{value}</p>
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5">{label}</p>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-100 dark:bg-slate-800/30 border border-border dark:border-slate-700/30 rounded-xl p-2 text-center">
      <div className="text-slate-500 dark:text-slate-400 flex items-center justify-center mb-1">{icon}</div>
      <p className="text-[10px] font-bold text-foreground dark:text-white truncate">{value}</p>
      <p className="text-[9px] text-slate-500 font-medium">{label}</p>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
  desc,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
  color: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-100 dark:hover:bg-slate-800/30 active:bg-slate-200 dark:active:bg-slate-800/50 transition-all bg-card">
      <div className={`w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground dark:text-white">{label}</p>
        <p className="text-[11px] text-slate-550 dark:text-slate-500">{desc}</p>
      </div>
      <ArrowRight size={16} className="text-slate-400 shrink-0" />
    </Link>
  );
}

function GuideStep({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 text-xs font-extrabold shrink-0 mt-0.5">
        {step}
      </div>
      <div>
        <p className="text-xs font-bold text-foreground dark:text-white">{title}</p>
        <p className="text-[11px] text-slate-550 dark:text-slate-550 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
