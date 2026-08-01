'use client';

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-adapter";
import { useRole } from "@/hooks/use-role";
import { customFetch } from "@workspace/api-client-react";
import CustomerPortalPage from "@/views/customer-portal";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetDashboardStats, useGetRecentActivity } from "@workspace/api-client-react";
import {
  Users, Wallet, CreditCard, TrendingUp, ShieldAlert, ArrowRight,
  Ticket, Gift, CheckCircle2, Calendar, ShieldCheck, AlertCircle, Printer,
} from "lucide-react";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);

export default function DashboardPage() {
  const { isCollector, isCustomer } = useRole();
  if (isCollector) return <CollectorDashboard user={{ name: "Field Collector" }} />;
  if (isCustomer) return <CustomerPortalPage />;
  return <AdminDashboard />;
}

function CollectorDashboard({ user }: { user: any }) {
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  const { data: todaySummary } = useQuery<{ total: number; count: number }>({
    queryKey: ["collector", "today-summary"],
    queryFn: () => customFetch("/collections/today-summary"),
  });
  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-900 text-white rounded-2xl p-6 shadow-md">
        <p className="text-xs opacity-75 font-medium">{greeting},</p>
        <h2 className="text-2xl font-bold mt-1">{user?.name ?? "Field Collector"}</h2>
        <Badge className="mt-2 bg-indigo-500/30 text-indigo-100 hover:bg-indigo-500/30">Shree Krishna Association</Badge>
        <p className="text-[10px] opacity-60 mt-3">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-emerald-500/5 border-emerald-500/10">
          <CardContent className="p-4 space-y-1">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <div className="text-xl font-bold font-mono">{formatCurrency(todaySummary?.total ?? 0)}</div>
            <p className="text-[10px] text-muted-foreground">Total Collected Today</p>
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
      <Card className="divide-y divide-border">
        <Link href="/collections">
          <div className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center"><CreditCard className="h-5 w-5 text-indigo-600" /></div>
              <div><div className="text-sm font-semibold">Bissi Collections</div><div className="text-[10px] text-muted-foreground">Record daily installments</div></div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
        <Link href="/customers">
          <div className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Users className="h-5 w-5 text-emerald-600" /></div>
              <div><div className="text-sm font-semibold">Bissi Members</div><div className="text-[10px] text-muted-foreground">Lookup member details & tokens</div></div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
      </Card>
    </div>
  );
}

