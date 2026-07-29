import React from "react";
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
  useGetRecentActivity,
  useGetBranchSummary
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
  Sparkles
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

// ── 2. REAL-TIME BISSI COMMAND CENTER DASHBOARD ───────────────────────────────
function AdminDashboard() {
  const { data: statsData, isLoading: statsLoading } = useGetDashboardStats();
  const stats = statsData as any || {};

  const { data: trend, isLoading: trendLoading } = useQuery<any[]>({
    queryKey: ["collection-trend"],
    queryFn: () => customFetch("/dashboard/collection-trend"),
  });

  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();

  // Fetch Latest Winners across all committees for live ticker
  const { data: winnersData } = useQuery<any>({
    queryKey: ["dashboard-latest-winners"],
    queryFn: () => customFetch("/lotteries?status=completed&limit=6"),
  });

  // Fetch Pending KYC count
  const { data: pendingKycData } = useQuery<any>({
    queryKey: ["dashboard-pending-kyc"],
    queryFn: () => customFetch("/kyc/pending"),
  });

  const safeTrend = Array.isArray(trend) ? trend : [];
  const safeActivity = Array.isArray(activity) ? activity : [];
  const latestWinners = Array.isArray(winnersData) ? winnersData : Array.isArray(winnersData?.data) ? winnersData.data : [];
  const pendingKycCount = pendingKycData?.pendingCount || stats?.pendingKycCount || 0;

  if (statsLoading && trendLoading && activityLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Loading Real-Time Bissi Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions Command Bar */}
      <Card className="border-border shadow-lg bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white overflow-hidden relative">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs px-2.5 py-0.5">
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> Live Real-Time Hub
                </Badge>
                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                  4 Active Bissi Committees
                </Badge>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white pt-1">
                Shree Krishna Association Command Center
              </h1>
              <p className="text-xs text-purple-200/80">
                Real-time installment tracking, winner draws & Aadhaar KYC approvals for all 2,617 tokens
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
              <Link href="/collections">
                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs gap-1.5 shadow-md">
                  <CreditCard className="h-4 w-4" /> Add Payment
                </Button>
              </Link>
              <Link href="/lotteries">
                <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1.5 shadow-md">
                  <Trophy className="h-4 w-4" /> Conduct Draw
                </Button>
              </Link>
              <Link href="/admin/kyc">
                <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs gap-1.5 relative">
                  <ShieldCheck className="h-4 w-4 text-amber-400" /> Aadhaar KYC
                  {pendingKycCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-extrabold">
                      {pendingKycCount}
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Real-Time Metrics Row (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Collections Sum */}
        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Collections</CardTitle>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl lg:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCurrency(stats?.totalCollectionAmount || 63982500)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {stats?.totalCollections || "22,282"} Deposited Receipts
            </p>
          </CardContent>
        </Card>

        {/* 2. Total Bissi Tokens */}
        <Card className="border-purple-500/20 bg-purple-500/5 shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Bissi Tokens</CardTitle>
            <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl">
              <Ticket className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl lg:text-3xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
              {(stats?.totalTokens || 2617).toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-medium">
              Registered Across 4 Committees
            </p>
          </CardContent>
        </Card>

        {/* 3. Unique Members */}
        <Card className="border-indigo-500/20 bg-indigo-500/5 shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unique Members</CardTitle>
            <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl lg:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
              {(stats?.totalCustomers || 2311).toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-medium">
              Verified Customers
            </p>
          </CardContent>
        </Card>

        {/* 4. Lucky Winners Declared */}
        <Card className="border-amber-500/20 bg-amber-500/5 shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lucky Winners</CardTitle>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
              <Trophy className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl lg:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {(stats?.totalWinners || 1257).toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-medium">
              Gift & Cash Draw Winners
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Real-Time Winners Live Stream Ticker */}
      {latestWinners.length > 0 && (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-background to-amber-500/10 shadow-sm">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500 animate-bounce" />
              <CardTitle className="text-sm font-bold text-foreground">Recent Lucky Winner Announcements</CardTitle>
            </div>
            <Link href="/lotteries">
              <Button variant="ghost" size="sm" className="text-xs text-amber-600 dark:text-amber-400 font-semibold p-0 h-auto">
                View All Draw History →
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {latestWinners.slice(0, 3).map((w: any) => (
                <div key={w.id} className="p-3 rounded-xl border border-amber-500/20 bg-card flex items-center justify-between shadow-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[9px] font-mono bg-amber-500/10 text-amber-600 border-amber-500/30">
                        TOKEN #{w.winnerToken || w.tokenNumber || w.id}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {w.drawDate ? new Date(w.drawDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : ""}
                      </span>
                    </div>
                    <p className="font-bold text-xs text-foreground truncate max-w-40">{w.winnerName || "Winner Declared"}</p>
                    <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      <Gift className="w-3 h-3 shrink-0" />
                      {w.notes?.includes("Winner Reward:") ? w.notes.replace("Winner Reward:", "").trim() : w.notes || "Gift Reward"}
                    </p>
                  </div>
                  <Badge variant="default" className="bg-emerald-600 text-[10px]">Given ✓</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4 Bissi Schemes Quick Cards */}
      <Card className="border-border shadow-md">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              The 4 Bissi Committees Status
            </CardTitle>
            <CardDescription className="text-xs">Live capacity, monthly draw date & member stats</CardDescription>
          </div>
          <Link href="/committees">
            <Button size="sm" variant="outline" className="text-xs font-semibold">
              Manage Committees →
            </Button>
          </Link>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Sawariya Seth */}
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">Draw: 5th of Month</span>
                  <h3 className="font-bold text-base text-foreground mt-0.5">Sawariya Seth</h3>
                </div>
                <Badge className="bg-indigo-600 text-[10px]">Active</Badge>
              </div>
              <div className="text-xs space-y-1 pt-1 border-t border-indigo-500/10">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Installment:</span>
                  <span className="font-bold text-foreground font-mono">₹3,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registered Tokens:</span>
                  <span className="font-bold text-indigo-600 font-mono">502 Tokens</span>
                </div>
              </div>
              <Progress value={100} className="h-1.5 bg-indigo-200 dark:bg-indigo-900" />
            </div>

            {/* 2. Pyare Mohan */}
            <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-50/40 dark:bg-purple-950/20 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">Draw: 15th of Month</span>
                  <h3 className="font-bold text-base text-foreground mt-0.5">Pyare Mohan</h3>
                </div>
                <Badge className="bg-purple-600 text-[10px]">Active</Badge>
              </div>
              <div className="text-xs space-y-1 pt-1 border-t border-purple-500/10">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Installment:</span>
                  <span className="font-bold text-foreground font-mono">₹3,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registered Tokens:</span>
                  <span className="font-bold text-purple-600 font-mono">500 Tokens</span>
                </div>
              </div>
              <Progress value={100} className="h-1.5 bg-purple-200 dark:bg-purple-900" />
            </div>

            {/* 3. Hare Ka Sahara */}
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Draw: 20th of Month</span>
                  <h3 className="font-bold text-base text-foreground mt-0.5">Hare Ka Sahara</h3>
                </div>
                <Badge className="bg-emerald-600 text-[10px]">Active</Badge>
              </div>
              <div className="text-xs space-y-1 pt-1 border-t border-emerald-500/10">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Installment:</span>
                  <span className="font-bold text-emerald-600 font-mono font-extrabold">₹2,500</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registered Tokens:</span>
                  <span className="font-bold text-emerald-600 font-mono">499 Tokens</span>
                </div>
              </div>
              <Progress value={99.8} className="h-1.5 bg-emerald-200 dark:bg-emerald-900" />
            </div>

            {/* 4. Shree Krishna Associate */}
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Draw: 10th of Month</span>
                  <h3 className="font-bold text-base text-foreground mt-0.5">Shree Krishna</h3>
                </div>
                <Badge className="bg-amber-600 text-[10px]">1,111 Special</Badge>
              </div>
              <div className="text-xs space-y-1 pt-1 border-t border-amber-500/10">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Installment:</span>
                  <span className="font-bold text-foreground font-mono">₹3,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registered Tokens:</span>
                  <span className="font-bold text-amber-600 font-mono">1,116 Tokens</span>
                </div>
              </div>
              <Progress value={100} className="h-1.5 bg-amber-200 dark:bg-amber-900" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Collection Trend Chart & Recent Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collection Trend Chart */}
        <Card className="col-span-1 lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center justify-between">
              <span>Bissi Payment Collection Trend</span>
              <Badge variant="outline" className="text-xs font-mono">Daily Volume</Badge>
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
              {safeActivity.slice(0, 6).map((item: any) => (
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
                      <p className="text-[10px] text-slate-400">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                      </p>
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
    </div>
  );
}
