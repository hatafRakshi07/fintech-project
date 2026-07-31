import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useRole } from "@/hooks/use-role";
import { customFetch } from "@workspace/api-client-react";
import CustomerPortalPage from "@/pages/customer-portal";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  useGetDashboardStats, 
  useGetRecentActivity
} from "@workspace/api-client-react";
import { 
  Users, 
  Wallet, 
  CreditCard, 
  TrendingUp, 
  ShieldAlert, 
  ArrowRight, 
  Ticket,
  Trophy,
  Gift,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  PlusCircle,
  Sparkles,
  AlertCircle,
  ChevronRight,
  Filter,
  Printer
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { format } from "date-fns";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
};

export default function DashboardPage() {
  const { isCollector, isCustomer } = useRole();

  if (isCollector) {
    return <CollectorDashboard user={{ name: "Field Collector" }} />;
  }

  if (isCustomer) {
    return <CustomerPortalPage />;
  }

  return <AdminDashboard />;
}

// ── 1. COLLECTOR DASHBOARD PANEL ──────────────────────────────────────────
function CollectorDashboard({ user }: { user: any }) {
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const { data: todaySummary } = useQuery<{
    total: number;
    count: number;
    cash: number;
    upi: number;
  }>({
    queryKey: ["collector", "today-summary", user?.branchId],
    queryFn: () => customFetch(`/collections/today-summary${user?.branchId ? `?branchId=${user.branchId}` : ""}`),
  });

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-900 text-white rounded-2xl p-6 shadow-md">
        <p className="text-xs opacity-75 font-medium">{greeting()},</p>
        <h2 className="text-2xl font-bold mt-1">{user?.name ?? "Field Collector"}</h2>
        <Badge className="mt-2 bg-indigo-500/30 text-indigo-100 hover:bg-indigo-500/30">
          Shree Krishna Association (Bissi Portal)
        </Badge>
        <p className="text-[10px] opacity-60 mt-3">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Today's Bissi Collections</h3>
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-emerald-500/5 border-emerald-500/10">
            <CardContent className="p-4 space-y-1">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <div className="text-xl font-bold font-mono">{formatCurrency(todaySummary?.total ?? 0)}</div>
              <p className="text-[10px] text-muted-foreground">Total Collected</p>
            </CardContent>
          </Card>

          <Card className="bg-indigo-500/5 border-indigo-500/10">
            <CardContent className="p-4 space-y-1">
              <CreditCard className="h-5 w-5 text-indigo-500" />
              <div className="text-xl font-bold font-mono">{todaySummary?.count ?? 0}</div>
              <p className="text-[10px] text-muted-foreground">Bissi Receipts</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Bissi Navigation</h3>
        <Card className="divide-y divide-border">
          <Link href="/collections">
            <div className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Bissi Collections</div>
                  <div className="text-[10px] text-muted-foreground">Record daily Bissi installments</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>

          <Link href="/customers">
            <div className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Bissi Members (Customers)</div>
                  <div className="text-[10px] text-muted-foreground">Lookup member details & tokens</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        </Card>
      </div>
    </div>
  );
}

