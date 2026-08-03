import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { safeArray } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Gift, Search, Trophy, Printer, Calendar, CheckCircle2, Clock, Star,
  TrendingUp, Package, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMITTEES = [
  { id: "all", name: "Sabhi Bissi Schemes", uuid: "all" },
  { id: "11111111-1111-1111-1111-111111111111", name: "Hare Ka Sahara (20th Date)", short: "Hare Ka Sahara" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Shree Krishna (Lottery)", short: "Shree Krishna" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Pyare Mohan (15th Date)", short: "Pyare Mohan" },
  { id: "a3d68b9c-63df-4884-a5ad-eb8a17e3be31", name: "Sawariya Seth (5th Date)", short: "Sawariya Seth" },
];

const NOW = new Date();
const CURRENT_MONTH = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}`;

const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const isCurrentMonth = (month: string) => month === CURRENT_MONTH;
const isFuture = (month: string) => month > CURRENT_MONTH;
const isPast = (month: string) => month < CURRENT_MONTH;

type GiftRecord = {
  id: number; committee_id: string; committee_name: string;
  winnerName: string; winnerMobile?: string; tokenNumber?: number;
  drawDate: string; giftName: string; status: string;
};

type ScheduleRow = {
  month: string; month_label: string; draw_date: string;
  committee_id: string; committee_name: string;
  total: number; lucky_count: number; delivered_count: number; pending_count: number;
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GiftsPage() {
  const [tab, setTab] = useState("schedule");
  const [committeeFilter, setCommitteeFilter] = useState("all");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Gift className="w-6 h-6 text-purple-500" />
            Gifts & Lottery Winners
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Month-wise gift schedule — past records, current month, and upcoming
          </p>
        </div>
        <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMMITTEES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="schedule"><Calendar className="h-4 w-4 mr-1" />Monthly Schedule</TabsTrigger>
          <TabsTrigger value="current"><Star className="h-4 w-4 mr-1 text-amber-500" />Is Mahine</TabsTrigger>
          <TabsTrigger value="lucky"><Trophy className="h-4 w-4 mr-1 text-amber-500" />Lucky Winners</TabsTrigger>
          <TabsTrigger value="all"><Package className="h-4 w-4 mr-1" />Sabhi Records</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          <ScheduleTab committeeFilter={committeeFilter} />
        </TabsContent>
        <TabsContent value="current" className="mt-4">
          <CurrentMonthTab committeeFilter={committeeFilter} />
        </TabsContent>
        <TabsContent value="lucky" className="mt-4">
          <LuckyWinnersTab committeeFilter={committeeFilter} />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <AllGiftsTab committeeFilter={committeeFilter} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Monthly Schedule Tab ─────────────────────────────────────────────────────
function ScheduleTab({ committeeFilter }: { committeeFilter: string }) {
  const { data } = useQuery<{ success: boolean; schedule: ScheduleRow[] }>({
    queryKey: ["gifts-schedule", committeeFilter],
    queryFn: () => {
      const p = committeeFilter !== "all" ? `?committeeId=${committeeFilter}` : "";
      return api.get(`/gifts/monthly-schedule${p}`);
    },
    staleTime: 60_000,
  });

  const schedule = safeArray<ScheduleRow>(data?.schedule);

  // Group by month
  const byMonth: Record<string, ScheduleRow[]> = {};
  for (const row of schedule) {
    if (!byMonth[row.month]) byMonth[row.month] = [];
    byMonth[row.month].push(row);
  }

  const months = Object.keys(byMonth).sort();
  const past = months.filter(isPast);
  const current = months.filter(isCurrentMonth);
  const future = months.filter(isFuture);

  const renderMonthSection = (m: string, label: string, colorClass: string, bgClass: string) => {
    const rows = byMonth[m] || [];
    const totalGifts = rows.reduce((s, r) => s + r.total, 0);
    const totalLucky = rows.reduce((s, r) => s + r.lucky_count, 0);
    const totalDelivered = rows.reduce((s, r) => s + r.delivered_count, 0);

    return (
      <div key={m} className={`rounded-xl border p-4 ${bgClass}`}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className={`h-4 w-4 ${colorClass}`} />
            <span className={`font-bold ${colorClass}`}>{label}</span>
            {isCurrentMonth(m) && <Badge className="bg-amber-500 text-white text-xs">Current Month</Badge>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono font-bold">{totalGifts} gifts</span>
            {totalLucky > 0 && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">🏆 {totalLucky} Lucky</Badge>}
            {totalDelivered > 0 && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">✓ {totalDelivered} Delivered</Badge>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {rows.map(r => (
            <div key={r.committee_id} className="bg-background/80 rounded-lg border p-3 space-y-1">
              <p className="text-xs font-bold text-foreground">{r.committee_name}</p>
              <p className="text-xs text-muted-foreground">Draw: {fmt(r.draw_date)}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-[11px] bg-purple-100 text-purple-700 rounded px-1.5 py-0.5 font-medium">{r.total} gifts</span>
                {r.lucky_count > 0 && <span className="text-[11px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-medium">🏆 {r.lucky_count}</span>}
                {r.pending_count > 0 && <span className="text-[11px] bg-rose-100 text-rose-700 rounded px-1.5 py-0.5 font-medium">⏳ {r.pending_count}</span>}
                {r.delivered_count > 0 && <span className="text-[11px] bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5 font-medium">✓ {r.delivered_count}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Past Months</p>
            <p className="text-2xl font-bold">{past.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-300">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-amber-700 font-medium">Current Month</p>
            <p className="text-2xl font-bold text-amber-600">{current.length > 0 ? "Active" : "—"}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-300">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-blue-700 font-medium">Upcoming Months</p>
            <p className="text-2xl font-bold text-blue-600">{future.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Current month first */}
      {current.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-1">
            <Star className="h-4 w-4" /> Is Mahine (Current Month)
          </h3>
          {current.map(m => renderMonthSection(m, byMonth[m][0].month_label.trim(), "text-amber-700", "bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-800"))}
        </div>
      )}

      {/* Upcoming months */}
      {future.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1">
            <Clock className="h-4 w-4" /> Aane Wale Mahine (Upcoming — {future.length} months)
          </h3>
          <div className="space-y-3">
            {future.slice(0, 6).map(m => renderMonthSection(m, byMonth[m][0].month_label.trim(), "text-blue-700", "bg-blue-50 dark:bg-blue-900/10 border-blue-300 dark:border-blue-800"))}
          </div>
        </div>
      )}

      {/* Past months */}
      {past.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Pichle Mahine (Past — {past.length} months)
          </h3>
          <div className="space-y-3">
            {[...past].reverse().map(m => renderMonthSection(m, byMonth[m][0].month_label.trim(), "text-slate-600", "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700"))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Current Month Tab ────────────────────────────────────────────────────────
function CurrentMonthTab({ committeeFilter }: { committeeFilter: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ success: boolean; winners: GiftRecord[] }>({
    queryKey: ["gifts-current", committeeFilter],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "500", offset: "0" });
      if (committeeFilter !== "all") p.set("committeeId", committeeFilter);
      // Filter to current month
      p.set("month", CURRENT_MONTH);
      return api.get(`/gifts/bissi-winners?${p}`);
    },
    staleTime: 30_000,
  });

  const markDelivered = useMutation({
    mutationFn: (id: number) => api.patch(`/gifts/${id}/status`, { status: "distributed" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gifts-current"] });
      toast({ title: "Marked as delivered!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // All gifts from this month
  const allGifts = safeArray<GiftRecord>(data?.winners);
  // Filter to current month (API might return all, so filter client-side too)
  const gifts = allGifts.filter(g => g.drawDate?.slice(0, 7) === CURRENT_MONTH || allGifts.length < 50);
  const lucky = gifts.filter(g => g.giftName?.toLowerCase().includes("lucky"));
  const regular = gifts.filter(g => !g.giftName?.toLowerCase().includes("lucky"));
  const pending = regular.filter(g => g.status === "given");
  const delivered = regular.filter(g => g.status === "distributed");

  const monthLabel = new Date(`${CURRENT_MONTH}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Badge className="bg-amber-500 text-white px-3 py-1 text-sm">
          <Star className="h-3.5 w-3.5 mr-1" />{monthLabel}
        </Badge>
        <span className="text-sm text-muted-foreground">{gifts.length} total gifts this month</span>
      </div>

      {gifts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Is mahine koi gift record nahi mila.</p>
            <p className="text-xs mt-1">Scheme change karke try karein.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-3">
                <p className="text-xs text-amber-700 font-medium">Lucky Winners</p>
                <p className="text-2xl font-bold text-amber-600">{lucky.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-3">
                <p className="text-xs text-purple-700 font-medium">Gift Items</p>
                <p className="text-2xl font-bold text-purple-600">{regular.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-rose-50 border-rose-200">
              <CardContent className="p-3">
                <p className="text-xs text-rose-700 font-medium">Pending Delivery</p>
                <p className="text-2xl font-bold text-rose-600">{pending.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-3">
                <p className="text-xs text-emerald-700 font-medium">Delivered</p>
                <p className="text-2xl font-bold text-emerald-600">{delivered.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Lucky Winners this month */}
          {lucky.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-1">
                <Trophy className="h-4 w-4" /> Lucky Draw Winners — {monthLabel}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {lucky.map(g => (
                  <div key={g.id} className="p-4 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="h-5 w-5 text-amber-500" />
                      <span className="font-bold text-amber-700">Lucky Winner 🏆</span>
                    </div>
                    <p className="font-bold text-lg">{g.winnerName || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-1">{g.committee_name || g.committee_id}</p>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="outline" className="font-mono text-indigo-600 border-indigo-300">Token #{g.tokenNumber || "—"}</Badge>
                      <span className="text-xs text-muted-foreground">{fmt(g.drawDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regular gifts - table with delivery tracking */}
          <div>
            <h3 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-1">
              <Gift className="h-4 w-4" /> Gift Items — {monthLabel}
              {pending.length > 0 && (
                <Badge variant="destructive" className="text-xs ml-2">{pending.length} pending collection</Badge>
              )}
            </h3>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Name</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Gift / Item</TableHead>
                      <TableHead>Scheme</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regular.map(g => (
                      <TableRow key={g.id} className={g.status === "distributed" ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{g.winnerName || "—"}</TableCell>
                        <TableCell className="font-mono text-indigo-600 font-bold">#{g.tokenNumber || "—"}</TableCell>
                        <TableCell>
                          <span className="font-semibold text-purple-700">{g.giftName || "—"}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{(g.committee_name || "").replace(" Bissi", "")}</TableCell>
                        <TableCell className="text-sm">{fmt(g.drawDate)}</TableCell>
                        <TableCell>
                          {g.status === "distributed" ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs">✓ Delivered</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">⏳ Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {g.status !== "distributed" && (
                            <Button size="sm" variant="outline"
                              className="text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                              onClick={() => markDelivered.mutate(g.id)}>
                              Mark Delivered
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Lucky Winners Tab ────────────────────────────────────────────────────────
function LuckyWinnersTab({ committeeFilter }: { committeeFilter: string }) {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["lucky-winners", committeeFilter, search],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "500", offset: "0", rewardType: "lucky" });
      if (committeeFilter !== "all") p.set("committeeId", committeeFilter);
      if (search) p.set("search", search);
      return api.get(`/gifts/bissi-winners?${p}`);
    },
    staleTime: 60_000,
  });

  const all = safeArray<GiftRecord>(data?.winners);
  // Client-side filter for lucky
  const lucky = all.filter(g => g.giftName?.toLowerCase().includes("lucky") || all.length === 0);

  // Group by committee
  const byComm: Record<string, GiftRecord[]> = {};
  for (const g of lucky) {
    const k = g.committee_name || g.committee_id || "Unknown";
    if (!byComm[k]) byComm[k] = [];
    byComm[k].push(g);
  }

  return (
    <div className="space-y-5">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search winner name..." className="pl-9"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading lucky winners...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byComm).map(([comm, winners]) => (
            <div key={comm}>
              <h3 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4" />{comm}
                <Badge variant="outline" className="bg-amber-50 border-amber-300 text-amber-700 text-xs">{winners.length} lucky wins</Badge>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {winners.sort((a, b) => a.drawDate < b.drawDate ? 1 : -1).map(g => (
                  <div key={g.id} className={`p-4 rounded-xl border-2 ${
                    isFuture(g.drawDate?.slice(0, 7) || "")
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                      : isCurrentMonth(g.drawDate?.slice(0, 7) || "")
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                        : "border-slate-200 bg-slate-50 dark:bg-slate-800/40"
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <Trophy className="h-5 w-5 text-amber-500" />
                      {isFuture(g.drawDate?.slice(0, 7) || "") ? (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">Upcoming</Badge>
                      ) : isCurrentMonth(g.drawDate?.slice(0, 7) || "") ? (
                        <Badge className="bg-amber-500 text-white text-xs">This Month</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Past</Badge>
                      )}
                    </div>
                    <p className="font-bold text-base">{g.winnerName || "—"}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="font-mono text-indigo-600 border-indigo-300">#{g.tokenNumber || "—"}</Badge>
                      <span className="text-xs text-muted-foreground">{fmt(g.drawDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(byComm).length === 0 && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No lucky winners found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── All Gifts Tab ────────────────────────────────────────────────────────────
function AllGiftsTab({ committeeFilter }: { committeeFilter: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const { toast } = useToast();
  const qc = useQueryClient();
  const PER_PAGE = 100;

  const { data, isLoading } = useQuery<any>({
    queryKey: ["gifts-all-tab", committeeFilter, search, page],
    queryFn: () => {
      const p = new URLSearchParams({ limit: String(PER_PAGE), offset: String(page * PER_PAGE) });
      if (committeeFilter !== "all") p.set("committeeId", committeeFilter);
      if (search) p.set("search", search);
      return api.get(`/gifts/bissi-winners?${p}`);
    },
    staleTime: 30_000,
  });

  const gifts = safeArray<GiftRecord>(data?.winners);
  const total = data?.total || gifts.length;
  const totalPages = Math.ceil(total / PER_PAGE);

  const markDelivered = useMutation({
    mutationFn: (id: number) => api.patch(`/gifts/${id}/status`, { status: "distributed" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gifts-all-tab"] }); toast({ title: "Delivered!" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Group by month for display
  const byMonth: Record<string, GiftRecord[]> = {};
  gifts.forEach(g => {
    const m = g.drawDate
      ? new Date(g.drawDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
      : "Unknown";
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(g);
  });

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = gifts.map(g => `<tr>
      <td>${fmt(g.drawDate)}</td>
      <td>${(g.committee_name || "").replace(" Bissi", "")}</td>
      <td>${g.winnerName || "—"}</td>
      <td style="font-weight:bold;color:#4f46e5">#${g.tokenNumber || "—"}</td>
      <td style="font-weight:bold;color:#7c3aed">${g.giftName || "—"}</td>
      <td>${g.status === "distributed" ? "✓ Delivered" : "⏳ Pending"}</td>
    </tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Gift Records</title>
    <style>body{font-family:Arial;padding:24px;font-size:12px}table{width:100%;border-collapse:collapse}th{background:#f1f5f9;padding:8px;text-align:left}td{padding:6px 8px;border-bottom:1px solid #f1f5f9}button{margin-bottom:16px;padding:8px 16px;background:#6366f1;color:white;border:none;border-radius:6px;cursor:pointer}@media print{button{display:none}}</style>
    </head><body><h2>Gift Records Report</h2>
    <button onclick="window.print()">Print</button>
    <table><thead><tr><th>Date</th><th>Scheme</th><th>Member</th><th>Token</th><th>Gift</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search member name or gift..." className="pl-9"
            value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Button variant="outline" className="gap-2 text-purple-600 border-purple-300" onClick={handlePrint}>
          <Printer className="h-4 w-4" />Print
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">{total.toLocaleString("en-IN")} total records</div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading records...</div>
      ) : gifts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No records found. Change filter and try again.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byMonth).map(([month, items]) => (
            <div key={month}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                  isCurrentMonth(items[0]?.drawDate?.slice(0, 7) || "")
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : isFuture(items[0]?.drawDate?.slice(0, 7) || "")
                      ? "bg-blue-100 dark:bg-blue-900/30"
                      : "bg-slate-100 dark:bg-slate-800"
                }`}>
                  <Calendar className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-bold text-foreground">{month}</span>
                  {isCurrentMonth(items[0]?.drawDate?.slice(0, 7) || "") && (
                    <Badge className="bg-amber-500 text-white text-[10px] py-0">Current</Badge>
                  )}
                  {isFuture(items[0]?.drawDate?.slice(0, 7) || "") && (
                    <Badge className="bg-blue-500 text-white text-[10px] py-0">Upcoming</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] font-mono">{items.length}</Badge>
                </div>
                <div className="flex-1 h-px bg-border" />
              </div>
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>Gift / Item</TableHead>
                        <TableHead>Scheme</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(g => (
                        <TableRow key={g.id} className={g.status === "distributed" ? "opacity-60" : ""}>
                          <TableCell className="font-medium">{g.winnerName || "—"}</TableCell>
                          <TableCell className="font-mono font-bold text-indigo-600">#{g.tokenNumber || "—"}</TableCell>
                          <TableCell>
                            <span className={g.giftName?.toLowerCase().includes("lucky") ? "text-amber-600 font-bold" : "text-purple-700 font-semibold"}>
                              {g.giftName || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{(g.committee_name || "").replace(" Bissi", "")}</TableCell>
                          <TableCell>
                            {g.status === "distributed" ? (
                              <Badge className="bg-emerald-100 text-emerald-700 text-xs">✓ Delivered</Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">⏳ Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {g.status !== "distributed" && (
                              <Button size="sm" variant="ghost" className="text-xs text-emerald-600 h-7 px-2"
                                onClick={() => markDelivered.mutate(g.id)}>
                                Delivered ✓
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)} of {total.toLocaleString("en-IN")}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Pehle</Button>
                <span className="text-xs px-2 py-1.5 bg-muted rounded font-mono">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Agle →</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

