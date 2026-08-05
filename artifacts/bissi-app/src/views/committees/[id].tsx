'use client';

import React, { useState, useMemo } from "react";
import { useParams, Link } from "@/lib/router-adapter";
import {
  useGetCommittee,
  useListCommitteeMembers,
  useAddCommitteeMember,
  useListCustomers,
  useListCollections,
  getListCommitteeMembersQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Plus, Users, Wallet, Ticket, Calendar, Banknote, Smartphone, Building2, CreditCard, Search, Sparkles, Phone, ShieldCheck, Download, ClipboardList, CheckCircle2, XCircle, Clock, Star, Gift } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { safeArray } from "@/lib/utils";

const addMemberSchema = z.object({
  customerId: z.coerce.number().min(1, "Customer required"),
  tokenNumber: z.string().optional(),
});

const typeColors: Record<string, string> = {
  daily: "bg-blue-500/10 text-blue-600 border-blue-200",
  weekly: "bg-purple-500/10 text-purple-600 border-purple-200",
  monthly: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  festival: "bg-amber-500/10 text-amber-600 border-amber-200",
  special: "bg-pink-500/10 text-pink-600 border-pink-200",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const modeIcon: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-3.5 w-3.5 text-emerald-600" />,
  upi: <Smartphone className="h-3.5 w-3.5 text-blue-600" />,
  bank: <Building2 className="h-3.5 w-3.5 text-purple-600" />,
  card: <CreditCard className="h-3.5 w-3.5 text-indigo-600" />,
};

