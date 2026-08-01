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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
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
  const [selectedPendingScheme, setSelectedPendingScheme] = useState<any>(null);

  // Load KPI Stats
  const { data: statsData, isLoading: statsLoading } = useGetDashboardStats();
  const stats = statsData as any || {};

  // Load Per-Scheme Operational Boxes Data (Sawariya, Pyare Mohan, Hare Ka Sahara, Shree Krishna)
  const { data: schemeBoxesData, isLoading: schemesLoading } = useQuery<any>({
    queryKey: ["dashboard-scheme-boxes"],
    queryFn: () => customFetch("/dashboard/scheme-boxes"),
  });

  // Load Recent Activity (Collections Feed)
  const { data: activity } = useGetRecentActivity();

  // Load Pending KYC Count
  const { data: pendingKycData } = useQuery<any>({
    queryKey: ["dashboard-pending-kyc"],
    queryFn: () => customFetch("/kyc/pending"),
  });

  const schemes = Array.isArray(schemeBoxesData?.schemes) ? schemeBoxesData.schemes : Array.isArray(schemeBoxesData?.data) ? schemeBoxesData.data : [];
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
                    <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20 font-bold">
                      📅 Month: {scheme.currentMonthName || "Jul 2026"}
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-indigo-500/10 text-indigo-600 border-indigo-500/20 font-medium">
                      Filled Tokens: {scheme.filledTokens || scheme.tokenCount || 500} / {scheme.memberLimit || 500}
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                      Installment: ₹{scheme.installmentAmount}/month
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-600 border-indigo-500/20 font-medium">
                      Draw: {drawDateText}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-5">
                  {/* 4 Stat Boxes inside Scheme */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 1. This Month Collected Amount */}
                    <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <span>This Month Collected (इस महीने आया)</span>
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div className="text-xl lg:text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(scheme.thisMonthCollected || 0)}
                      </div>
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        Monthly Pool Target: {formatCurrency(scheme.monthlyPool || (scheme.memberLimit * scheme.installmentAmount))}
                      </span>
                    </div>

                    {/* 2. Pending Tokens / Pending Amount (Clickable) */}
                    <div 
                      onClick={() => setSelectedPendingScheme(scheme)}
                      className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1 cursor-pointer hover:border-rose-500/50 transition-colors"
                    >
                      <div className="flex justify-between items-center text-xs font-bold text-rose-600 dark:text-rose-400">
                        <span>This Month Pending (बकाया)</span>
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div className="text-xl lg:text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400">
                        {formatCurrency(scheme.dueAmount || 0)}
                      </div>
                      <span className="text-[11px] text-rose-600 font-bold block hover:underline">
                        🔴 {scheme.thisMonthPendingCount || 0} Tokens Unpaid →
                      </span>
                    </div>

                    {/* 3. Filled vs Capacity Tokens */}
                    <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        <span>Active Member Tokens</span>
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div className="text-xl lg:text-2xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                        {scheme.filledTokens || scheme.tokenCount} / {scheme.memberLimit}
                      </div>
                      <Link href={`/committees/${scheme.id}`}>
                        <span className="text-[11px] font-semibold text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer pt-0.5">
                          Manage member tokens →
                        </span>
                      </Link>
                    </div>

                    {/* 4. Pending Tokens List Popup Trigger */}
                    <div 
                      onClick={() => setSelectedPendingScheme(scheme)}
                      className="p-4 rounded-xl border border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 space-y-1 cursor-pointer hover:border-rose-500/50 transition-colors"
                    >
                      <div className="flex justify-between items-center text-xs font-bold text-rose-600 dark:text-rose-400">
                        <span>Pending Tokens List</span>
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div className="text-xl lg:text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400">
                        {scheme.thisMonthPendingCount || 0} Pending
                      </div>
                      <span className="text-[11px] font-semibold text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer pt-0.5">
                        📋 View Complete Pending List →
                      </span>
                    </div>
                  </div>

                  {/* Monthly Collection Breakdown for this Committee */}
                  {scheme.monthlyBreakdown && scheme.monthlyBreakdown.length > 0 && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border/60">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">📅 Har Mahine Ka Total — {scheme.name}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{scheme.monthlyBreakdown.length} months</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-rose-600 border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            onClick={() => {
                              const w = window.open('', '_blank');
                              if (!w) return;
                              const rows = (scheme.monthlyBreakdown || []).map((mb: any) =>
                                `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${mb.month}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#059669">${new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(mb.amount)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${mb.count || ''}</td></tr>`
                              ).join('');
                              w.document.write(`<!DOCTYPE html><html><head><title>Pending List - ${scheme.name}</title><style>body{font-family:Arial;padding:24px}h2{color:#1e293b}table{width:100%;border-collapse:collapse}th{background:#f1f5f9;padding:8px 12px;text-align:left}@media print{button{display:none}}</style></head><body><h2>📋 Monthly Collection Report — ${scheme.name}</h2><p>Installment: ₹${scheme.installmentAmount}/month | Members: ${scheme.filledTokens}/${scheme.memberLimit}</p><button onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;background:#6366f1;color:white;border:none;border-radius:6px;cursor:pointer">🖨️ Print</button><table><thead><tr><th>Month</th><th style="text-align:right">Amount Collected</th><th style="text-align:center">Receipts</th></tr></thead><tbody>${rows}</tbody></table><p style="margin-top:16px;color:#666">This Month Pending: ₹${new Intl.NumberFormat('en-IN').format(scheme.dueAmount||0)} (${scheme.thisMonthPendingCount||0} members)</p></body></html>`);
                              w.document.close();
                            }}
                          >
                            <Printer className="w-3 h-3" />
                            Print / Pending List
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {scheme.monthlyBreakdown.slice(0, 12).map((mb: any, mIdx: number) => (
                          <div key={mIdx} className="p-2.5 rounded-lg bg-background border text-center hover:border-emerald-500/40 transition-colors">
                            <span className="text-muted-foreground block text-[10px] font-semibold mb-1">{mb.month}</span>
                            <span className="font-bold font-mono text-emerald-600 text-xs">{formatCurrency(mb.amount)}</span>
                            {mb.count && <span className="text-[9px] text-muted-foreground block mt-0.5">{mb.count} receipts</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Live Transactions Feed */}
      <div>
        <Card className="shadow-md">
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

      {/* Interactive Pending Tokens List Modal */}
      {selectedPendingScheme && (
        <PendingTokensModal
          scheme={selectedPendingScheme}
          onClose={() => setSelectedPendingScheme(null)}
        />
      )}
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

function PendingTokensModal({ scheme, onClose }: { scheme: any; onClose: () => void }) {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["dashboard-pending-report", scheme.id],
    queryFn: () => customFetch(`/dashboard/pending-report?committeeId=${scheme.id}`),
  });

  const rawPendingList = Array.isArray(data?.pendingList) ? data.pendingList : [];
  
  const pendingList = rawPendingList.filter((item: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      (item.customerName && item.customerName.toLowerCase().includes(q)) ||
      (item.customerMobile && item.customerMobile.includes(q)) ||
      (item.tokenNumber && String(item.tokenNumber).includes(q))
    );
  });

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = pendingList.map((p: any) =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#4f46e5">#${p.tokenNumber || '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">${p.customerName || 'Member'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${p.customerMobile || '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#dc2626">₹${Number(p.installmentAmount || scheme.installmentAmount || 3000).toLocaleString('en-IN')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#dc2626;font-weight:bold">🔴 Pending (Unpaid)</td>
      </tr>`
    ).join('');

    w.document.write(`<!DOCTYPE html>
<html><head><title>Pending Members - ${scheme.name}</title>
<style>
  body { font-family: Arial; padding: 24px; font-size: 12px; }
  h2 { color: #1e293b; margin-bottom: 4px; }
  p { color: #64748b; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  button { margin-bottom: 16px; padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; }
  @media print { button { display: none; } }
</style></head>
<body>
<h2>🔴 Pending Member Tokens List — ${scheme.name}</h2>
<p>Installment: ₹${scheme.installmentAmount}/month | Total Pending Tokens: ${pendingList.length}</p>
<button onclick="window.print()">🖨️ Print Pending List</button>
<table>
  <thead><tr><th>Token #</th><th>Member Name</th><th>Mobile</th><th style="text-align:right">Pending Amount</th><th style="text-align:center">Status</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-rose-600">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              Pending Member Tokens — {scheme.name}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-600 border-rose-500/30 font-mono">
                {pendingList.length} Pending Tokens
              </Badge>
              <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 text-xs gap-1 text-rose-600 border-rose-500/30">
                <Printer className="w-3.5 h-3.5" />
                Print List
              </Button>
            </div>
          </div>

          <div className="pt-3">
            <Input
              placeholder="Search Member Name, Mobile or Token #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingList.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              🎉 All members have paid for this month! No pending tokens found.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead>Token #</TableHead>
                  <TableHead>Member Name (नाम)</TableHead>
                  <TableHead>Mobile (मोबाइल)</TableHead>
                  <TableHead className="text-right">Due Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingList.map((p: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-rose-500/5">
                    <TableCell className="font-mono text-xs font-bold text-indigo-600">
                      #{p.tokenNumber || "—"}
                    </TableCell>
                    <TableCell className="font-bold text-xs">
                      {p.customerName || "Member"}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {p.customerMobile || "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono font-bold text-rose-600">
                      {formatCurrency(p.installmentAmount || scheme.installmentAmount || 3000)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive" className="text-[10px] uppercase bg-rose-500/10 text-rose-600 border border-rose-300">
                        🔴 Pending
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
