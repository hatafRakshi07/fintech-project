import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Gift, Search, Trophy, Printer, Calendar, Users, Filter, Download, Table as TableIcon, List } from "lucide-react";

type Winner = {
  id: number;
  committeeId: number;
  committeeName: string;
  winnerId: number;
  winnerName: string;
  winnerMobile?: string;
  tokenNumber?: string;
  drawDate: string;
  giftName: string;
  rewardType: "gift" | "cash";
  status: string;
};

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const COMMITTEES = [
  { id: "all", name: "Sabhi Bissi" },
  { id: "1", name: "Sawariya Seth Bissi (5th Date)" },
  { id: "2", name: "Pyare Mohan Bissi (15th Date)" },
  { id: "3", name: "Hare Ka Sahara Bissi (20th Date)" },
  { id: "4", name: "Shree Krishna Associate Bissi (10th Date)" },
];

function RecordGiftModal({
  isOpen,
  onOpenChange,
  defaultCommitteeId = "1",
  defaultTokenId,
  defaultMonth,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCommitteeId?: string;
  defaultTokenId?: string;
  defaultMonth?: string;
}) {
  const [commId, setCommId] = useState(defaultCommitteeId === "all" ? "1" : defaultCommitteeId);
  const [tokenId, setTokenId] = useState(defaultTokenId || "");
  const [month, setMonth] = useState(defaultMonth || "Jun-24");
  const [claimMode, setClaimMode] = useState<"GIFT" | "CASH">("GIFT");
  const [giftItem, setGiftItem] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch tokens for selected committee
  const { data: matrixData } = useQuery<any>({
    queryKey: ["committee-gift-matrix-modal", commId],
    queryFn: () => customFetch(`/committees/${commId}/gift-matrix`),
    enabled: isOpen && !!commId,
  });

  const members: any[] = matrixData?.members || [];
  const availableMonths: string[] = matrixData?.months || [
    "Jun-24", "Jul-24", "Aug-24", "Sep-24", "Oct-24", "Nov-24", "Dec-24", "Jan-25",
    "Feb-25", "Mar-25", "Apr-25", "May-25", "Jun-25", "Jul-25", "Aug-25", "Sep-25",
    "Oct-25", "Nov-25", "Dec-25", "Jan-26", "Feb-26", "Mar-26", "Apr-26", "May-26",
    "Jun-26", "Jul-26", "Aug-26"
  ];

  React.useEffect(() => {
    if (defaultCommitteeId && defaultCommitteeId !== "all") setCommId(defaultCommitteeId);
    if (defaultTokenId) setTokenId(defaultTokenId);
    if (defaultMonth) setMonth(defaultMonth);
  }, [defaultCommitteeId, defaultTokenId, defaultMonth, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commId || !tokenId || !month || !giftItem.trim()) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedMember = members.find(m => String(m.tokenId) === String(tokenId));
      const res = await customFetch("/gifts/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          committeeId: parseInt(commId, 10),
          tokenId: parseInt(tokenId, 10),
          customerId: selectedMember?.customerId ? parseInt(selectedMember.customerId, 10) : undefined,
          month,
          claimMode,
          giftItem: giftItem.trim(),
        }),
      });

      if (res && res.success) {
        toast({ title: "Gift record saved successfully (उपहार दर्ज हो गया) ✓" });
        queryClient.invalidateQueries({ queryKey: ["committee-gift-matrix"] });
        queryClient.invalidateQueries({ queryKey: ["gifts-bissi-winners"] });
        setGiftItem("");
        onOpenChange(false);
      } else {
        toast({ title: res?.error || "Failed to record gift", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: err.message || "Failed to record gift", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-700">
            <Gift className="w-5 h-5 text-purple-500" />
            Record New Gift / Cash (उपहार / नकद दर्ज करें)
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Select Committee */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Select Bissi Committee (समिति)</Label>
            <Select value={commId} onValueChange={setCommId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select Bissi" />
              </SelectTrigger>
              <SelectContent>
                {COMMITTEES.filter(c => c.id !== "all").map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Select Token / Member */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Select Token / Member (सदस्य / टोकन सं.)</Label>
            <Select value={tokenId} onValueChange={setTokenId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={members.length === 0 ? "Loading members..." : "Select Member Token"} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {members.map(m => (
                  <SelectItem key={m.tokenId} value={String(m.tokenId)}>
                    #{m.tokenNumber} — {m.customerName} ({m.customerMobile || "No Mobile"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Select Month */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Select Draw Month (महीना)</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {availableMonths.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reward Type */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Reward Type (प्रकार)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={claimMode === "GIFT" ? "default" : "outline"}
                className={`h-9 text-xs justify-center ${claimMode === "GIFT" ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                onClick={() => setClaimMode("GIFT")}
              >
                🎁 Physical Gift (उपहार)
              </Button>
              <Button
                type="button"
                variant={claimMode === "CASH" ? "default" : "outline"}
                className={`h-9 text-xs justify-center ${claimMode === "CASH" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                onClick={() => setClaimMode("CASH")}
              >
                💵 Cash Claim (नकद)
              </Button>
            </div>
          </div>

          {/* Gift Item Input */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Gift Item Name / Cash Amount (उपहार / राशि का नाम)</Label>
            <Input
              placeholder={claimMode === "GIFT" ? "e.g. Gas Stove, Juicer Mixer, Trolley Bag" : "e.g. 5000 Cash, 1000 Cash for nose pin"}
              value={giftItem}
              onChange={e => setGiftItem(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white">
              {isSubmitting ? "Saving..." : "Save Record (दर्ज करें)"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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

// ---------------------------------------------------------------------------
// Gift Matrix Component (Token-Wise Gift Sheet)
// ---------------------------------------------------------------------------
function GiftMatrixView({ selectedCommitteeId }: { selectedCommitteeId: string }) {
  const commId = selectedCommitteeId === "all" ? "1" : selectedCommitteeId;
  const [matrixSearch, setMatrixSearch] = useState("");
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [modalTokenId, setModalTokenId] = useState<string | undefined>(undefined);
  const [modalMonth, setModalMonth] = useState<string | undefined>(undefined);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["committee-gift-matrix", commId, matrixSearch],
    queryFn: () => customFetch(`/committees/${commId}/gift-matrix${matrixSearch ? `?search=${encodeURIComponent(matrixSearch)}` : ""}`),
    staleTime: 30000,
  });

  const handleOpenModal = (tokenId?: string, month?: string) => {
    setModalTokenId(tokenId);
    setModalMonth(month);
    setIsRecordModalOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Loading Gift Sheet Matrix…</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.success) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          Gift matrix record fail to load.
        </CardContent>
      </Card>
    );
  }

  const months: string[] = data.months || [];
  const members: any[] = data.members || [];

  const handleExportCSV = () => {
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
    link.setAttribute("download", `${data.committee?.name || "Gift_Sheet"}_Matrix.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <RecordGiftModal
        isOpen={isRecordModalOpen}
        onOpenChange={setIsRecordModalOpen}
        defaultCommitteeId={commId}
        defaultTokenId={modalTokenId}
        defaultMonth={modalMonth}
      />

      {/* Top bar for Matrix */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search token, name..."
            value={matrixSearch}
            onChange={e => setMatrixSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => handleOpenModal()} size="sm" className="gap-1.5 text-xs h-9 bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
            <Plus className="w-4 h-4" />
            Add Gift Record (उपहार दर्ज करें)
          </Button>
          <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-2 text-xs h-9 text-purple-600 border-purple-200">
            <Download className="w-3.5 h-3.5" />
            Export Gift Sheet CSV
          </Button>
        </div>
      </div>

      {/* Excel Sheet Matrix Table */}
      <Card className="border shadow-sm">
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-max">
            <Table>
              <TableHeader>
                <TableRow className="bg-purple-500/10 hover:bg-purple-500/10">
                  <TableHead className="pl-4 sticky left-0 bg-purple-50/90 dark:bg-slate-900/90 z-20 font-bold text-[11px] text-purple-900 dark:text-purple-300">
                    Token #
                  </TableHead>
                  <TableHead className="sticky left-[70px] bg-purple-50/90 dark:bg-slate-900/90 z-20 min-w-[180px] font-bold text-[11px] text-purple-900 dark:text-purple-300">
                    Customer Name
                  </TableHead>
                  <TableHead className="min-w-[110px] font-bold text-[11px] text-purple-900 dark:text-purple-300">
                    Mobile
                  </TableHead>
                  {months.map(m => (
                    <TableHead key={m} className="text-center min-w-[110px] font-bold text-[11px] text-purple-900 dark:text-purple-300 px-2">
                      {m}
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[70px] font-bold text-[11px] bg-purple-500/20 text-purple-900 dark:text-purple-300 pr-4">
                    Gifts Won
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={months.length + 4} className="text-center py-12 text-muted-foreground">
                      No gift records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((m: any) => (
                    <TableRow key={m.tokenId} className="hover:bg-purple-500/5 transition-colors text-xs">
                      <TableCell className="pl-4 sticky left-0 bg-card z-10 font-mono font-bold text-purple-600">
                        #{m.tokenNumber}
                      </TableCell>
                      <TableCell className="sticky left-[70px] bg-card z-10 font-semibold text-foreground truncate max-w-[180px]">
                        {m.customerName}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground text-[11px]">
                        {m.customerMobile || "—"}
                      </TableCell>
                      {m.monthlyGifts.map((mg: any, idx: number) => (
                        <TableCell
                          key={idx}
                          className="text-center px-1 py-1.5 cursor-pointer hover:bg-purple-500/10 transition-colors"
                          onClick={() => handleOpenModal(m.tokenId, mg.month)}
                          title={`Click to add/edit gift for #${m.tokenNumber} in ${mg.month}`}
                        >
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
                            <span className="text-muted-foreground/20 text-[11px] hover:text-purple-600 transition-colors">+</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold text-purple-600 bg-purple-500/5 pr-4">
                        {m.giftCount > 0 ? (
                          <Badge variant="secondary" className="bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold">
                            {m.giftCount}
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

export default function GiftsPage() {
  const [search, setSearch] = useState("");
  const [committeeId, setCommitteeId] = useState("all");
  const [rewardType, setRewardType] = useState("all");
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState("list");
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

  const winners = data?.winners || [];
  const total = data?.total || 0;

  // Group by month for display
  const grouped: Record<string, Winner[]> = {};
  winners.forEach(w => {
    const monthKey = w.drawDate
      ? new Date(w.drawDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
      : "Gift / Reward Records";
    if (!grouped[monthKey]) grouped[monthKey] = [];
    grouped[monthKey].push(w);
  });

  const giftCount = winners.filter(w => w.rewardType === "gift").length;
  const cashCount = winners.filter(w => w.rewardType === "cash").length;

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = winners.map(winner => {
      const gItem = formatGiftName(winner.giftName, winner.rewardType);
      const tokStr = winner.tokenNumber ? `#${winner.tokenNumber}` : "—";
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
<p>${committeeId === "all" ? "All Bissi Schemes" : COMMITTEES.find(c => c.id === committeeId)?.name} | Total Winners: ${winners.length}</p>
<button onclick="window.print()">🖨️ Print</button>
<table>
  <thead><tr><th>Date</th><th>Bissi</th><th>Winner Name</th><th>Winning Token (टोकन सं.)</th><th>Gift Item / Reward (क्या मिला)</th><th>Type</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`);
    w.document.close();
  };

  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <RecordGiftModal
        isOpen={isHeaderModalOpen}
        onOpenChange={setIsHeaderModalOpen}
        defaultCommitteeId={committeeId}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Gift className="w-6 h-6 text-purple-500" />
            Gifts & Reward Sheets (उपहार रिकॉर्ड)
          </h1>
          <p className="text-muted-foreground text-sm">
            Complete records of all physical gifts and cash claimed across all 4 Bissi schemes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsHeaderModalOpen(true)} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
            <Plus className="w-4 h-4" />
            Record New Gift (नया उपहार दर्ज करें)
          </Button>
          <Button onClick={handlePrint} variant="outline" className="gap-2 text-purple-600 border-purple-500/30 hover:bg-purple-50">
            <Printer className="w-4 h-4" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-4">
            <div className="flex justify-between items-center text-xs font-bold text-purple-600 mb-1">
              <span>Total Gift Records</span>
              <Trophy className="w-4 h-4" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-purple-600">{total.toLocaleString("en-IN")}</div>
            <p className="text-[11px] text-muted-foreground mt-1">All schemes combined</p>
          </CardContent>
        </Card>
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardContent className="p-4">
            <div className="flex justify-between items-center text-xs font-bold text-violet-600 mb-1">
              <span>🎁 Gift Items</span>
              <Gift className="w-4 h-4" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-violet-600">{giftCount.toLocaleString("en-IN")}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Physical gifts</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex justify-between items-center text-xs font-bold text-emerald-600 mb-1">
              <span>💵 Cash Claims</span>
              <Users className="w-4 h-4" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-600">{cashCount.toLocaleString("en-IN")}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Cash in lieu of gift</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-500/20 bg-indigo-500/5">
          <CardContent className="p-4">
            <div className="flex justify-between items-center text-xs font-bold text-indigo-600 mb-1">
              <span>Bissi Schemes</span>
              <Calendar className="w-4 h-4" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-indigo-600">4</div>
            <p className="text-[11px] text-muted-foreground mt-1">Active schemes</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs View Switcher */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="list" className="px-4 font-semibold gap-2">
              <List className="w-4 h-4" /> Date-Wise Winners List
            </TabsTrigger>
            <TabsTrigger value="matrix" className="px-4 font-semibold gap-2">
              <TableIcon className="w-4 h-4 text-purple-600" /> Token Gift Sheet Matrix (Excel View)
            </TabsTrigger>
          </TabsList>

          <Select value={committeeId} onValueChange={v => { setCommitteeId(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-64">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select Bissi" />
            </SelectTrigger>
            <SelectContent>
              {COMMITTEES.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* LIST VIEW TAB */}
        <TabsContent value="list" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search winner name or gift item..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0); }}
                    className="pl-9"
                  />
                </div>
                <Select value={rewardType} onValueChange={v => { setRewardType(v); setPage(0); }}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🎁💵 All Rewards</SelectItem>
                    <SelectItem value="gift">🎁 Gift Items Only</SelectItem>
                    <SelectItem value="cash">💵 Cash Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : winners.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No gift records found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([month, monthWinners]) => (
                <Card key={month} className="border shadow-sm overflow-hidden">
                  <CardHeader className="bg-purple-500/5 p-4 border-b">
                    <CardTitle className="text-sm font-bold text-purple-900 dark:text-purple-300 flex items-center justify-between">
                      <span>{month}</span>
                      <Badge variant="outline" className="bg-card text-purple-600 border-purple-300">
                        {monthWinners.length} Records
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="pl-4 w-24">Token #</TableHead>
                          <TableHead>Winner Customer Name</TableHead>
                          <TableHead>Bissi Scheme</TableHead>
                          <TableHead>Gift / Cash Claim (क्या मिला)</TableHead>
                          <TableHead className="pr-4 text-right">Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthWinners.map(w => (
                          <TableRow key={w.id} className="hover:bg-muted/40">
                            <TableCell className="pl-4 font-mono font-bold text-purple-600">
                              #{w.tokenNumber || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-foreground">{w.winnerName}</div>
                              {w.winnerMobile && <div className="text-[11px] text-muted-foreground font-mono">{w.winnerMobile}</div>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{w.committeeName}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                                w.rewardType === "cash"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                              }`}>
                                {w.rewardType === "cash" ? "💵 " : "🎁 "}
                                {formatGiftName(w.giftName, w.rewardType)}
                              </span>
                            </TableCell>
                            <TableCell className="pr-4 text-right">
                              <Badge variant="outline" className="capitalize text-[10px]">
                                {w.rewardType}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* MATRIX VIEW TAB */}
        <TabsContent value="matrix" className="mt-4">
          <GiftMatrixView selectedCommitteeId={committeeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