// ── 2. REAL-TIME BISSI MASTER COMMAND CENTER DASHBOARD ──────────────────────────
function AdminDashboard() {
  const [timeFilter, setTimeFilter] = useState("all");

  // Load KPI Stats
  const { data: statsData, isLoading: statsLoading } = useGetDashboardStats();
  const stats = statsData as any || {};

  // Load Per-Scheme Operational Boxes Data (Sawariya, Pyare Mohan, Hare Ka Sahara, Shree Krishna)
  const { data: schemeBoxesData, isLoading: schemesLoading } = useQuery<any>({
    queryKey: ["dashboard-scheme-boxes"],
    queryFn: () => customFetch("/dashboard/scheme-boxes"),
  });

  // Load Collection Trend Chart Data
  const { data: trend } = useQuery<any[]>({
    queryKey: ["collection-trend"],
    queryFn: () => customFetch("/dashboard/collection-trend"),
  });

  // Load Recent Activity (Collections Feed)
  const { data: activity } = useGetRecentActivity();

  // Load Pending KYC Count
  const { data: pendingKycData } = useQuery<any>({
    queryKey: ["dashboard-pending-kyc"],
    queryFn: () => customFetch("/kyc/pending"),
  });

  const schemes = Array.isArray(schemeBoxesData?.schemes) ? schemeBoxesData.schemes : Array.isArray(schemeBoxesData?.data) ? schemeBoxesData.data : [];
  const safeTrend = Array.isArray(trend) ? trend : [];
  const safeActivity = Array.isArray(activity) ? activity : [];
  const pendingKycCount = pendingKycData?.pendingCount || stats?.pendingKycCount || 0;

  if (statsLoading && schemesLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Loading Operational Command Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner Header & Time Filter */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Operational Dashboard</h1>
            <Badge variant="outline" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-xs px-2 py-0.5">
              4 BISSI SCHEMES
            </Badge>
          </div>
          <p className="text-xs text-purple-200/80 mt-1">Real-time overview of all active Bissi schemes, collections & member tokens</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Time Filter Select */}
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
            <Filter className="w-3.5 h-3.5 text-amber-300" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Time Overview</option>
              <option value="month" className="bg-slate-900 text-white">This Month (Draw Pool)</option>
              <option value="today" className="bg-slate-900 text-white">Today's Collections</option>
            </select>
          </div>

          <Link href="/admin/kyc">
            <Button size="sm" variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 text-xs gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              KYC Review
              {pendingKycCount > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-extrabold">
                  {pendingKycCount}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Top 4 Metric Boxes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Active Bissi Schemes */}
        <Card className="border-indigo-500/20 bg-indigo-500/5 shadow-xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bissi Schemes</CardTitle>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl lg:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">4 Active</div>
            <p className="text-[11px] text-muted-foreground mt-1 font-medium truncate">
              Shree Krishna, Sawariya, Pyare, Hare
            </p>
          </CardContent>
        </Card>

        {/* 2. Total Member Limit / Active Tokens */}
        <Card className="border-purple-500/20 bg-purple-500/5 shadow-xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Member Tokens</CardTitle>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl lg:text-3xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
              {(stats?.totalTokens || 2617).toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-medium truncate">
              1116 SKA + 502 Sawariya + 500 Pyare + 499 Hare
            </p>
          </CardContent>
        </Card>

        {/* 3. Unique Customers */}
        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Verified Members</CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Ticket className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl lg:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {(stats?.totalCustomers || 2311).toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-medium truncate">
              Registered Customers in Database
            </p>
          </CardContent>
        </Card>

        {/* 4. Total Collections */}
        <Card className="border-amber-500/20 bg-amber-500/5 shadow-xs">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Collections</CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl lg:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {formatCurrency(stats?.totalCollectionAmount || 63982500)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-medium truncate">
              {(stats?.totalCollections || 22282).toLocaleString("en-IN")} transaction receipts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Scheme Operational Boxes Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Scheme Operational Boxes</h2>
        </div>

        <div className="space-y-6">
          {schemes.map((scheme: any, idx: number) => {
            const tagLabel = `BISSI-${idx + 1}`;
            const drawDateText = scheme.id === 1 ? "5th Date" : scheme.id === 2 ? "15th Date" : scheme.id === 3 ? "20th Date" : "10th Date (Lottery)";

            return (
              <Card key={scheme.id} className="border-border shadow-md overflow-hidden bg-card">
                {/* Box Header */}
                <CardHeader className="p-4 bg-muted/40 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-foreground">{scheme.name}</h3>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase font-bold bg-primary/10 text-primary border-primary/20">
                      {tagLabel}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs bg-indigo-500/10 text-indigo-600 border-indigo-500/20 font-medium">
                      Filled Tokens: {scheme.filledTokens || scheme.tokenCount || 500} / {scheme.memberLimit || 500}
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-rose-500/10 text-rose-600 border-rose-500/20 font-medium">
                      Pending Tokens: {scheme.pendingTokens || 0}
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                      Installment: ₹{scheme.installmentAmount}/month
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20 font-medium">
                      Draw: {drawDateText}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-5">
                  {/* 4 Stat Boxes inside Scheme */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Collected Amount */}
                    <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <span>Total Collected</span>
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div className="text-xl lg:text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(scheme.collectedAmount)}
                      </div>
                      <Link href={`/collections?committeeId=${scheme.id}`}>
                        <span className="text-[11px] font-semibold text-emerald-600 hover:underline flex items-center gap-0.5 cursor-pointer pt-1">
                          View transactions →
                        </span>
                      </Link>
                    </div>

                    {/* Filled vs Pending Tokens */}
                    <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        <span>Tokens Fill / Pending</span>
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div className="text-lg font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                        {scheme.filledTokens || scheme.tokenCount} Filled / {scheme.pendingTokens || 0} Pending
                      </div>
                      <Link href={`/committees/${scheme.id}`}>
                        <span className="text-[11px] font-semibold text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer pt-1">
                          Manage tokens →
                        </span>
                      </Link>
                    </div>

                    {/* Due / Pending Amount */}
                    <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold text-rose-600 dark:text-rose-400">
                        <span>Due / Pending Amount</span>
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div className="text-xl lg:text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400">
                        {formatCurrency(scheme.dueAmount || 0)}
                      </div>
                      <Link href={`/committees/${scheme.id}`}>
                        <span className="text-[11px] font-semibold text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer pt-1">
                          View pending →
                        </span>
                      </Link>
                    </div>

                    {/* Member Limit / Total Winners */}
                    <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        <span>Winners Declared</span>
                        <Trophy className="w-4 h-4" />
                      </div>
                      <div className="text-xl lg:text-2xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                        {scheme.winnersCount || 0} Winners
                      </div>
                      <Link href="/lotteries">
                        <span className="text-[11px] font-semibold text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer pt-1">
                          View winners history →
                        </span>
                      </Link>
                    </div>
                  </div>

                  {/* Monthly Collection Breakdown for this Committee */}
                  {scheme.monthlyBreakdown && scheme.monthlyBreakdown.length > 0 && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border/60">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Monthly Collections Breakdown</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {scheme.monthlyBreakdown.slice(0, 8).map((mb: any, mIdx: number) => (
                          <div key={mIdx} className="p-2 rounded-lg bg-background border text-xs">
                            <span className="text-muted-foreground block text-[10px] font-semibold">{mb.month}</span>
                            <span className="font-bold font-mono text-emerald-600">{formatCurrency(mb.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Latest Winner Card for this Committee */}
                  {scheme.latestWinnerName && (
                    <div className="p-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 border border-amber-500/30 shrink-0">
                          <Trophy className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">Latest Winner: {scheme.latestWinnerName}</span>
                            <Badge variant="outline" className="font-mono text-[10px] bg-amber-500/20 text-amber-600 border-amber-500/30">
                              TOKEN #{scheme.latestWinnerToken || "—"}
                            </Badge>
                          </div>
                          <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
                            {scheme.latestReward?.includes("Winner Reward:") ? scheme.latestReward.replace("Winner Reward:", "").trim() : scheme.latestReward || "Lucky Winner Package"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground self-end sm:self-center">
                        <span>Draw Date: {scheme.latestDrawDate ? new Date(scheme.latestDrawDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}</span>
                        <Link href="/lotteries">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-600 font-bold p-0">
                            Draw Details →
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Grid: Live Collection Trend Chart & Recent Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collection Trend Chart */}
        <Card className="col-span-1 lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center justify-between">
              <span>Bissi Payment Collection Trend</span>
              <Badge variant="outline" className="text-xs font-mono">Daily Receipts</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Daily installment payments collected across all 4 committees
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={safeTrend} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => {
                      try { return format(new Date(val), 'MMM dd'); } catch { return val; }
                    }} 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val/1000}k`}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Collections']}
                    labelFormatter={(label) => {
                      try { return format(new Date(label), 'MMM dd, yyyy'); } catch { return label; }
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3} 
                    dot={false}
                    activeDot={{ r: 6, fill: "hsl(var(--secondary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Live Recent Transactions Feed */}
        <Card className="col-span-1 shadow-md">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Recent Installment Receipts</CardTitle>
              <CardDescription className="text-xs">Latest member payments</CardDescription>
            </div>
            <Link href="/collections">
              <Button variant="ghost" size="sm" className="text-xs text-primary p-0 h-auto font-semibold">
                View All →
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {safeActivity.slice(0, 7).map((item: any) => (
                <div key={item.id} className="flex items-start justify-between pb-3 border-b border-border/40 last:border-0 last:pb-0">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 p-2 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-foreground leading-tight">
                        {item.customerName || "Bissi Member"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.description || "Installment Receipt"}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}</span>
                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono uppercase bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          {item.paymentMode || "CASH"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Printable Pending Tokens & Members Report Section */}
      <PendingReportCard />
    </div>
  );
}

function PendingReportCard() {
  const { data: pendingData, isLoading } = useQuery<{ success: boolean; pendingList: any[]; totalPending: number }>({
    queryKey: ["dashboard-pending-report"],
    queryFn: () => customFetch("/dashboard/pending-report"),
  });

  const pendingList = pendingData?.pendingList || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <Card className="shadow-md border-rose-500/20">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-rose-500/5">
        <div>
          <CardTitle className="text-lg font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            Pending Members & Tokens Report
          </CardTitle>
          <CardDescription className="text-xs">
            List of assigned tokens with pending installment payments ({pendingList.length} Records)
          </CardDescription>
        </div>
        <Button onClick={handlePrint} size="sm" className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 shadow-sm">
          <Printer className="w-4 h-4" />
          Print Pending List
        </Button>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading pending report list...</p>
        ) : pendingList.length === 0 ? (
          <p className="text-xs text-muted-foreground">No pending tokens found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted text-muted-foreground text-left border-b">
                  <th className="p-2 font-bold">Token #</th>
                  <th className="p-2 font-bold">Bissi Scheme</th>
                  <th className="p-2 font-bold">Member Name</th>
                  <th className="p-2 font-bold">Mobile</th>
                  <th className="p-2 font-bold">Ref No</th>
                  <th className="p-2 font-bold text-right">Installment</th>
                </tr>
              </thead>
              <tbody>
                {pendingList.slice(0, 50).map((item: any, idx: number) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono font-bold text-indigo-600">#{item.tokenNumber}</td>
                    <td className="p-2 font-semibold">{item.committeeName}</td>
                    <td className="p-2 font-bold text-foreground">{item.customerName}</td>
                    <td className="p-2 font-mono">{item.customerMobile || "N/A"}</td>
                    <td className="p-2 font-mono text-muted-foreground">{item.referenceNumber || "—"}</td>
                    <td className="p-2 text-right font-mono font-bold text-rose-600">₹{item.installmentAmount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pendingList.length > 50 && (
              <p className="text-[11px] text-muted-foreground mt-2 text-center">
                Showing top 50 of {pendingList.length} pending members. Click <b>Print Pending List</b> to view/print the complete document.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