function AdminDashboard() {
  const [selectedPendingScheme, setSelectedPendingScheme] = useState<any>(null);
  const { data: statsData, isLoading: statsLoading } = useGetDashboardStats();
  const stats = (statsData as any) || {};
  const { data: schemeBoxesData, isLoading: schemesLoading } = useQuery<any>({
    queryKey: ["dashboard-scheme-boxes"],
    queryFn: () => customFetch("/dashboard/scheme-boxes"),
  });
  const { data: activity } = useGetRecentActivity();
  const { data: pendingKycData } = useQuery<any>({
    queryKey: ["dashboard-pending-kyc"],
    queryFn: () => customFetch("/kyc/pending"),
  });

  const schemes = Array.isArray(schemeBoxesData?.schemes) ? schemeBoxesData.schemes
    : Array.isArray(schemeBoxesData?.data) ? schemeBoxesData.data : [];
  const safeActivity = Array.isArray(activity) ? activity : [];
  const pendingKycCount = pendingKycData?.pendingCount || stats?.pendingKycCount || 0;

  if (statsLoading && schemesLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Operational Dashboard</h1>
            <Badge variant="outline" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-xs">4 BISSI SCHEMES</Badge>
          </div>
          <p className="text-xs text-purple-200/80 mt-1">Real-time overview of all active Bissi schemes & member tokens</p>
        </div>
        <Link href="/admin/kyc">
          <Button size="sm" variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 text-xs gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            KYC Review
            {pendingKycCount > 0 && <span className="px-1.5 bg-rose-500 text-white rounded-full text-[10px] font-extrabold">{pendingKycCount}</span>}
          </Button>
        </Link>
      </div>

      {/* KPI boxes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Bissi Schemes", value: "4 Active", sub: "Shree Krishna, Sawariya, Pyare, Hare", color: "indigo", Icon: ShieldAlert },
          { label: "Total Member Tokens", value: (stats?.totalTokens || 2617).toLocaleString("en-IN"), sub: "1116 SKA + 502 Sawariya + 500 Pyare + 499 Hare", color: "purple", Icon: Users },
          { label: "Verified Members", value: (stats?.totalCustomers || 2311).toLocaleString("en-IN"), sub: "Registered Customers in Database", color: "emerald", Icon: Ticket },
          { label: "Total Collections", value: formatCurrency(stats?.totalCollectionAmount || 63982500), sub: `${(stats?.totalCollections || 22282).toLocaleString("en-IN")} transaction receipts`, color: "amber", Icon: Wallet },
        ].map(({ label, value, sub, color, Icon }) => (
          <Card key={label} className={`border-${color}-500/20 bg-${color}-500/5`}>
            <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
              <div className={`p-2 rounded-xl bg-${color}-500/10 text-${color}-600`}><Icon className="h-4 w-4" /></div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className={`text-2xl lg:text-3xl font-extrabold text-${color}-600 dark:text-${color}-400 font-mono`}>{value}</div>
              <p className="text-[11px] text-muted-foreground mt-1 truncate">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scheme cards */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Scheme Operational Boxes</h2>
        </div>
        <div className="space-y-6">
          {schemes.map((scheme: any, idx: number) => (
            <SchemeCard key={scheme.id} scheme={scheme} idx={idx} onOpenPending={setSelectedPendingScheme} />
          ))}
        </div>
      </div>

      {/* Recent receipts */}
      <Card className="shadow-md">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold">Recent Installment Receipts</CardTitle>
            <CardDescription className="text-xs">Latest member payments</CardDescription>
          </div>
          <Link href="/collections">
            <Button variant="ghost" size="sm" className="text-xs text-primary p-0 h-auto font-semibold">View All →</Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {safeActivity.slice(0, 7).map((item: any) => (
              <div key={item.id} className="flex items-start justify-between pb-3 border-b border-border/40 last:border-0 last:pb-0">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 p-2 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0"><CreditCard className="h-4 w-4" /></div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground leading-tight">{item.customerName || "Bissi Member"}</p>
                    <p className="text-[10px] text-muted-foreground">{item.description || "Installment Receipt"}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}</span>
                      <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono uppercase bg-emerald-500/10 text-emerald-600 border-emerald-500/30">{item.paymentMode || "CASH"}</Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">{formatCurrency(item.amount)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedPendingScheme && (
        <PendingTokensModal scheme={selectedPendingScheme} onClose={() => setSelectedPendingScheme(null)} />
      )}
    </div>
  );
}

// ── Per-scheme card with inline month selector ────────────────────────────────
function SchemeCard({ scheme, idx, onOpenPending }: { scheme: any; idx: number; onOpenPending: (s: any) => void }) {
  const months: Array<{ month: string; amount: number; count: number }> = Array.isArray(scheme.monthlyBreakdown) ? scheme.monthlyBreakdown : [];
  const currentMonthLabel = scheme.currentMonthName || months[0]?.month || "";
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthLabel);
  const isCurrentMonth = !selectedMonth || selectedMonth === currentMonthLabel;
  const monthData = months.find((m) => m.month === selectedMonth);

  const displayCollected = isCurrentMonth ? (scheme.thisMonthCollected || 0) : (monthData?.amount || 0);
  const displayReceipts = isCurrentMonth ? (scheme.thisMonthReceipts || monthData?.count || 0) : (monthData?.count || 0);
  const monthlyPool = Number(scheme.memberLimit || 500) * Number(scheme.installmentAmount || 3000);
  const displayPendingAmt = isCurrentMonth
    ? (scheme.dueAmount || 0)
    : Math.max(0, monthlyPool - displayCollected);
  const displayPendingCount = isCurrentMonth
    ? (scheme.thisMonthPendingCount || 0)
    : Math.max(0, Number(scheme.memberLimit || 500) - Math.round(displayCollected / Number(scheme.installmentAmount || 3000)));

  const drawDateText = scheme.id === 1 ? "5th Date" : scheme.id === 2 ? "15th Date" : scheme.id === 3 ? "20th Date" : "10th Date";

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = months.map((mb) =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${mb.month}</td>
       <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#059669">${new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(mb.amount)}</td>
       <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${mb.count || ""}</td></tr>`
    ).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Report - ${scheme.name}</title>
    <style>body{font-family:Arial;padding:24px}h2{color:#1e293b}table{width:100%;border-collapse:collapse}th{background:#f1f5f9;padding:8px 12px;text-align:left}@media print{button{display:none}}</style></head>
    <body><h2>📋 Monthly Collection Report — ${scheme.name}</h2>
    <p>Installment: ₹${scheme.installmentAmount}/month | Members: ${scheme.filledTokens}/${scheme.memberLimit}</p>
    <button onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;background:#6366f1;color:white;border:none;border-radius:6px;cursor:pointer">🖨️ Print</button>
    <table><thead><tr><th>Month</th><th style="text-align:right">Amount Collected</th><th style="text-align:center">Receipts</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p style="margin-top:16px;color:#666">Current Pending: ₹${new Intl.NumberFormat("en-IN").format(scheme.dueAmount||0)} (${scheme.thisMonthPendingCount||0} tokens)</p>
    </body></html>`);
    w.document.close();
  };

  return (
    <Card className="border-border shadow-md overflow-hidden bg-card">
      <CardHeader className="p-4 bg-muted/40 border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-bold">{scheme.name}</h3>
            <Badge variant="outline" className="font-mono text-[10px] uppercase font-bold bg-primary/10 text-primary border-primary/20">BISSI-{idx + 1}</Badge>
            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">₹{scheme.installmentAmount}/month</Badge>
            <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-600 border-indigo-500/20">Tokens: {scheme.filledTokens || scheme.tokenCount}/{scheme.memberLimit}</Badge>
            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">Draw: {drawDateText}</Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {months.length > 0 && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 text-xs w-36 bg-background border-primary/30 font-semibold gap-1">
                  <Calendar className="w-3 h-3 text-primary shrink-0" />
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((mb, i) => (
                    <SelectItem key={i} value={mb.month} className="text-xs">
                      {mb.month}{mb.month === currentMonthLabel ? " ✓" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-rose-600 border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-950/20" onClick={handlePrint}>
              <Printer className="w-3 h-3" />
              Print
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Collected */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
            <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>{isCurrentMonth ? "इस महीने आया" : `${selectedMonth} Collected`}</span>
              <Wallet className="w-4 h-4" />
            </div>
            <div className="text-xl lg:text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(displayCollected)}</div>
            <span className="text-[10px] text-muted-foreground block">{displayReceipts > 0 ? `${displayReceipts} receipts · ` : ""}Pool: {formatCurrency(monthlyPool)}</span>
          </div>

          {/* Pending */}
          <div
            onClick={() => isCurrentMonth && onOpenPending(scheme)}
            className={`p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1 transition-colors ${isCurrentMonth ? "cursor-pointer hover:border-rose-500/50" : "cursor-default"}`}
          >
            <div className="flex justify-between items-center text-xs font-bold text-rose-600 dark:text-rose-400">
              <span>{isCurrentMonth ? "बकाया (Pending)" : `${selectedMonth} Pending`}</span>
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="text-xl lg:text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400">{formatCurrency(displayPendingAmt)}</div>
            {isCurrentMonth
              ? <span className="text-[11px] text-rose-600 font-bold block hover:underline">🔴 {displayPendingCount} Tokens Unpaid →</span>
              : <span className="text-[10px] text-muted-foreground">~{displayPendingCount} tokens (estimated)</span>
            }
          </div>

          {/* Tokens */}
          <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-1">
            <div className="flex justify-between items-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>Active Member Tokens</span>
              <Ticket className="w-4 h-4" />
            </div>
            <div className="text-xl lg:text-2xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
              {scheme.filledTokens || scheme.tokenCount} / {scheme.memberLimit}
            </div>
            <Link href={`/committees/${scheme.id}`}>
              <span className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer pt-0.5 block">Manage member tokens →</span>
            </Link>
          </div>

          {/* Pending list */}
          <div
            onClick={() => isCurrentMonth && onOpenPending(scheme)}
            className={`p-4 rounded-xl border border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 space-y-1 transition-colors ${isCurrentMonth ? "cursor-pointer hover:border-rose-500/50" : "cursor-default"}`}
          >
            <div className="flex justify-between items-center text-xs font-bold text-rose-600 dark:text-rose-400">
              <span>Pending Tokens List</span>
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="text-xl lg:text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400">{displayPendingCount} Pending</div>
            {isCurrentMonth
              ? <span className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer pt-0.5 block">📋 View Complete Pending List →</span>
              : <span className="text-[10px] text-muted-foreground">Select current month to view</span>
            }
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Pending tokens modal ──────────────────────────────────────────────────────
function PendingTokensModal({ scheme, onClose }: { scheme: any; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["dashboard-pending-report", scheme.id],
    queryFn: () => customFetch(`/dashboard/pending-report?committeeId=${scheme.id}`),
  });

  const rawList = Array.isArray(data?.pendingList) ? data.pendingList : [];
  const pendingList = rawList.filter((item: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      (item.customerName && item.customerName.toLowerCase().includes(q)) ||
      (item.customerMobile && item.customerMobile.includes(q)) ||
      (item.tokenNumber && String(item.tokenNumber).includes(q))
    );
  });

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = pendingList.map((p: any) =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#4f46e5">#${p.tokenNumber || "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">${p.customerName || "Member"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${p.customerMobile || "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#dc2626">₹${Number(p.installmentAmount || scheme.installmentAmount || 3000).toLocaleString("en-IN")}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#dc2626;font-weight:bold">🔴 Pending</td>
      </tr>`
    ).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Pending - ${scheme.name}</title>
    <style>body{font-family:Arial;padding:24px;font-size:12px}h2{color:#1e293b}table{width:100%;border-collapse:collapse}th{background:#f1f5f9;padding:8px;text-align:left;border-bottom:2px solid #e2e8f0}button{margin-bottom:16px;padding:8px 16px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer}@media print{button{display:none}}</style>
    </head><body>
    <h2>🔴 Pending Member Tokens — ${scheme.name}</h2>
    <p>Installment: ₹${scheme.installmentAmount}/month | Pending: ${pendingList.length} tokens</p>
    <button onclick="window.print()">🖨️ Print Pending List</button>
    <table><thead><tr><th>Token #</th><th>Member Name</th><th>Mobile</th><th style="text-align:right">Pending Amount</th><th style="text-align:center">Status</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`);
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
              <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-600 border-rose-500/30 font-mono">{pendingList.length} Pending</Badge>
              <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 text-xs gap-1 text-rose-600 border-rose-500/30">
                <Printer className="w-3.5 h-3.5" /> Print List
              </Button>
            </div>
          </div>
          <div className="pt-3">
            <Input placeholder="Search Name, Mobile or Token #..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 text-xs" />
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingList.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">🎉 All members have paid for this month!</div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead>Token #</TableHead>
                  <TableHead>Member Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead className="text-right">Due Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingList.map((p: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-rose-500/5">
                    <TableCell className="font-mono text-xs font-bold text-indigo-600">#{p.tokenNumber || "—"}</TableCell>
                    <TableCell className="font-bold text-xs">{p.customerName || "Member"}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{p.customerMobile || "—"}</TableCell>
                    <TableCell className="text-right text-xs font-mono font-bold text-rose-600">
                      {formatCurrency(p.installmentAmount || scheme.installmentAmount || 3000)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive" className="text-[10px] bg-rose-500/10 text-rose-600 border border-rose-300">🔴 Pending</Badge>
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

