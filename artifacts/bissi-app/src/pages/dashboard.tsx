import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useRole } from "@/hooks/use-role";
import { customFetch } from "@workspace/api-client-react";
import CustomerPortalPage from "@/pages/customer-portal";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Ticket 
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
  }).format(amount);
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

// ── 2. ADMINISTRATIVE/FINANCE DASHBOARD PANEL (BISSI ONLY) ───────────────────
function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: trend, isLoading: trendLoading } = useQuery<any[]>({
    queryKey: ["collection-trend"],
    queryFn: () => customFetch("/dashboard/collection-trend"),
  });
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: branchSummary, isLoading: branchLoading } = useGetBranchSummary();

  const safeTrend = Array.isArray(trend) ? trend : [];
  const safeActivity = Array.isArray(activity) ? activity : [];

  if (statsLoading && trendLoading && activityLoading && branchLoading) {
    return <div className="h-full flex items-center justify-center">Loading Bissi Dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bissi Overview</h1>
          <p className="text-muted-foreground">Shree Krishna Association — 4 Bissi Schemes Management Dashboard.</p>
        </div>
        <Link href="/committees">
          <Button variant="default" className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow">
            <ShieldAlert className="h-4 w-4" /> View 4 Bissi Schemes
          </Button>
        </Link>
      </div>

      {/* KPI Cards — 4-col focusing ONLY ON BISSI DATA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <Card className="border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground leading-tight">Active Bissi Schemes</CardTitle>
            <ShieldAlert className="h-4 w-4 text-indigo-600 shrink-0" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-3xl font-extrabold text-indigo-700 dark:text-indigo-400">4 Bissi</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 font-medium">
              Sawariya, Pyare Mohan, Hare Ka Sahara & Shree Krishna
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground leading-tight">Total Bissi Tokens</CardTitle>
            <Ticket className="h-4 w-4 text-purple-600 shrink-0" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-3xl font-extrabold text-purple-700 dark:text-purple-400">2,585</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 font-medium">
              Issued Bissi Tokens
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground leading-tight">Bissi Members</CardTitle>
            <Users className="h-4 w-4 text-emerald-600 shrink-0" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-3xl font-extrabold text-emerald-700 dark:text-emerald-400">4,196</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 font-medium">
              Registered Customers
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground leading-tight">Total Collections</CardTitle>
            <Wallet className="h-4 w-4 text-amber-600 shrink-0" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-3xl font-extrabold text-amber-700 dark:text-amber-400">16,342</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 font-medium">
              Collection Records
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bissi Collection Trend Chart */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Bissi Collection Trend</CardTitle>
            <CardDescription>Daily Bissi installment collections across all 4 Bissi schemes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-55 md:h-75 w-full">
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
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val/1000}k`}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Bissi Collection']}
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

        {/* Recent Bissi Activity */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Bissi Activity</CardTitle>
            <CardDescription>Latest Bissi payments and draws</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {safeActivity.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="mt-0.5 bg-muted p-2 rounded-full">
                    <Wallet className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{item.description || "Bissi Collection"}</p>
                    <div className="flex items-center text-xs text-muted-foreground gap-2">
                      {item.customerName && <span>{item.customerName}</span>}
                      {item.createdAt && (
                        <span>• {(() => {
                          try { return format(new Date(item.createdAt), 'MMM dd'); } catch { return ''; }
                        })()}</span>
                      )}
                    </div>
                  </div>
                  {item.amount && (
                    <div className="text-sm font-bold font-mono">
                      {formatCurrency(item.amount)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4 Bissi Schemes Quick List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Bissi Schemes (4 Schemes)</CardTitle>
          <CardDescription>The 4 registered Bissi schemes of Shree Krishna Association</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20">
              <div className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">Bissi #1 (5th Date)</div>
              <h3 className="font-bold text-base mt-1">Sawariya Seth Bissi</h3>
              <p className="text-xs text-muted-foreground mt-1">Capacity: <span className="font-semibold text-foreground">500 Members</span></p>
              <p className="text-xs text-muted-foreground">Installment: ₹3,000 / month</p>
              <Badge className="mt-2 bg-indigo-600">Active</Badge>
            </div>
            <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20">
              <div className="text-xs text-purple-600 font-semibold uppercase tracking-wider">Bissi #2 (15th Date)</div>
              <h3 className="font-bold text-base mt-1">Pyare Mohan Bissi</h3>
              <p className="text-xs text-muted-foreground mt-1">Capacity: <span className="font-semibold text-foreground">500 Members</span></p>
              <p className="text-xs text-muted-foreground">Installment: ₹3,000 / month</p>
              <Badge className="mt-2 bg-purple-600">Active</Badge>
            </div>
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Bissi #3 (20th Date)</div>
              <h3 className="font-bold text-base mt-1">Hare Ka Sahara Bissi</h3>
              <p className="text-xs text-muted-foreground mt-1">Capacity: <span className="font-semibold text-foreground">500 Members</span></p>
              <p className="text-xs text-muted-foreground">Installment: ₹3,000 / month</p>
              <Badge className="mt-2 bg-emerald-600">Active</Badge>
            </div>
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="text-xs text-amber-600 font-semibold uppercase tracking-wider">Bissi #4 (Lottery Scheme)</div>
              <h3 className="font-bold text-base mt-1">Shree Krishna Bissi</h3>
              <p className="text-xs text-muted-foreground mt-1">Capacity: <span className="font-bold text-amber-600 dark:text-amber-400">1,111 Members</span></p>
              <p className="text-xs text-muted-foreground">Installment: ₹3,000 / month</p>
              <Badge className="mt-2 bg-amber-600">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
