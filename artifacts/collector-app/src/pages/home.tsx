import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api, fmt, getStoredUser } from "@/lib/api";
import Header from "@/components/Header";
import { CreditCard, AlertTriangle, Users, TrendingUp, ChevronRight } from "lucide-react";

type TodaySummary = {
  total: number;
  count: number;
  cash: number;
  upi: number;
  bank: number;
};

type RecoverySummary = {
  pending: number;
  inProgress: number;
  resolved: number;
  critical: number;
};

export default function HomePage() {
  const user = getStoredUser();

  const { data: todaySummary } = useQuery<TodaySummary>({
    queryKey: ["today-summary", user?.branchId],
    queryFn: () => api.get(`/collections/today-summary${user?.branchId ? `?branchId=${user.branchId}` : ""}`),
    refetchInterval: 60_000,
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

  return (
    <>
      <Header title="Bissi Collector" />

      <div className="p-4 space-y-4">
        {/* Greeting */}
        <div className="bg-indigo-50 rounded-2xl p-4">
          <p className="text-sm text-indigo-500 font-medium">{greeting()},</p>
          <h2 className="text-xl font-bold text-indigo-900">{user?.name ?? "Collector"}</h2>
          <p className="text-xs text-indigo-400 mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {/* Today's stats */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Today's Collections</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<TrendingUp className="text-green-600" size={20} />}
              label="Total Collected"
              value={fmt.currency(todaySummary?.total ?? 0)}
              bg="bg-green-50"
            />
            <StatCard
              icon={<CreditCard className="text-indigo-600" size={20} />}
              label="Payments Made"
              value={String(todaySummary?.count ?? 0)}
              bg="bg-indigo-50"
            />
          </div>
        </div>

        {/* Recovery stats */}
        {(recovery?.pending ?? 0) > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recovery Tasks</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<AlertTriangle className="text-amber-600" size={20} />}
                label="Pending"
                value={String(recovery?.pending ?? 0)}
                bg="bg-amber-50"
              />
              <StatCard
                icon={<AlertTriangle className="text-red-600" size={20} />}
                label="Critical"
                value={String(recovery?.critical ?? 0)}
                bg="bg-red-50"
              />
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Actions</h3>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            <QuickLink href="/collections" icon={<CreditCard className="text-indigo-600" size={20} />} label="Today's Collections" desc="View and record payments" />
            <QuickLink href="/customers" icon={<Users className="text-indigo-600" size={20} />} label="Customer Lookup" desc="Search customer by name or phone" />
            <QuickLink href="/recovery" icon={<AlertTriangle className="text-amber-500" size={20} />} label="Recovery Tasks" desc="View overdue payment tasks" />
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
  return (
    <div className={`${bg} rounded-2xl p-4`}>
      <div className="mb-2">{icon}</div>
      <p className="text-2xl font-bold text-gray-800 leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function QuickLink({ href, icon, label, desc }: { href: string; icon: React.ReactNode; label: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50">
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </Link>
  );
}
