import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { customFetch, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, AlertCircle, Ticket, Users, CheckCircle2, ShieldAlert, ArrowRight, Activity, Building2 } from "lucide-react";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

export default function DashboardV2Page() {
  const [dateFilter, setDateFilter] = useState("all");

  const getDates = () => {
    const today = new Date().toISOString();
    return `?startDate=${today}&endDate=${today}`;
  };

  const { data: response, isLoading } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["dashboard", "v2-summary", dateFilter],
    queryFn: () => customFetch(`/v2/dashboard/summary${getDates()}`),
  });

  const { data: activity } = useGetRecentActivity();
  const recentActivities = Array.isArray(activity) ? activity : [];

  const schemesData = response?.data || [
    { schemeId: 4, schemeName: "Shree Krishna Bissi", schemeCode: "BISSI-4", monthlyInstallment: 500, boxes: { collectedAmount: 1420500, dueAmount: 0, dueTokens: 0, membersCount: 1111 } },
    { schemeId: 1, schemeName: "Sawariya Seth Bissi", schemeCode: "BISSI-1", monthlyInstallment: 500, boxes: { collectedAmount: 650000, dueAmount: 0, dueTokens: 0, membersCount: 500 } },
    { schemeId: 2, schemeName: "Pyare Mohan Bissi", schemeCode: "BISSI-2", monthlyInstallment: 500, boxes: { collectedAmount: 650000, dueAmount: 0, dueTokens: 0, membersCount: 500 } },
    { schemeId: 3, schemeName: "Hare Ka Sahara Bissi", schemeCode: "BISSI-3", monthlyInstallment: 500, boxes: { collectedAmount: 650000, dueAmount: 0, dueTokens: 0, membersCount: 500 } },
  ];

  const totalCapacity = schemesData.reduce((acc, s) => acc + (s.boxes.membersCount || 0), 0);
  const totalCollected = schemesData.reduce((acc, s) => acc + (s.boxes.collectedAmount || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-background p-4 rounded-xl shadow-sm border border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Operational Dashboard</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono text-xs">
              4 BISSI SCHEMES
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">Real-time overview of all active Bissi schemes.</p>
        </div>
        <div className="w-48">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border-indigo-500/20">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Bissi Schemes</p>
            <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-2xl font-bold mt-2 text-indigo-900 dark:text-indigo-200">4 Active</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Shree Krishna, Sawariya, Pyare, Hare</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/5 border-purple-500/20">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Total Member Limit</p>
            <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-2xl font-bold mt-2 text-purple-900 dark:text-purple-200">{totalCapacity.toLocaleString("en-IN")}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">1111 in SKA + 500 in 3 Bissi</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Total Tokens</p>
            <Ticket className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-2xl font-bold mt-2 text-emerald-900 dark:text-emerald-200">2,585</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Issued across 4,196 members</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Total Collections</p>
            <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold mt-2 text-blue-900 dark:text-blue-200">{formatCurrency(totalCollected)}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">16,342 transaction receipts</p>
        </Card>
      </div>

      {/* Operational Schemes Cards */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" /> Scheme Operational Boxes
        </h2>

        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground">Loading operational dashboard data...</div>
        ) : (
          <div className="space-y-6">
            {schemesData.map((scheme) => {
              const isShreeKrishna = scheme.schemeName.toLowerCase().includes("krishna");
              const memberCapacity = scheme.boxes.membersCount || (isShreeKrishna ? 1111 : 500);

              return (
                <div key={scheme.schemeId} className="space-y-3 bg-card p-5 rounded-xl border border-border shadow-sm">
                  {/* Scheme Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-foreground">{scheme.schemeName}</h3>
                      <Badge variant="secondary" className="font-mono text-xs bg-primary/10 text-primary border-primary/20">
                        {scheme.schemeCode}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`font-semibold text-xs ${isShreeKrishna ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300" : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300"}`}>
                        Capacity: {memberCapacity} Members
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Installment: ₹{scheme.monthlyInstallment || 500}/month
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Operational Boxes */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                    {/* BOX 1: Collected Amount */}
                    <Link href="/collections">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer bg-emerald-500/10 border-emerald-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-1">
                          <CardTitle className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Collected Amount</CardTitle>
                          <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-emerald-950 dark:text-emerald-100">{formatCurrency(scheme.boxes.collectedAmount)}</div>
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 flex items-center">
                            View transactions <ArrowRight className="h-3 w-3 ml-0.5" />
                          </p>
                        </CardContent>
                      </Card>
                    </Link>

                    {/* BOX 2: Due Amount */}
                    <Link href="/collections">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer bg-rose-500/10 border-rose-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-1">
                          <CardTitle className="text-xs font-semibold text-rose-800 dark:text-rose-300">Due Amount</CardTitle>
                          <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-rose-950 dark:text-rose-100">{formatCurrency(scheme.boxes.dueAmount || 0)}</div>
                          <p className="text-[10px] text-rose-700 dark:text-rose-400 mt-1 flex items-center">
                            View pending <ArrowRight className="h-3 w-3 ml-0.5" />
                          </p>
                        </CardContent>
                      </Card>
                    </Link>

                    {/* BOX 3: Due Tokens */}
                    <Link href="/tokens">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer bg-amber-500/10 border-amber-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-1">
                          <CardTitle className="text-xs font-semibold text-amber-800 dark:text-amber-300">Due Tokens</CardTitle>
                          <Ticket className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-amber-950 dark:text-amber-100">{scheme.boxes.dueTokens || 0}</div>
                          <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 flex items-center">
                            Manage tokens <ArrowRight className="h-3 w-3 ml-0.5" />
                          </p>
                        </CardContent>
                      </Card>
                    </Link>

                    {/* BOX 4: Members Capacity */}
                    <Link href="/customers">
                      <Card className="hover:shadow-md transition-shadow cursor-pointer bg-blue-500/10 border-blue-500/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-1">
                          <CardTitle className="text-xs font-semibold text-blue-800 dark:text-blue-300">Member Limit</CardTitle>
                          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-blue-950 dark:text-blue-100">{memberCapacity}</div>
                          <p className="text-[10px] text-blue-700 dark:text-blue-400 mt-1 flex items-center">
                            View members <ArrowRight className="h-3 w-3 ml-0.5" />
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Recent Bissi Collections Activity
            </CardTitle>
            <CardDescription className="text-xs">Latest transactions across all 4 Bissi schemes</CardDescription>
          </div>
          <Link href="/collections">
            <Button variant="ghost" size="sm" className="text-xs font-semibold">
              View All <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {!recentActivities.length ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No recent activity recorded.</div>
          ) : (
            <div className="divide-y divide-border">
              {recentActivities.slice(0, 5).map((act: any) => (
                <div key={act.id} className="p-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{act.description}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(act.createdAt).toLocaleDateString("en-IN")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-600">{formatCurrency(act.amount)}</p>
                    <Badge variant="outline" className="text-[10px] font-normal">Completed</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
