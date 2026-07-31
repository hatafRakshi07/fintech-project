import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Gift, Search, Trophy, Printer, Calendar, Users, Filter } from "lucide-react";

type Winner = {
  id: number;
  committeeId: number;
  committeeName: string;
  winnerId: number;
  winnerName: string;
  winnerMobile?: string;
  tokenNumber?: number;
  drawDate: string;
  giftName: string;
  rewardType: "gift" | "cash";
  status: string;
};

const COMMITTEES = [
  { id: "all", name: "Sabhi Bissi" },
  { id: "1", name: "Sawariya Seth Bissi" },
  { id: "2", name: "Pyare Mohan Bissi" },
  { id: "3", name: "Hare Ka Sahara Bissi" },
  { id: "4", name: "Shree Krishna Bissi" },
];

const formatDate = (d: string) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatGiftName = (name: string, rewardType: string) => {
  if (!name || name === "—") return rewardType === "gift" ? "Gift Item" : "Cash Reward";
  let cleaned = name.replace(/^Winner Reward:\s*/i, "").trim();
  if (!cleaned) return rewardType === "gift" ? "Gift Item" : "Cash Reward";
  
  if (/^\d+$/.test(cleaned)) {
    return `₹${Number(cleaned).toLocaleString("en-IN")}`;
  }
  if (/^\d+cash$/i.test(cleaned)) {
    const num = cleaned.replace(/cash/i, "");
    return `₹${Number(num).toLocaleString("en-IN")} Cash`;
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

type GroupedWinner = {
  id: string;
  winnerName: string;
  winnerMobile?: string;
  committeeId: number;
  committeeName: string;
  drawDate: string;
  tokens: number[];
  giftItems: string[];
  rewardType: "gift" | "cash";
  count: number;
};

const groupWinnersList = (items: Winner[]): GroupedWinner[] => {
  const map: Record<string, GroupedWinner> = {};
  items.forEach(w => {
    const normName = (w.winnerName || "").trim().toLowerCase();
    const dateStr = w.drawDate ? new Date(w.drawDate).toISOString().split("T")[0] : "nodate";
    const key = `${normName}_${dateStr}_${w.committeeId}`;

    if (!map[key]) {
      map[key] = {
        id: key,
        winnerName: w.winnerName,
        winnerMobile: w.winnerMobile,
        committeeId: w.committeeId,
        committeeName: w.committeeName,
        drawDate: w.drawDate,
        tokens: [],
        giftItems: [],
        rewardType: w.rewardType || "gift",
        count: 0,
      };
    }

    if (w.tokenNumber && !map[key].tokens.includes(w.tokenNumber)) {
      map[key].tokens.push(w.tokenNumber);
    }
    const itemFormatted = formatGiftName(w.giftName, w.rewardType);
    if (itemFormatted && !map[key].giftItems.includes(itemFormatted)) {
      map[key].giftItems.push(itemFormatted);
    }
    map[key].count += 1;
  });

  const res = Object.values(map);
  res.forEach(g => g.tokens.sort((a, b) => a - b));
  return res;
};

export default function GiftsPage() {
  const [search, setSearch] = useState("");
  const [committeeId, setCommitteeId] = useState("all");
  const [rewardType, setRewardType] = useState("all");
  const [page, setPage] = useState(0);
  const PER_PAGE = 100;

  const params = new URLSearchParams();
  if (committeeId !== "all") params.set("committeeId", committeeId);
  if (rewardType !== "all") params.set("rewardType", rewardType);
  if (search.trim()) params.set("search", search.trim());
  params.set("limit", String(PER_PAGE));
  params.set("offset", String(page * PER_PAGE));

  const { data, isLoading } = useQuery<{ success: boolean; winners: Winner[]; total: number }>({
    queryKey: ["gifts-bissi-winners", committeeId, rewardType, search, page],
    queryFn: () => customFetch(`/gifts/bissi-winners?${params.toString()}`),
    staleTime: 30000,
  });

  const rawWinners = data?.winners || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  // Group winners by same person + same draw date + committee
  const winners = groupWinnersList(rawWinners);

  // Group by month for display
  const grouped: Record<string, GroupedWinner[]> = {};
  winners.forEach(w => {
    const monthKey = w.drawDate
      ? new Date(w.drawDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
      : "Unknown Date";
    if (!grouped[monthKey]) grouped[monthKey] = [];
    grouped[monthKey].push(w);
  });

  // Stats
  const giftCount = winners.filter(w => w.rewardType === "gift").length;
  const cashCount = winners.filter(w => w.rewardType === "cash").length;

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = winners.map(winner => {
      const gItem = winner.giftItems.join(", ") || "Gift Item";
      const tokStr = winner.tokens.length > 0 ? winner.tokens.map(t => `#${t}`).join(", ") : "—";
      return `<tr>
        <td>${formatDate(winner.drawDate)}</td>
        <td>${winner.committeeName}</td>
        <td>${winner.winnerName}</td>
        <td style="font-weight:bold;color:#4f46e5">${tokStr}</td>
        <td style="font-weight:bold;color:${winner.rewardType === 'gift' ? '#7c3aed' : '#059669'}">${gItem}</td>
        <td>${winner.rewardType === "gift" ? "🎁 Gift" : "💵 Cash"}</td>
      </tr>`;
    }).join("");

    w.document.write(`<!DOCTYPE html>
<html><head><title>Gift Winners Report</title>
<style>
  body { font-family: Arial; padding: 24px; font-size: 12px; }
  h2 { color: #1e293b; margin-bottom: 4px; }
  p { color: #64748b; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
  tr:hover { background: #f8fafc; }
  button { margin-bottom: 16px; padding: 8px 16px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer; }
  @media print { button { display: none; } }
</style></head>
<body>
<h2>🎁 Gift & Cash Winners Report</h2>
<p>${committeeId === "all" ? "All Bissi Schemes" : COMMITTEES.find(c => c.id === committeeId)?.name} | Total Unique Winners: ${winners.length}</p>
<button onclick="window.print()">🖨️ Print</button>
<table>
  <thead><tr><th>Date</th><th>Bissi</th><th>Winner Name</th><th>Token Numbers (टोकन सं.)</th><th>Gift Item / Reward (क्या मिला)</th><th>Type</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Gift className="w-6 h-6 text-purple-500" />
            Gifts & Lottery Winners
          </h1>
          <p className="text-muted-foreground text-sm">
            Date-wise list of all gift and cash winners from all Bissi schemes
          </p>
        </div>
        <Button onClick={handlePrint} variant="outline" className="gap-2 text-purple-600 border-purple-500/30 hover:bg-purple-50">
          <Printer className="w-4 h-4" />
          Print Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-4">
            <div className="flex justify-between items-center text-xs font-bold text-purple-600 mb-1">
              <span>Total Winners</span>
              <Trophy className="w-4 h-4" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-purple-600">{total.toLocaleString("en-IN")}</div>
            <p className="text-[11px] text-muted-foreground mt-1">All records</p>
          </CardContent>
        </Card>
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardContent className="p-4">
            <div className="flex justify-between items-center text-xs font-bold text-violet-600 mb-1">
              <span>🎁 Gift Winners</span>
              <Gift className="w-4 h-4" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-violet-600">{giftCount.toLocaleString("en-IN")}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Current page</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex justify-between items-center text-xs font-bold text-emerald-600 mb-1">
              <span>💵 Cash Winners</span>
              <Users className="w-4 h-4" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-600">{cashCount.toLocaleString("en-IN")}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Current page</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-500/20 bg-indigo-500/5">
          <CardContent className="p-4">
            <div className="flex justify-between items-center text-xs font-bold text-indigo-600 mb-1">
              <span>Schemes</span>
              <Calendar className="w-4 h-4" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-indigo-600">4</div>
            <p className="text-[11px] text-muted-foreground mt-1">Bissi schemes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search winner name or gift..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={committeeId} onValueChange={v => { setCommitteeId(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-52">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select Bissi" />
              </SelectTrigger>
              <SelectContent>
                {COMMITTEES.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={rewardType} onValueChange={v => { setRewardType(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🎁💵 Sab</SelectItem>
                <SelectItem value="gift">🎁 Gift Only</SelectItem>
                <SelectItem value="cash">💵 Cash Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results - Grouped by Month */}
      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : winners.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Koi record nahi mila</p>
            <p className="text-sm mt-1">Filter change karke try karo</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, monthWinners]) => (
            <div key={month}>
              {/* Month Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                  <Calendar className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-bold text-foreground">{month}</span>
                  <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/20 font-mono">
                    {monthWinners.length} winners
                  </Badge>
                </div>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {monthWinners.map(w => {
                  const giftDetail = w.giftItems.length > 0 ? w.giftItems.join(", ") : "Gift Item";
                  const tokensList = w.tokens.length > 0 ? w.tokens.map(t => `#${t}`).join(", ") : "—";

                  return (
                    <div
                      key={w.id}
                      className={`p-4 rounded-xl border transition-shadow hover:shadow-md ${
                        w.rewardType === "gift"
                          ? "border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40"
                          : "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-xs font-bold text-foreground leading-tight block">
                            {w.winnerName}
                          </span>
                          {w.count > 1 && (
                            <span className="text-[10px] font-semibold text-purple-600 font-mono">
                              ({w.count} Wins)
                            </span>
                          )}
                        </div>
                        <Badge
                          className={`text-[10px] shrink-0 ${
                            w.rewardType === "gift"
                              ? "bg-purple-500/20 text-purple-600 border-purple-500/30"
                              : "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
                          }`}
                          variant="outline"
                        >
                          {w.rewardType === "gift" ? "🎁 Gift" : "💵 Cash"}
                        </Badge>
                      </div>

                      {/* Gift Item / Reward Details */}
                      <div className="my-2.5 p-2 rounded-lg bg-background/80 border border-border/50">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          Gift Item / Reward (क्या मिला):
                        </span>
                        <span className={`text-sm font-extrabold block mt-0.5 ${w.rewardType === "gift" ? "text-purple-600" : "text-emerald-600"}`}>
                          {giftDetail}
                        </span>
                      </div>

                      <div className="space-y-1 text-[11px] text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Bissi:</span>
                          <span className="font-semibold text-foreground">{w.committeeName.replace(" Bissi", "")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Token(s):</span>
                          <span className="font-mono font-bold text-indigo-600">{tokensList}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Date:</span>
                          <span className="font-semibold">{formatDate(w.drawDate)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)} of {total.toLocaleString("en-IN")}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  ← Pehle
                </Button>
                <span className="text-xs px-2 py-1.5 bg-muted rounded font-mono">
                  {page + 1} / {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  Agle →
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
