import React from "react";
import { 
  useGetDashboardStats, 
  useGetCollectionTrend, 
  useGetRecentActivity,
  useGetBranchSummary
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Building2, 
  Wallet, 
  CreditCard, 
  TrendingUp, 
  ArrowUpRight,
  Clock,
  ShieldAlert,
  ArrowRight
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

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: trend, isLoading: trendLoading } = useGetCollectionTrend();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: branchSummary, isLoading: branchLoading } = useGetBranchSummary();

  if (statsLoading || trendLoading || activityLoading || branchLoading) {
    return <div className="h-full flex items-center justify-center">Loading dashboard...</div>;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Welcome to Bissi management dashboard.</p>
      </div>

      {/* KPI Cards — 2-col on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Collection</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.todayCollection || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-500 font-medium">On track</span> vs yesterday
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Active Loans</CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalActiveLoans || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Outstanding: {formatCurrency(stats?.outstandingLoanAmount || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {stats?.totalBranches || 0} branches
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Committees</CardTitle>
            <ShieldAlert className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalActiveCommittees || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Managed by {stats?.totalCollectors || 0} collectors
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