function getInitials(name: string) {
  if (!name) return "CU";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Payment History Types & Hook
// ---------------------------------------------------------------------------
interface MonthPayment {
  monthNumber: number;
  monthName: string;
  status: "PAID" | "PENDING" | "LUCKY" | "UPCOMING";
  amount: number;
  expectedAmount: number;
  paymentDate: string | null;
  paymentMode: string | null;
}

interface MemberPaymentRow {
  tokenId: string;
  tokenNumber: string;
  tokenStatus: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerAddress: string;
  paidCount: number;
  pendingCount: number;
  totalPaidAmount: number;
  monthlyPayments: MonthPayment[];
}

interface PaymentHistoryData {
  success: boolean;
  committee: { id: string; name: string; monthlyInstallment: number };
  months: { monthNumber: number; monthName: string; dueDate: string | null }[];
  members: MemberPaymentRow[];
  summary: { totalMembers: number; totalMonths: number; totalPaid: number; totalPending: number };
}

function usePaymentHistory(committeeId: string | number, search: string) {
  return useQuery<PaymentHistoryData>({
    queryKey: ["committee-payment-history", committeeId, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      return customFetch<PaymentHistoryData>(`/committees/${committeeId}/payment-history${params.toString() ? `?${params}` : ""}`);
    },
    enabled: !!committeeId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Payment History Tab Component
// ---------------------------------------------------------------------------
function PaymentHistoryTab({ committeeId }: { committeeId: string | number }) {
  const [historySearch, setHistorySearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pendingFilter, setPendingFilter] = useState<"all" | "pending" | "paid">("all");

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(historySearch), 400);
    return () => clearTimeout(t);
  }, [historySearch]);

  const { data, isLoading, isError } = usePaymentHistory(committeeId, debouncedSearch);

  const filteredMembers = useMemo(() => {
    if (!data?.members) return [];
    if (pendingFilter === "all") return data.members;
    if (pendingFilter === "pending") return data.members.filter((m) => m.pendingCount > 0);
    return data.members.filter((m) => m.pendingCount === 0);
  }, [data?.members, pendingFilter]);

  // Per-month summary
  const monthSummary = useMemo(() => {
    if (!data?.months || !filteredMembers.length) return [];
    return data.months.map((_m, idx) => {
      let paid = 0;
      let pending = 0;
      let totalAmount = 0;
      for (const member of filteredMembers) {
        const mp = member.monthlyPayments[idx];
        if (mp?.status === "PAID") { paid++; totalAmount += mp.amount; }
        else if (mp?.status === "PENDING") pending++;
      }
      return { paid, pending, totalAmount };
    });
  }, [data?.months, filteredMembers]);

  const exportCSV = () => {
    if (!data) return;
    const headers = ["Token", "Name", "Mobile", "Address", ...data.months.map((m) => m.monthName), "Paid", "Pending", "Total Paid"];
    const rows = filteredMembers.map((m) => [
      m.tokenNumber,
      m.customerName,
      m.customerMobile || "",
      (m.customerAddress || "").replace(/,/g, " "),
      ...m.monthlyPayments.map((mp) => (mp.status === "PAID" ? mp.amount : mp.status === "LUCKY" ? "LUCKY" : "")),
      m.paidCount,
      m.pendingCount,
      m.totalPaidAmount,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${data.committee.name.replace(/\s+/g, "_")}_payment_history.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="flex items-center justify-center py-16">
          <div className="text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4 animate-spin" /> Loading payment history…</div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="flex items-center justify-center py-16 text-destructive">
          Failed to load payment history.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border shadow-sm bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-blue-500" />Members</div>
            <div className="text-2xl font-black text-foreground mt-1">{data.summary.totalMembers}</div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Paid</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{data.summary.totalPaid.toLocaleString("en-IN")}</div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm bg-gradient-to-br from-red-500/5 to-transparent">
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-red-500" />Pending</div>
            <div className="text-2xl font-black text-red-600 mt-1">{data.summary.totalPending.toLocaleString("en-IN")}</div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-purple-500" />Months</div>
            <div className="text-2xl font-black text-foreground mt-1">{data.summary.totalMonths}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search name, mobile, token…"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <Select value={pendingFilter} onValueChange={(v) => setPendingFilter(v as any)}>
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            <SelectItem value="pending">Pending Only</SelectItem>
            <SelectItem value="paid">Fully Paid</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 text-xs h-9">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {/* Excel-Style Grid */}
      <Card className="border shadow-sm">
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-max">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="pl-4 sticky left-0 bg-muted/60 z-20 min-w-[50px] text-center font-bold text-[11px]">#</TableHead>
                  <TableHead className="sticky left-[50px] bg-muted/60 z-20 min-w-[180px] font-bold text-[11px]">Name</TableHead>
                  <TableHead className="min-w-[110px] font-bold text-[11px]">Mobile</TableHead>
                  {data.months.map((month) => (
                    <TableHead key={month.monthNumber} className="text-center min-w-[80px] font-bold text-[11px] px-1">
                      {month.monthName}
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[60px] font-bold text-[11px] bg-emerald-500/10">Paid</TableHead>
                  <TableHead className="text-center min-w-[70px] font-bold text-[11px] bg-red-500/10 pr-4">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={data.months.length + 4} className="text-center py-12 text-muted-foreground">
                      No members found.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filteredMembers.map((member) => (
                      <TableRow key={member.tokenId} className="hover:bg-muted/30 transition-colors text-xs">
                        <TableCell className="pl-4 sticky left-0 bg-card z-10 font-mono font-bold text-primary text-center">
                          {member.tokenNumber}
                        </TableCell>
                        <TableCell className="sticky left-[50px] bg-card z-10">
                          <Link href={`/customers/${member.customerId}`}>
                            <span className="font-semibold text-foreground hover:text-primary hover:underline cursor-pointer truncate block max-w-[170px]">
                              {member.customerName}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground text-[11px]">
                          {member.customerMobile || "—"}
                        </TableCell>
                        {member.monthlyPayments.map((mp) => (
                          <TableCell key={mp.monthNumber} className="text-center px-1 py-1.5">
                            {mp.status === "PAID" ? (
                              <span className="inline-flex items-center justify-center w-full px-1 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20" title={`Paid on ${mp.paymentDate ? new Date(mp.paymentDate).toLocaleDateString("en-IN") : "—"}`}>
                                {formatCurrency(mp.amount)}
                              </span>
                            ) : mp.status === "PENDING" ? (
                              <span className="inline-flex items-center justify-center w-full px-1 py-0.5 rounded text-[11px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20" title="Pending">
                                ✗
                              </span>
                            ) : mp.status === "LUCKY" ? (
                              <span className="inline-flex items-center justify-center w-full px-1 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/20" title="Lucky Winner">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-full px-1 py-0.5 rounded text-[11px] text-muted-foreground/40">
                                —
                              </span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold text-emerald-600 bg-emerald-500/5">
                          {member.paidCount}
                        </TableCell>
                        <TableCell className="text-center font-bold pr-4 bg-red-500/5">
                          {member.pendingCount > 0 ? (
                            <span className="text-red-600">{member.pendingCount}</span>
                          ) : (
                            <span className="text-emerald-600">✓</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Summary Row */}
                    <TableRow className="bg-muted/70 hover:bg-muted/70 font-bold border-t-2 border-primary/20">
                      <TableCell className="pl-4 sticky left-0 bg-muted/70 z-10 text-center text-[11px]">—</TableCell>
                      <TableCell className="sticky left-[50px] bg-muted/70 z-10 text-[11px] uppercase tracking-wider text-primary">Total</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{filteredMembers.length} members</TableCell>
                      {monthSummary.map((ms, idx) => (
                        <TableCell key={idx} className="text-center px-1 text-[10px]">
                          <div className="text-emerald-600">{ms.paid}✓</div>
                          {ms.pending > 0 && <div className="text-red-500">{ms.pending}✗</div>}
                        </TableCell>
                      ))}
                      <TableCell className="text-center text-emerald-600 bg-emerald-500/10">
                        {filteredMembers.reduce((s, m) => s + m.paidCount, 0)}
                      </TableCell>
                      <TableCell className="text-center text-red-600 pr-4 bg-red-500/10">
                        {filteredMembers.reduce((s, m) => s + m.pendingCount, 0)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gift Record Tab Component (Committee Specific Gift Sheet Matrix)
// ---------------------------------------------------------------------------
function GiftRecordTab({ committeeId }: { committeeId: string | number }) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["committee-gift-matrix", committeeId, search],
    queryFn: () => customFetch(`/committees/${committeeId}/gift-matrix${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    enabled: !!committeeId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Clock className="h-4 w-4 animate-spin text-purple-600" /> Loading gift records…
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.success) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="flex items-center justify-center py-16 text-destructive">
          Failed to load gift records for this committee.
        </CardContent>
      </Card>
    );
  }

  const months: string[] = data.months || [];
  const members: any[] = data.members || [];

  const exportCSV = () => {
    const headers = ["Token No", "Customer Name", "Mobile", ...months, "Total Gifts"];
    const rows = members.map(m => [
      m.tokenNumber,
      `"${m.customerName}"`,
      m.customerMobile || "",
      ...m.monthlyGifts.map((mg: any) => mg.gift ? `"${mg.gift}"` : ""),
      m.giftCount
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${data.committee?.name || "Committee"}_Gift_Sheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search member, mobile, token..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 text-xs h-9 text-purple-600 border-purple-200">
          <Download className="h-3.5 w-3.5" /> Export Gift Sheet CSV
        </Button>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-max">
            <Table>
              <TableHeader>
                <TableRow className="bg-purple-500/10 hover:bg-purple-500/10">
                  <TableHead className="pl-4 sticky left-0 bg-purple-50/90 dark:bg-slate-900/90 z-20 font-bold text-[11px] text-purple-900 dark:text-purple-300"># Token</TableHead>
                  <TableHead className="sticky left-[65px] bg-purple-50/90 dark:bg-slate-900/90 z-20 min-w-[180px] font-bold text-[11px] text-purple-900 dark:text-purple-300">Customer Name</TableHead>
                  <TableHead className="min-w-[110px] font-bold text-[11px] text-purple-900 dark:text-purple-300">Mobile</TableHead>
                  {months.map((m) => (
                    <TableHead key={m} className="text-center min-w-[110px] font-bold text-[11px] text-purple-900 dark:text-purple-300 px-2">
                      {m}
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[70px] font-bold text-[11px] bg-purple-500/20 text-purple-900 dark:text-purple-300 pr-4">Gifts Won</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={months.length + 4} className="text-center py-12 text-muted-foreground">
                      No gift items claimed or recorded for this committee yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member: any) => (
                    <TableRow key={member.tokenId} className="hover:bg-purple-500/5 transition-colors text-xs">
                      <TableCell className="pl-4 sticky left-0 bg-card z-10 font-mono font-bold text-purple-600">
                        #{member.tokenNumber}
                      </TableCell>
                      <TableCell className="sticky left-[65px] bg-card z-10 font-semibold text-foreground truncate max-w-[180px]">
                        {member.customerName}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground text-[11px]">
                        {member.customerMobile || "—"}
                      </TableCell>
                      {member.monthlyGifts.map((mg: any, idx: number) => (
                        <TableCell key={idx} className="text-center px-1 py-1.5">
                          {mg.gift ? (
                            <Badge
                              className={`text-[10px] font-medium px-2 py-0.5 whitespace-nowrap shadow-none ${
                                mg.isCash
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                              }`}
                            >
                              {mg.isCash ? "💵 " : "🎁 "}
                              {mg.gift}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/30 text-[11px]">—</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold text-purple-600 bg-purple-500/5 pr-4">
                        {member.giftCount > 0 ? (
                          <Badge variant="secondary" className="bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold">
                            {member.giftCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/40">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CommitteeLotteryTab({ committeeId }: { committeeId: string | number }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["committee-lottery-history", committeeId],
    queryFn: () => customFetch(`/committees/${committeeId}/lottery-history`),
    enabled: !!committeeId,
  });

  const lotteries = data?.lotteries || data?.data || [];

  if (isLoading) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Clock className="h-4 w-4 animate-spin text-amber-500" /> Loading lottery history…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-amber-500/10">
              <TableHead className="pl-5">Draw Date</TableHead>
              <TableHead>Winning Token (टोकन सं.)</TableHead>
              <TableHead>Winner Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Reward Description</TableHead>
              <TableHead className="pr-5 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lotteries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No lottery draw history recorded for this committee yet.
                </TableCell>
              </TableRow>
            ) : (
              lotteries.map((l: any) => (
                <TableRow key={l.id} className="hover:bg-amber-500/5 transition-colors text-xs">
                  <TableCell className="pl-5 font-mono text-muted-foreground">
                    {l.drawDate ? new Date(l.drawDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </TableCell>
                  <TableCell className="font-mono font-bold text-amber-600">
                    #{l.tokenNumber}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {l.winnerCustomerId ? (
                      <Link href={`/customers/${l.winnerCustomerId}`}>
                        <span className="hover:underline hover:text-primary cursor-pointer">{l.winnerName}</span>
                      </Link>
                    ) : (
                      l.winnerName
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {l.winnerMobile || "—"}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                      ✨ {l.rewardDescription || "Lucky Winner"}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-5 text-right font-bold capitalize text-emerald-600">
                    {l.status || "Completed"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CommitteeInterestTab({ committeeId }: { committeeId: string | number }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["committee-interests", committeeId],
    queryFn: () => customFetch(`/committees/${committeeId}/interests`),
    enabled: !!committeeId,
  });

  const interests = data?.interests || data?.data || [];

  if (isLoading) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Clock className="h-4 w-4 animate-spin text-blue-500" /> Loading committee interest accounts…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-blue-500/10">
              <TableHead className="pl-5">Serial #</TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Due Day</TableHead>
              <TableHead className="text-right">Monthly Interest Amount</TableHead>
              <TableHead className="text-right">Total Interest Paid</TableHead>
              <TableHead className="pr-5 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {interests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No interest accounts associated with members of this committee.
                </TableCell>
              </TableRow>
            ) : (
              interests.map((acc: any) => (
                <TableRow key={acc.id} className="hover:bg-blue-500/5 transition-colors text-xs">
                  <TableCell className="pl-5 font-mono font-bold text-blue-600">
                    #{acc.serial}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    <Link href={`/customers/${acc.customerId}`}>
                      <span className="hover:underline hover:text-primary cursor-pointer">{acc.customerName}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {acc.customerMobile || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {acc.dueDay ? `${acc.dueDay}th of month` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold text-foreground">
                    {formatCurrency(Number(acc.interestAmount || 0))}
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">
                    {formatCurrency(Number(acc.totalPaid || 0))}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Badge variant={acc.status === "ACTIVE" ? "default" : "secondary"}>
                      {acc.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CommitteeReportsTab({ committee, members, collections }: { committee: any; members: any[]; collections: any[] }) {
  const totalCollected = collections.reduce((s, c) => s + Number(c.amount || 0), 0);
  const poolSize = (committee?.installmentAmount || 0) * (committee?.memberLimit || 100);
  const remaining = poolSize - totalCollected;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Total Pool Target</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-black text-foreground">{formatCurrency(poolSize)}</CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Total Collected to Date</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-black text-emerald-600">{formatCurrency(totalCollected)}</CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Remaining Pool</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-black text-blue-600">{formatCurrency(Math.max(0, remaining))}</CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader><CardTitle className="text-sm font-bold">Committee Summary Report</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex justify-between py-2 border-b"><span>Committee Name</span><span className="font-bold">{committee?.name}</span></div>
          <div className="flex justify-between py-2 border-b"><span>Total Members Joined</span><span className="font-bold">{members.length} / {committee?.memberLimit}</span></div>
          <div className="flex justify-between py-2 border-b"><span>Monthly Installment</span><span className="font-bold">{formatCurrency(committee?.installmentAmount || 0)}</span></div>
          <div className="flex justify-between py-2 border-b"><span>Total Collection Transactions</span><span className="font-bold">{collections.length}</span></div>
          <div className="flex justify-between py-2"><span>Scheme Duration</span><span className="font-bold">{committee?.duration || 20} Months</span></div>
        </CardContent>
      </Card>
    </div>
  );
}

function CommitteeDocumentsTab({ committee }: { committee: any }) {
  return (
    <Card className="border shadow-sm">
      <CardHeader><CardTitle className="text-sm font-bold">Committee Rules & Documents (दस्तावेज़ एवं नियम)</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
          <h4 className="font-bold text-foreground">Terms & Conditions (नियम व शर्तें)</h4>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
            {committee?.rules || "1. प्रत्येक माह की निश्चित तारीख को किश्त जमा करना अनिवार्य है।\n2. ड्रा में लकी विजेता बनने पर किश्त पूर्ण मानी जाएगी।\n3. नियत समय पर भुगतान न करने पर विलम्ब शुल्क देय होगा।"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommitteeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id || "";
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: committee, isLoading } = useQuery<any>({
    queryKey: ["committee-detail", id],
    queryFn: () => customFetch(`/committees/${id}`),
    enabled: !!id,
  });

  const { data: rawMembers } = useQuery<any[]>({
    queryKey: ["committee-members", id],
    queryFn: () => customFetch(`/committees/${id}/members`),
    enabled: !!id,
  });

  const { data: collectionsRes } = useQuery<any>({
    queryKey: ["committee-collections", id],
    queryFn: () => customFetch(`/committees/${id}/collections`),
    enabled: !!id,
  });

  const { data: rawCustomers } = useListCustomers({ limit: 500 });
  
  const addMember = useAddCommitteeMember();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const members = safeArray<any>(rawMembers);
  const collections = collectionsRes?.collections || collectionsRes?.data || [];
  const customers = safeArray<any>(rawCustomers);

  const form = useForm<z.infer<typeof addMemberSchema>>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { customerId: 0, tokenNumber: "" },
  });

  const onAddMember = (values: z.infer<typeof addMemberSchema>) => {
    addMember.mutate(
      { id: parseInt(id) || (id as any), data: { customerId: values.customerId, tokenNumber: values.tokenNumber || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Member added successfully" });
          setIsAddMemberOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: ["committee-members", id] });
        },
        onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return <div className="p-8 text-muted-foreground flex items-center justify-center min-h-[300px]">Loading committee details…</div>;
  if (!committee) return <div className="p-8 text-center text-muted-foreground">Committee not found.</div>;

  const poolSize = (committee.installmentAmount || 0) * (committee.memberLimit || 100);
  const memberIds = new Set(members.map((m) => m.customerId));
  const availableCustomers = customers.filter((c) => !memberIds.has(c.id));

  // Group members by customer
  const grouped = new Map<string, { name: string; mobile: string | null; ref: string; tokens: { number: string; status: string }[]; customerId: string }>();
  for (const m of members) {
    const custId = String(m.customerId || m.id);
    if (!grouped.has(custId)) {
      grouped.set(custId, {
        customerId: custId,
        name: m.customerName || `Customer #${custId}`,
        mobile: m.customerMobile || null,
        ref: m.customerReferenceNumber || `CUST-${custId}`,
        tokens: [],
      });
    }
    const tokenNum = String(m.tokenNumber || m.token_number || m.id);
    const rawSt = (m.status || "active").toString().toUpperCase();
    const isLucky = rawSt === "LUCKY" || rawSt === "OUT" || rawSt === "WINNER" || (m as any).isWinner;
    grouped.get(custId)!.tokens.push({
      number: tokenNum,
      status: isLucky ? "lucky" : rawSt.toLowerCase(),
    });
  }

  // Filter grouped items
  const allGroupedList = [...grouped.values()];
  const filteredGrouped = allGroupedList.filter((g) => {
    const matchesSearch =
      !searchQuery ||
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.mobile && g.mobile.includes(searchQuery)) ||
      (g.ref && g.ref.toLowerCase().includes(searchQuery.toLowerCase())) ||
      g.tokens.some((t) => t.number.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" ||
      g.tokens.some((t) => t.status === statusFilter);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/committees">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{committee.name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border capitalize ${typeColors[committee.type] ?? "bg-muted text-muted-foreground"}`}>
                {committee.type} Bissi
              </span>
              <Badge variant={committee.status === "active" ? "default" : committee.status === "completed" ? "secondary" : "destructive"} className="px-2.5 py-0.5">
                {committee.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <span>Branch: <strong className="text-foreground font-medium">{committee.branchName || "Shree Krishna Associate"}</strong></span>
              <span>•</span>
              <span>Total Tokens: <strong className="text-foreground font-medium">{members.length}</strong></span>
            </p>
          </div>
        </div>

        <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
          <DialogTrigger asChild>
            <Button disabled={committee.status !== "active"} className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Member to Committee</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onAddMember)} className="space-y-4">
                <FormField control={form.control} name="customerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableCustomers.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.referenceNumber || c.mobile})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={addMember.isPending}>
                    {addMember.isPending ? "Adding…" : "Add Member"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Monthly Installment</span>
              <Ticket className="h-4 w-4 text-primary opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-foreground">{formatCurrency(committee.installmentAmount)}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Per Token / Month</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Total Members</span>
              <Users className="h-4 w-4 text-blue-600 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-foreground">
              {members.length} <span className="text-sm font-normal text-muted-foreground">/ {committee.memberLimit}</span>
            </div>
            <div className="w-full bg-muted h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${Math.min(100, (members.length / (committee.memberLimit || 1)) * 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Total Pool Size</span>
              <Wallet className="h-4 w-4 text-emerald-600 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-emerald-600">{formatCurrency(poolSize)}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Full Maturity Pool Value</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Draw Status</span>
              <Calendar className="h-4 w-4 text-amber-600 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-bold text-foreground">
              {committee.drawDate ? new Date(committee.drawDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Monthly Draw"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Regular Draw Schedule</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Controls */}
      <Tabs defaultValue="members" className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
          <TabsList className="bg-muted/60 p-1 flex-wrap h-auto">
            <TabsTrigger value="members" className="px-3 font-semibold">
              Members ({allGroupedList.length})
            </TabsTrigger>
            <TabsTrigger value="payment-history" className="px-3 font-semibold gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" /> Payment History
            </TabsTrigger>
            <TabsTrigger value="collections" className="px-3 font-semibold">
              Collections ({collections.length})
            </TabsTrigger>
            <TabsTrigger value="gift-records" className="px-3 font-semibold gap-1.5 text-purple-600 dark:text-purple-400">
              <Gift className="h-3.5 w-3.5" /> Gift Records (उपहार)
            </TabsTrigger>
            <TabsTrigger value="lottery-history" className="px-3 font-semibold gap-1.5 text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3.5 w-3.5" /> Lottery History (ड्रा)
            </TabsTrigger>
            <TabsTrigger value="interest" className="px-3 font-semibold gap-1.5 text-blue-600">
              <Banknote className="h-3.5 w-3.5" /> Interest
            </TabsTrigger>
            <TabsTrigger value="reports" className="px-3 font-semibold">
              Reports
            </TabsTrigger>
            <TabsTrigger value="documents" className="px-3 font-semibold">
              Documents
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search member, mobile, token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tokens</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="lucky">Lucky Winners</SelectItem>
                <SelectItem value="out">Out / Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Members Tab Content */}
        <TabsContent value="members" className="mt-2">
          <Card className="border shadow-sm">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-5 w-[140px]">Ref No.</TableHead>
                    <TableHead className="min-w-[200px]">Customer</TableHead>
                    <TableHead className="w-[150px]">Mobile</TableHead>
                    <TableHead className="w-[150px]">Tokens Owned</TableHead>
                    <TableHead className="pr-5">Token Details & Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGrouped.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        No members matching filter criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredGrouped.map((g) => {
                      const totalTokens = g.tokens.length;
                      const luckyCount = g.tokens.filter((t) => t.status === "lucky").length;

                      return (
                        <TableRow key={g.customerId} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="pl-5 font-mono text-xs font-semibold text-muted-foreground">
                            {g.ref || `CUST-${g.customerId}`}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shadow-xs">
                                {getInitials(g.name)}
                              </div>
                              <div>
                                <Link href={`/customers/${g.customerId}`}>
                                  <span className="font-semibold text-sm hover:underline cursor-pointer text-foreground hover:text-primary transition-colors">
                                    {g.name}
                                  </span>
                                </Link>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            {g.mobile ? (
                              <a href={`tel:${g.mobile}`} className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
                                <Phone className="h-3 w-3 text-muted-foreground/70" />
                                {g.mobile}
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className="font-mono text-xs font-bold bg-primary/10 text-primary border-0">
                                {totalTokens} {totalTokens === 1 ? "Token" : "Tokens"}
                              </Badge>
                              {luckyCount > 0 && (
                                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1">
                                  <Sparkles className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> {luckyCount} Lucky
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="pr-5">
                            <div className="flex flex-wrap items-center gap-1.5 py-1">
                              {g.tokens.map((t) => {
                                const isLucky = t.status === "lucky" || t.status === "out" || t.status === "closed";
                                return (
                                  <span
                                    key={t.number}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold border transition-all shadow-xs ${
                                      isLucky
                                        ? "bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-500/40 ring-1 ring-amber-400/30"
                                        : "bg-card text-foreground border-border hover:border-primary/40"
                                    }`}
                                  >
                                    <span className="text-primary font-black">#{t.number}</span>
                                    {isLucky ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 font-sans font-bold bg-amber-400/20 px-1.5 py-0.5 rounded">
                                        ✨ Lucky Winner (Out)
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground font-sans font-normal">Active</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment History Tab Content */}
        <TabsContent value="payment-history" className="mt-2">
          <PaymentHistoryTab committeeId={id} />
        </TabsContent>

        {/* Collections Tab Content */}
        <TabsContent value="collections" className="mt-2">
          <Card className="border shadow-sm">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-5">Receipt</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Collector</TableHead>
                    <TableHead className="text-center">Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="pr-5 text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No collections recorded yet for this committee.
                      </TableCell>
                    </TableRow>
                  ) : (
                    collections.map((col: any) => (
                      <TableRow key={col.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="pl-5 font-mono text-xs font-semibold text-muted-foreground">
                          {col.receiptNumber || `REC-${col.id}`}
                        </TableCell>
                        <TableCell className="font-semibold text-sm text-foreground">
                          {col.customerName || `#${col.customerId}`}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {col.collectorName || "Admin Collector"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="gap-1 text-xs capitalize bg-card">
                            {modeIcon[col.paymentMode] || <Banknote className="h-3.5 w-3.5" />}
                            {col.paymentMode || "Cash"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-black text-emerald-600 text-sm">
                          {formatCurrency(Number(col.amount || 0))}
                        </TableCell>
                        <TableCell className="pr-5 text-right text-xs font-mono text-muted-foreground">
                          {col.paymentDate
                            ? new Date(col.paymentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gift Record Tab Content */}
        <TabsContent value="gift-records" className="mt-2">
          <GiftRecordTab committeeId={id} />
        </TabsContent>

        {/* Lottery History Tab Content */}
        <TabsContent value="lottery-history" className="mt-2">
          <CommitteeLotteryTab committeeId={id} />
        </TabsContent>

        {/* Interest Tab Content */}
        <TabsContent value="interest" className="mt-2">
          <CommitteeInterestTab committeeId={id} />
        </TabsContent>

        {/* Reports Tab Content */}
        <TabsContent value="reports" className="mt-2">
          <CommitteeReportsTab committee={committee} members={members} collections={collections} />
        </TabsContent>

        {/* Documents Tab Content */}
        <TabsContent value="documents" className="mt-2">
          <CommitteeDocumentsTab committee={committee} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
