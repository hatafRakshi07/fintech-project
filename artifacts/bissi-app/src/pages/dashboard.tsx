import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useRole } from "@/hooks/use-role";
import { customFetch } from "@workspace/api-client-react";
import CustomerPortalPage from "@/pages/customer-portal";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  useGetDashboardStats, 
  useGetCollectionTrend, 
  useGetRecentActivity,
  useGetBranchSummary
} from "@workspace/api-client-react";
import { 
  Users, 
  Building2, 
  Wallet, 
  CreditCard, 
  TrendingUp, 
  ArrowUpRight,
  Clock,
  ShieldAlert,
  ArrowRight,
  AlertTriangle,
  Ticket,
  CheckCircle2,
  Calendar,
  UserCircle
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
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
  const { role, user, isCollector, isCustomer } = useRole();
  const [, setLocation] = useLocation();

  // If role is collector or customer, render mobile-adapted dashboards
  if (isCollector) {
    return <CollectorDashboard user={user} />;
  }

  if (isCustomer) {
    return <CustomerPortalPage />;
  }


  // Fallback: Admin / Accountant / Branch Manager Dashboard
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

  // Fetch Collector today summary
  const { data: todaySummary, isLoading: summaryLoading } = useQuery<{
    total: number;
    count: number;
    cash: number;
    upi: number;
  }>({
    queryKey: ["collector", "today-summary", user?.branchId],
    queryFn: () => customFetch(`/collections/today-summary${user?.branchId ? `?branchId=${user.branchId}` : ""}`),
  });

  // Fetch Collector recovery summary
  const { data: recoverySummary, isLoading: recoveryLoading } = useQuery<{
    pending: number;
    inProgress: number;
    resolved: number;
    critical: number;
  }>({
    queryKey: ["collector", "recovery-summary", user?.branchId],
    queryFn: () => customFetch(`/recovery/summary${user?.branchId ? `?branchId=${user.branchId}` : ""}`),
  });

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Mobile-centric Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-900 text-white rounded-2xl p-6 shadow-md">
        <p className="text-xs opacity-75 font-medium">{greeting()},</p>
        <h2 className="text-2xl font-bold mt-1">{user?.name ?? "Field Collector"}</h2>
        <Badge className="mt-2 bg-indigo-500/30 text-indigo-100 hover:bg-indigo-500/30">
          Branch: {user?.branchName || "Main Office"}
        </Badge>
        <p className="text-[10px] opacity-60 mt-3">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Today's Stats Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Today's Collections</h3>
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
              <p className="text-[10px] text-muted-foreground">Payments Recorded</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recovery alerts if any */}
      {(recoverySummary?.pending ?? 0) > 0 && (
        <Card className="bg-amber-500/5 border-amber-500/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <div className="text-sm font-semibold">Pending Recoveries</div>
                <div className="text-xs text-muted-foreground">{recoverySummary?.pending} customers overdue</div>
              </div>
            </div>
            <Link href="/recovery">
              <Button size="sm" variant="ghost" className="text-amber-500 font-semibold gap-1">
                View <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick Action Navigation Buttons */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Collector Panel Navigation</h3>
        <Card className="divide-y divide-border">
          <Link href="/collections">
            <div className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Today's collections</div>
                  <div className="text-[10px] text-muted-foreground">Record daily deposit entries</div>
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
                  <div className="text-sm font-semibold">Customer Lookup</div>
                  <div className="text-[10px] text-muted-foreground">Search and view customer statement</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>

          <Link href="/recovery">
            <div className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Recovery Tasks</div>
                  <div className="text-[10px] text-muted-foreground">Inspect and clear overdue EMI checks</div>
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

// ── 2. CUSTOMER DASHBOARD PANEL ──────────────────────────────────────────
function CustomerDashboard({ user }: { user: any }) {
  // Fetch Customer active tokens
  const { data: tokens = [], isLoading: tokensLoading } = useQuery<any[]>({
    queryKey: ["customer", "tokens"],
    queryFn: () => customFetch("/tokens"),
  });

  // Fetch Customer active loans
  const { data: loansResponse, isLoading: loansLoading } = useQuery<{ data: any[] }>({
    queryKey: ["customer", "loans"],
    queryFn: () => customFetch("/loans"),
  });

  const loans = loansResponse?.data ?? [];

  const totalTokens = tokens.length;
  const activeLoans = loans.filter((l: any) => l.status === "active").length;
  const totalLoanRepaid = loans.reduce((sum: number, l: any) => sum + (l.paidAmount || 0), 0);

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Customer Mobile Banner */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-800 text-white rounded-2xl p-6 shadow-md">
        <p className="text-xs opacity-75 font-medium">Welcome to customer portal,</p>
        <h2 className="text-2xl font-bold mt-1">{user?.name ?? "Valued Customer"}</h2>
        <Badge className="mt-2 bg-purple-500/30 text-purple-100 hover:bg-purple-500/30">
          Member Code: SKA-{user?.id ?? "000"}
        </Badge>
        <p className="text-[10px] opacity-60 mt-3">
          Shree Krishna Association Group
        </p>
      </div>

      {/* Customer summary metrics */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center bg-purple-500/5 border-purple-500/10">
          <Ticket className="h-4 w-4 text-purple-500 mx-auto mb-1" />
          <div className="text-lg font-bold font-mono">{totalTokens}</div>
          <p className="text-[9px] text-muted-foreground">My Tokens</p>
        </Card>
        <Card className="p-3 text-center bg-indigo-500/5 border-indigo-500/10">
          <CreditCard className="h-4 w-4 text-indigo-500 mx-auto mb-1" />
          <div className="text-lg font-bold font-mono">{activeLoans}</div>
          <p className="text-[9px] text-muted-foreground">Active Loans</p>
        </Card>
        <Card className="p-3 text-center bg-emerald-500/5 border-emerald-500/10">
          <TrendingUp className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
          <div className="text-sm font-bold font-mono truncate">{formatCurrency(totalLoanRepaid)}</div>
          <p className="text-[9px] text-muted-foreground">Total Repaid</p>
        </Card>
      </div>

      {/* Active Tokens status */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">My Registered Tokens</h3>
        {tokensLoading ? (
          <div className="text-center py-4 text-xs text-muted-foreground">Loading tokens...</div>
        ) : tokens.length === 0 ? (
          <Card className="p-4 text-center text-xs text-muted-foreground">No active Bissi tokens registered.</Card>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => (
              <Card key={t.id} className="p-3.5 border-border">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-sm text-primary">{t.committeeName || "General Bissi Group"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Token Code: {t.tokenNumber}</p>
                  </div>
                  <Badge variant={t.status === "active" ? "default" : "secondary"} className="text-[10px]">
                    {t.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick links for Customer */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Quick Links</h3>
        <Card className="divide-y divide-border">
          <Link href="/profile">
            <div className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer">
              <div className="flex items-center gap-3">
                <UserCircle className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium">My Profile & statement</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
          <Link href="/loans">
            <div className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-indigo-600" />
                <span className="text-sm font-medium">My Loan EMIs</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        </Card>
      </div>
    </div>
  );
}

// ── 3. ADMINISTRATIVE/FINANCE DASHBOARD PANEL ─────────────────────────────
function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: trend, isLoading: trendLoading } = useQuery<any[]>({
    queryKey: ["collection-trend"],
    queryFn: () => customFetch("/dashboard/collection-trend"),
  });
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: branchSummary, isLoading: branchLoading } = useGetBranchSummary();

  if (statsLoading || trendLoading || activityLoading || branchLoading) {
    return <div className="h-full flex items-center justify-center">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Welcome to Shree Krishna Association dashboard.</p>
      </div>

      {/* KPI Cards — 2-col on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground leading-tight">Today's Collection</CardTitle>
            <Wallet className="h-3 w-3 md:h-4 md:w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">{formatCurrency(stats?.todayCollection || 0)}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
              <span className="text-emerald-500 font-medium">On track</span>
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground leading-tight">Active Loans</CardTitle>
            <CreditCard className="h-3 w-3 md:h-4 md:w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">{stats?.totalActiveLoans || 0}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">
              {formatCurrency(stats?.outstandingLoanAmount || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground leading-tight">Customers</CardTitle>
            <Users className="h-3 w-3 md:h-4 md:w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">{stats?.totalCustomers || 0}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
              {stats?.totalBranches || 0} branches
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 md:p-6 md:pb-2">
            <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground leading-tight">Committees</CardTitle>
            <ShieldAlert className="h-3 w-3 md:h-4 md:w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">{stats?.totalActiveCommittees || 0}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
              {stats?.totalCollectors || 0} collectors
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Collection Trend (Last 30 Days)</CardTitle>
            <CardDescription>Daily collection amounts across all branches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-55 md:h-75 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend || []} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(new Date(val), 'MMM dd')} 
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
                    formatter={(value: number) => [formatCurrency(value), 'Collection']}
                    labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
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

        {/* Recent Activity */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest transactions and events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {(activity || []).slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="mt-0.5 bg-muted p-2 rounded-full">
                    {item.type === 'collection' ? <Wallet className="h-4 w-4 text-primary" /> : 
                     item.type === 'loan_disbursed' ? <ArrowUpRight className="h-4 w-4 text-secondary" /> : 
                     <Clock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{item.description}</p>
                    <div className="flex items-center text-xs text-muted-foreground gap-2">
                      {item.customerName && <span>{item.customerName}</span>}
                      {item.customerName && <span>•</span>}
                      <span>{format(new Date(item.createdAt), 'hh:mm a')}</span>
                    </div>
                  </div>
                  {item.amount && (
                    <div className="text-sm font-bold">
                      {formatCurrency(item.amount)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branch Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Branch Performance</CardTitle>
          <CardDescription>Top performing branches by total collection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-50 md:h-62.5 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchSummary || []} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                <YAxis dataKey="branchName" type="category" axisLine={false} tickLine={false} width={100} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), 'Collection']} />
                <Bar dataKey="totalCollection" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
