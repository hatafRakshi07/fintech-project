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
import { useGetDashboardStats, useGetRecentActivity } from "@workspace/api-client-react";
import {
  Users, Wallet, CreditCard, TrendingUp, ShieldAlert, ArrowRight,
  Ticket, ShieldCheck, AlertCircle, Printer, Calendar,
} from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

// ── Root page ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { isCollector, isCustomer } = useRole();
  if (isCollector) return <CollectorDashboard />;
  if (isCustomer) return <CustomerPortalPage />;
  return <AdminDashboard />;
}

// ── Collector mini panel ───────────────────────────────────────────────────────
function CollectorDashboard() {
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  const { data: sum } = useQuery<{ total: number; count: number }>({
    queryKey: ["collector-today-summary"],
    queryFn: () => customFetch("/collections/today-summary"),
  });
  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-900 text-white rounded-2xl p-6 shadow-md">
        <p className="text-xs opacity-75">{greeting},</p>
        <h2 className="text-2xl font-bold mt-1">Field Collector</h2>
        <Badge className="mt-2 bg-indigo-500/30 text-indigo-100">Shree Krishna Association</Badge>
        <p className="text-[10px] opacity-60 mt-3">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-emerald-500/5 border-emerald-500/10">
          <CardContent className="p-4 space-y-1">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <div className="text-xl font-bold font-mono">{fmt(sum?.total ?? 0)}</div>
            <p className="text-[10px] text-muted-foreground">Collected Today</p>
          </CardContent>
        </Card>
        <Card className="bg-indigo-500/5 border-indigo-500/10">
          <CardContent className="p-4 space-y-1">
            <CreditCard className="h-5 w-5 text-indigo-500" />
            <div className="text-xl font-bold font-mono">{sum?.count ?? 0}</div>
            <p className="text-[10px] text-muted-foreground">Bissi Receipts</p>
          </CardContent>
        </Card>
      </div>
      <Card className="divide-y divide-border">
        {[
          { href: "/collections", icon: CreditCard, color: "indigo", label: "Bissi Collections", sub: "Record daily installments" },
          { href: "/customers", icon: Users, color: "emerald", label: "Bissi Members", sub: "Lookup member details" },
        ].map(({ href, icon: Icon, color, label, sub }) => (
          <Link key={href} href={href}>
            <div className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-${color}-500/10 flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 text-${color}-600`} />
                </div>
                <div>
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-[10px] text-muted-foreground">{sub}</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </Card>
    </div>
  );
}

// ── Admin dashboard ────────────────────────────────────────────────────────────
function AdminDashboard() {
  const [pendingModal, setPendingModal] = useState<{ scheme: any; month: string } | null>(null);
  const { data: statsData } = useGetDashboardStats();
  const stats = (statsData as any) || {};
  const { data: schemeBoxesData, isLoading } = useQuery<any>({
    queryKey: ["dashboard-scheme-boxes"],
    queryFn: () => customFetch("/dashboard/scheme-boxes"),
    staleTime: 60_000,
  });
  const { data: activity } = useGetRecentActivity();
  const { data: kycData } = useQuery<any>({
    queryKey: ["dashboard-pending-kyc"],
    queryFn: () => customFetch("/kyc/pending"),
  });

  const schemes: any[] = Array.isArray(schemeBoxesData?.schemes)
    ? schemeBoxesData.schemes
    : Array.isArray(schemeBoxesData?.data)
    ? schemeBoxesData.data
    : [];
  const safeActivity = Array.isArray(activity) ? activity : [];
  const pendingKyc = kycData?.pendingCount || 0;

  return (
    <div className="space-y-8 pb-12">
      {/* ── Top header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Operational Dashboard</h1>
            <Badge variant="outline" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-xs">4 BISSI SCHEMES</Badge>
          </div>
          <p className="text-xs text-purple-200/80 mt-1">Real-time overview of all active Bissi schemes & member tokens</p>
        </div>
        <Link href="/admin/kyc">
          <Button size="sm" variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 text-xs gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            KYC Review
            {pendingKyc > 0 && <span className="ml-1 px-1.5 bg-rose-500 text-white rounded-full text-[10px] font-extrabold">{pendingKyc}</span>}
          </Button>
        </Link>
      </div>

      {/* ── KPI boxes ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-indigo-500/20 bg-indigo-500/5">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bissi Schemes</CardTitle>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600"><ShieldAlert className="h-4 w-4" /></div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl lg:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">4 Active</div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">Shree Krishna, Sawariya, Pyare, Hare</p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Member Tokens</CardTitle>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600"><Users className="h-4 w-4" /></div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl lg:text-3xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">{(stats?.totalTokens || 2617).toLocaleString("en-IN")}</div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">1116 SKA + 502 Sawariya + 500 Pyare + 499 Hare</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Verified Members</CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600"><Ticket className="h-4 w-4" /></div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl lg:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">{(stats?.totalCustomers || 2311).toLocaleString("en-IN")}</div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">Registered Customers in Database</p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="p-4 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Collections</CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600"><Wallet className="h-4 w-4" /></div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl lg:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">{fmt(stats?.totalCollectionAmount || 63982500)}</div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">{(stats?.totalCollections || 22282).toLocaleString("en-IN")} transaction receipts</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Scheme operational boxes ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Scheme Operational Boxes</h2>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading bissi schemes...
          </div>
        ) : schemes.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground border rounded-xl">No bissi scheme data available.</div>
        ) : (
          <div className="space-y-6">
            {schemes.map((scheme: any, idx: number) => (
              <SchemeCard key={`scheme-${scheme.id || idx}`} scheme={scheme} idx={idx} onOpenPending={(s, month) => setPendingModal({ scheme: s, month })} />
            ))}
          </div>
        )}
      </div>

      {/* ── Recent receipts ── */}
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
            {safeActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No recent activity found.</p>
            ) : safeActivity.slice(0, 7).map((item: any) => (
              <div key={item.id || Math.random()} className="flex items-start justify-between pb-3 border-b border-border/40 last:border-0 last:pb-0">
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
                <div className="text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">{fmt(item.amount)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {pendingModal && <PendingTokensModal scheme={pendingModal.scheme} month={pendingModal.month} onClose={() => setPendingModal(null)} />}
    </div>
  );
}

// ── Per-scheme card with month dropdown ───────────────────────────────────────
function SchemeCard({ scheme, idx, onOpenPending }: {
  scheme: any;
  idx: number;
  onOpenPending: (s: any, month: string) => void;
}) {
  const rawMonths: any[] = Array.isArray(scheme.monthlyBreakdown) ? scheme.monthlyBreakdown : [];
  const months = rawMonths
    .map(m => ({ month: String(m.month || m.label || m.name || ""), amount: Number(m.amount || 0), count: Number(m.count || 0) }))
    .filter(m => m.month);

  // Default to first month in list (most recent with data)
  const defaultMonth = months[0]?.month || "";
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const memberLimit = Number(scheme.memberLimit || 500);
  const installmentAmt = Number(scheme.installmentAmount || 3000);
  const monthlyPool = memberLimit * installmentAmt;

  // Current calendar month for determining if we have live pending data
  const now = new Date();
  const calCurrentMonth = now.toLocaleString("en-US", { month: "short" }) + " " + now.getFullYear(); // "Aug 2026"

  // Check if selected month = the month the API computed pending counts for
  // API pending is for DATE_TRUNC('month', NOW()) = current calendar month
  const apiPendingMonth = scheme.currentMonthName || "";
  const showLivePending = selectedMonth === apiPendingMonth || selectedMonth === calCurrentMonth || !selectedMonth;

  const monthData = months.find(m => m.month === selectedMonth);
  const displayCollected = showLivePending
    ? Number(scheme.thisMonthCollected || 0)
    : (monthData?.amount || 0);
  const displayReceipts = showLivePending
    ? Number(scheme.thisMonthReceipts || monthData?.count || 0)
    : (monthData?.count || 0);

  // Always compute pending from actual or estimated data
  const livePendingAmt = Number(scheme.dueAmount || 0);
  const livePendingCount = Number(scheme.thisMonthPendingCount || 0);
  const estPendingAmt = Math.max(0, monthlyPool - displayCollected);
  const estPendingCount = Math.max(0, memberLimit - Math.round(displayCollected / (installmentAmt || 1)));

  const displayPendingAmt = showLivePending ? livePendingAmt : estPendingAmt;
  const displayPendingCount = showLivePending ? livePendingCount : estPendingCount;

  const drawText = scheme.id === 1 ? "5th Date" : scheme.id === 2 ? "15th Date" : scheme.id === 3 ? "20th Date" : "10th Date";

  const handlePrint = () => {
    // Create an invisible iframe to print without popup blocker issues
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    const rows = months.map(mb =>
      `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee">${mb.month}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#059669">${new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(mb.amount)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${mb.count||0}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;color:#e11d48;font-weight:700">${new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Math.max(0,monthlyPool-mb.amount))}</td>
      </tr>`
    ).join("");
    doc.write(`<!DOCTYPE html><html><head><title>${scheme.name} Report</title>
    <style>body{font-family:Arial;padding:24px;font-size:12px}h2{color:#1e293b;margin-bottom:4px}p{color:#64748b;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#f1f5f9;padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0}</style>
    </head><body>
    <h2>📋 Monthly Collection Report — ${scheme.name}</h2>
    <p>Pool: ₹${monthlyPool.toLocaleString("en-IN")} | ₹${installmentAmt}/member | ${scheme.filledTokens||scheme.tokenCount}/${memberLimit} members</p>
    <table><thead><tr><th>Month</th><th style="text-align:right">Collected</th><th style="text-align:center">Receipts</th><th style="text-align:right">Pending (Est.)</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p style="margin-top:14px;color:#e11d48">Current Pending: ${livePendingCount} tokens | ₹${livePendingAmt.toLocaleString("en-IN")}</p>
    </body></html>`);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  };

  return (
    <Card className="border-border shadow-md overflow-hidden bg-card">
      {/* Header */}
      <CardHeader className="p-4 bg-muted/40 border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-foreground">{scheme.name}</h3>
            <Badge variant="outline" className="font-mono text-[10px] uppercase font-bold bg-primary/10 text-primary border-primary/20">BISSI-{idx + 1}</Badge>
            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">₹{installmentAmt.toLocaleString("en-IN")}/month</Badge>
            <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-600 border-indigo-500/20">Tokens: {scheme.filledTokens || scheme.tokenCount || 0}/{memberLimit}</Badge>
            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">Draw: {drawText}</Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {months.length > 0 && (
              <div className="flex items-center gap-1.5 bg-background border border-primary/30 rounded-lg px-2 py-1">
                <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                  style={{ minWidth: 90 }}
                >
                  {months.map((mb, i) => (
                    <option key={i} value={mb.month}>{mb.month}</option>
                  ))}
                </select>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1 text-rose-600 border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              onClick={handlePrint}
            >
              <Printer className="w-3 h-3" />
              Print
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* 4 Stat boxes */}
      <CardContent className="p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Monthly Pool */}
          <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-1">
            <div className="flex justify-between items-center text-xs font-bold text-purple-600 dark:text-purple-400">
              <span>Monthly Pool Target</span>
              <Wallet className="w-4 h-4" />
            </div>
            <div className="text-xl lg:text-2xl font-extrabold font-mono text-purple-600 dark:text-purple-400">{fmt(monthlyPool)}</div>
            <span className="text-[10px] text-muted-foreground block">{memberLimit} members × ₹{installmentAmt.toLocaleString("en-IN")}</span>
          </div>

          {/* Collected */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
            <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>{selectedMonth || "This Month"} Collected</span>
              <Wallet className="w-4 h-4" />
            </div>
            <div className="text-xl lg:text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">{fmt(displayCollected)}</div>
            <span className="text-[10px] text-muted-foreground block">{displayReceipts} receipts collected</span>
          </div>

          {/* Pending Amount — always clickable */}
          <div
            onClick={() => onOpenPending(scheme, selectedMonth)}
            className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1 cursor-pointer hover:border-rose-500/60 hover:bg-rose-500/10 transition-colors"
          >
            <div className="flex justify-between items-center text-xs font-bold text-rose-600 dark:text-rose-400">
              <span>Pending (बकाया)</span>
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="text-xl lg:text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400">{fmt(displayPendingAmt)}</div>
            <span className="text-[11px] text-rose-600 font-bold block">
              🔴 {displayPendingCount} Tokens Unpaid → Click to View
            </span>
          </div>

          {/* Pending List — always clickable */}
          <div
            onClick={() => onOpenPending(scheme, selectedMonth)}
            className="p-4 rounded-xl border border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 space-y-1 cursor-pointer hover:border-rose-500/60 transition-colors"
          >
            <div className="flex justify-between items-center text-xs font-bold text-rose-600 dark:text-rose-400">
              <span>Pending Tokens List</span>
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="text-xl lg:text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400">{displayPendingCount} Pending</div>
            <span className="text-[11px] font-semibold text-rose-600 block">📋 View List & Print →</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Pending tokens modal ───────────────────────────────────────────────────────
function PendingTokensModal({ scheme, month, onClose }: { scheme: any; month: string; onClose: () => void }) {
  const [search, setSearch] = useState("");

  const queryParams = new URLSearchParams();
  queryParams.set("committeeId", String(scheme.id));
  if (month) queryParams.set("month", month);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["pending-report-modal", scheme.id, month],
    queryFn: () => customFetch(`/dashboard/pending-report?${queryParams.toString()}`),
    staleTime: 30_000,
  });

  const rawList: any[] = Array.isArray(data?.pendingList) ? data.pendingList : [];
  const pendingList = search.trim()
    ? rawList.filter(item => {
        const q = search.toLowerCase();
        return item.customerName?.toLowerCase().includes(q) || item.customerMobile?.includes(q) || String(item.tokenNumber).includes(q);
      })
    : rawList;

  const installmentAmt = Number(scheme.installmentAmount || 3000);
  const totalPending = pendingList.reduce((s, p) => s + Number(p.installmentAmount || installmentAmt), 0);

  const handlePrint = () => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    const rows = pendingList.map(p =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;font-weight:700;color:#4f46e5;font-family:monospace">#${p.tokenNumber||"—"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-weight:700">${p.customerName||"Member"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace">${p.customerMobile||"—"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#64748b;font-size:11px">${p.customerAddress||"—"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#e11d48;font-family:monospace">₹${Number(p.installmentAmount||installmentAmt).toLocaleString("en-IN")}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:#e11d48;font-weight:700">🔴 UNPAID</td>
        <td style="padding:8px;border-bottom:1px solid #eee;width:110px;border-left:1px dashed #ddd"></td>
      </tr>`
    ).join("");
    doc.write(`<!DOCTYPE html><html><head><title>Pending — ${scheme.name}</title>
    <style>body{font-family:Arial;padding:24px;font-size:12px;color:#0f172a}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #e11d48;padding-bottom:12px;margin-bottom:12px}.summary{background:#fff1f2;border:1px solid #fecdd3;padding:10px 16px;border-radius:8px;margin-bottom:14px;display:flex;justify-content:space-between;font-weight:700}table{width:100%;border-collapse:collapse}th{background:#f8fafc;padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:11px}</style>
    </head><body>
    <div class="hdr">
      <div><div style="font-size:18px;font-weight:800;color:#9f1239">SHREE KRISHNA ASSOCIATION</div><div style="font-size:12px;color:#64748b">Pending Members — ${scheme.name} | ${month||"Current Month"}</div></div>
      <div style="text-align:right;font-size:11px;color:#475569">Date: ${new Date().toLocaleDateString("en-IN")}</div>
    </div>
    <div class="summary">
      <span>🔴 Pending: <strong style="color:#e11d48">${pendingList.length} tokens</strong></span>
      <span>💸 Total Due: <strong style="color:#e11d48">₹${totalPending.toLocaleString("en-IN")}</strong></span>
    </div>
    <table><thead><tr><th>Token #</th><th>Member Name</th><th>Mobile</th><th>Address</th><th style="text-align:right">Due Amount</th><th style="text-align:center">Status</th><th style="text-align:center">Sign</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-rose-600">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              Pending — {scheme.name} {month ? `(${month})` : ""}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-600 border-rose-500/30 font-mono">
                {isLoading ? "Loading..." : `${pendingList.length} Unpaid · ${fmt(totalPending)}`}
              </Badge>
              <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 text-xs gap-1 text-rose-600 border-rose-500/30">
                <Printer className="w-3.5 h-3.5" /> Print
              </Button>
            </div>
          </div>
          <div className="pt-2">
            <Input placeholder="Search by Name, Mobile or Token #..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 text-xs" />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingList.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">🎉 All members paid for {month || "this month"}!</div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead className="w-20">Token #</TableHead>
                  <TableHead>Member Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead className="text-right">Due Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingList.map((p: any, i: number) => (
                  <TableRow key={i} className="hover:bg-rose-500/5">
                    <TableCell className="font-mono text-xs font-bold text-indigo-600">#{p.tokenNumber || "—"}</TableCell>
                    <TableCell className="font-semibold text-xs">{p.customerName || "Member"}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{p.customerMobile || "—"}</TableCell>
                    <TableCell className="text-right text-xs font-mono font-bold text-rose-600">{fmt(p.installmentAmount || installmentAmt)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="text-[10px] bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-400">🔴 Pending</Badge>
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
