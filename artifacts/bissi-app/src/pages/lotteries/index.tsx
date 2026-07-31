import React, { useState } from "react";
import {
  useListLotteries,
  useCreateLottery,
  useUpdateLottery,
  useConductDraw,
  useListCommittees,
  getListLotteriesQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { safeArray } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Gift, Trophy, CalendarDays, Users, Banknote, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

const lotterySchema = z.object({
  committeeId: z.coerce.number().min(1, "Committee is required"),
  drawDate: z.string().min(1, "Draw date is required"),
  prizeAmount: z.coerce.number().optional(),
  notes: z.string().optional(),
});

const statusBadge: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "outline",
  completed: "default",
  cancelled: "destructive",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function LotteriesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [committeeFilter, setCommitteeFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [drawConfirmId, setDrawConfirmId] = useState<number | null>(null);
  const [drawRewardType, setDrawRewardType] = useState<"cash" | "gift">("cash");
  const [drawCashTaken, setDrawCashTaken] = useState("");
  const [membersLotteryId, setMembersLotteryId] = useState<number | null>(null);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string>("random");
  const [historyGroup, setHistoryGroup] = useState<{ commName: string; draws: any[] } | null>(null);

  const { data: rawLotteries, isLoading } = useListLotteries({
    status: statusFilter !== "all" ? statusFilter : undefined,
    committeeId: committeeFilter !== "all" ? parseInt(committeeFilter, 10) : undefined,
  });
  const { data: rawCommittees } = useListCommittees();

  const lotteries = safeArray<any>(rawLotteries);
  const committees = safeArray<any>(rawCommittees);

  const createLottery = useCreateLottery();
  const conductDraw = useConductDraw();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Members for selected lottery
  const { data: rawMembers = [] } = useQuery<any[]>({
    queryKey: ["lottery-members", membersLotteryId],
    queryFn: () => api.get(`/lotteries/${membersLotteryId}/members`),
    enabled: membersLotteryId !== null,
  });

  // Members for draw modal selection
  const { data: rawDrawMembers = [] } = useQuery<any[]>({
    queryKey: ["lottery-draw-members", drawConfirmId],
    queryFn: () => api.get(`/lotteries/${drawConfirmId}/members`),
    enabled: drawConfirmId !== null,
  });

  const members = safeArray<any>(rawMembers);
  const drawMembers = safeArray<any>(rawDrawMembers);

  const form = useForm<z.infer<typeof lotterySchema>>({
    resolver: zodResolver(lotterySchema),
    defaultValues: {
      committeeId: 0,
      drawDate: new Date().toISOString().split("T")[0],
      prizeAmount: undefined,
      notes: "",
    },
  });

  const onSubmit = (values: z.infer<typeof lotterySchema>) => {
    createLottery.mutate(
      { data: { committeeId: values.committeeId, drawDate: values.drawDate, prizeAmount: values.prizeAmount, notes: values.notes } },
      {
        onSuccess: () => {
          toast({ title: "Lottery scheduled successfully" });
          setIsCreateOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListLotteriesQueryKey() });
        },
        onError: () => toast({ title: "Failed to schedule lottery", variant: "destructive" }),
      }
    );
  };

  const handleConductDraw = () => {
    if (!drawConfirmId) return;
    conductDraw.mutate(
      {
        id: drawConfirmId,
        data: {
          rewardType: drawRewardType,
          cashTaken: drawRewardType === "cash" && drawCashTaken ? parseFloat(drawCashTaken) : undefined,
          winnerId: selectedWinnerId !== "random" ? parseInt(selectedWinnerId, 10) : undefined,
        },
      } as any,
      {
        onSuccess: (result: any) => {
          toast({ title: `🎉 Winner: ${result.winnerName ?? "Selected!"}`, description: `Token: ${result.winnerToken ?? "—"} | Reward: ${drawRewardType === "cash" ? `Cash ₹${drawCashTaken || result.prizeAmount}` : "Gift"}` });
          setDrawConfirmId(null);
          setSelectedWinnerId("random");
          queryClient.invalidateQueries({ queryKey: getListLotteriesQueryKey() });
        },
        onError: () => toast({ title: "Draw failed — ensure committee has members", variant: "destructive" }),
      }
    );
  };

  const scheduledCount = lotteries?.filter((l) => l.status === "scheduled").length ?? 0;
  const completedCount = lotteries?.filter((l) => l.status === "completed").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lotteries</h1>
          <p className="text-muted-foreground">Schedule and conduct committee lucky draws.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Schedule Draw</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule New Lottery Draw</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="committeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Committee</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select committee" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {committees?.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="drawDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Draw Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prizeAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prize Amount (₹) — optional</FormLabel>
                      <FormControl><Input type="number" placeholder="Leave blank to auto-calculate" {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl><Input placeholder="Any remarks…" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createLottery.isPending}>
                    {createLottery.isPending ? "Scheduling..." : "Schedule Draw"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Confirm Draw Alert */}
      <AlertDialog open={drawConfirmId !== null} onOpenChange={(o) => !o && setDrawConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conduct Lucky Draw</AlertDialogTitle>
            <AlertDialogDescription>
              Randomly select a winner. Choose what reward they receive:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm font-medium">Reward Type</Label>
              <div className="flex gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setDrawRewardType("cash")}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium flex items-center justify-center gap-1.5 transition-colors
                    ${drawRewardType === "cash" ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"}`}>
                  <Banknote className="h-4 w-4" /> Cash
                </button>
                <button
                  type="button"
                  onClick={() => setDrawRewardType("gift")}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium flex items-center justify-center gap-1.5 transition-colors
                    ${drawRewardType === "gift" ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"}`}>
                  <Gift className="h-4 w-4" /> Gift Item
                </button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Select Winner Mode (विजेता चुनें)</Label>
              <select
                value={selectedWinnerId}
                onChange={(e) => setSelectedWinnerId(e.target.value)}
                className="w-full h-10 border border-input bg-background rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring mt-1.5 font-bold text-foreground"
              >
                <option value="random">🎲 Random Draw (Automatic)</option>
                {drawMembers.map((m: any) => (
                  <option key={m.id} value={m.customerId}>
                    👤 {m.customerName || `Member #${m.customerId}`} (Token: {m.tokenNumber || "—"})
                  </option>
                ))}
              </select>
            </div>
            {drawRewardType === "cash" && (
              <div>
                <Label className="text-sm font-medium">Cash Amount (₹)</Label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={drawCashTaken}
                  onChange={(e) => setDrawCashTaken(e.target.value)}
                  placeholder="Enter cash amount"
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConductDraw} disabled={conductDraw.isPending}>
              {conductDraw.isPending ? "Drawing..." : "🎲 Conduct Draw"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Members Dialog */}
      <Dialog open={membersLotteryId !== null} onOpenChange={(o) => !o && setMembersLotteryId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Committee Members</DialogTitle></DialogHeader>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No members found in this committee.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Token #</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.customerName ?? `#${m.customerId}`}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.customerMobile ?? "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{m.tokenNumber ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="p-3 pb-1"><p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Scheduled</p></CardHeader>
          <CardContent className="p-3 pt-0"><div className="text-2xl font-bold">{scheduledCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1"><p className="text-xs text-muted-foreground flex items-center gap-1"><Trophy className="h-3 w-3" /> Completed</p></CardHeader>
          <CardContent className="p-3 pt-0"><div className="text-2xl font-bold">{completedCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1"><p className="text-xs text-muted-foreground flex items-center gap-1"><Gift className="h-3 w-3" /> Total</p></CardHeader>
          <CardContent className="p-3 pt-0"><div className="text-2xl font-bold">{lotteries?.length ?? 0}</div></CardContent>
        </Card>
      </div>

      {/* Draw History Modal with Search, Sort & Filter */}
      {historyGroup && (
        <DrawHistoryModal
          historyGroup={historyGroup}
          onClose={() => setHistoryGroup(null)}
        />
      )}

      {/* Filter bar */}
      <div className="flex flex-row gap-4 flex-wrap items-center bg-card p-3 rounded-lg border border-border">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Committee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Committees</SelectItem>
            {committees?.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading lotteries...</Card>
      ) : !lotteries?.length ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Gift className="h-10 w-10 mx-auto mb-2 opacity-30" />
          No lottery draws scheduled yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SINGLE CARD PER COMMITTEE */}
          {Object.entries(
            lotteries.reduce((groups: Record<string, any[]>, item: any) => {
              const name = item.committeeName || `Committee #${item.committeeId}`;
              if (!groups[name]) groups[name] = [];
              groups[name].push(item);
              return groups;
            }, {})
          ).map(([commName, commLotteries]: [string, any[]]) => {
            const scheduledDraw = commLotteries.find((l) => l.status === "scheduled");
            const latestCompleted = commLotteries.find((l) => l.status === "completed");
            const firstLotteryId = commLotteries[0]?.id;

            return (
              <Card key={commName} className="overflow-hidden border border-border shadow-sm flex flex-col justify-between">
                <CardHeader className="p-4 bg-slate-900 text-white border-b flex flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
                    <h2 className="text-base font-bold truncate">{commName}</h2>
                  </div>
                  <Badge variant="outline" className="text-xs bg-slate-800 text-amber-400 border-amber-500/30 shrink-0">
                    {commLotteries.length} Total Draws
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 space-y-3 flex-1">
                  {/* Status / Scheduled banner */}
                  {scheduledDraw ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" /> Next Scheduled Draw
                        </span>
                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          {new Date(scheduledDraw.drawDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs h-8 px-3"
                        onClick={() => { setDrawConfirmId(scheduledDraw.id); setDrawRewardType("cash"); setDrawCashTaken(""); }}
                      >
                        <Trophy className="h-3.5 w-3.5 mr-1" /> Conduct Draw
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted/40 border border-border rounded-lg text-xs text-muted-foreground flex items-center justify-between">
                      <span>No pending draw scheduled</span>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={() => setIsCreateOpen(true)}>
                        + Schedule Draw
                      </Button>
                    </div>
                  )}

                  {/* Latest Winner Card */}
                  {latestCompleted && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/20 rounded-lg space-y-1">
                      <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                        <span className="flex items-center gap-1"><Trophy className="h-3.5 w-3.5 text-amber-500" /> Latest Winner</span>
                        <span>{new Date(latestCompleted.drawDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                      </div>
                      <div className="flex items-baseline justify-between pt-0.5">
                        <span className="text-sm font-bold text-foreground">{latestCompleted.winnerName || "Winner Declared"}</span>
                        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">Token: {latestCompleted.winnerToken ?? "—"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center justify-between pt-0.5">
                        <span className="font-semibold text-purple-600 dark:text-purple-400">
                          {latestCompleted.rewardType === "cash"
                            ? `Cash: ${formatCurrency(latestCompleted.cashTaken || latestCompleted.prizeAmount || 0)}`
                            : `🎁 ${latestCompleted.notes?.includes("Winner Reward:") ? latestCompleted.notes.replace("Winner Reward:", "").trim() : latestCompleted.notes || "Gift Item"}`}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>

                {/* Footer Action Buttons */}
                <div className="p-3 bg-muted/20 border-t flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold w-full"
                    onClick={() => setHistoryGroup({ commName, draws: commLotteries })}
                  >
                    📜 View Draw History ({commLotteries.length})
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DrawHistoryModal({ historyGroup, onClose }: { historyGroup: { commName: string; draws: any[] }; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredDraws = historyGroup.draws
    .filter((d: any) => {
      const matchSearch =
        !search ||
        (d.winnerName && d.winnerName.toLowerCase().includes(search.toLowerCase())) ||
        (d.winnerToken && String(d.winnerToken).includes(search)) ||
        (d.notes && d.notes.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = statusFilter === "all" || d.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a: any, b: any) => {
      const timeA = new Date(a.drawDate).getTime();
      const timeB = new Date(b.drawDate).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });

  // Group duplicate winner entries for the same draw date
  const groupedMap: Record<string, any> = {};
  filteredDraws.forEach((d: any) => {
    const normName = (d.winnerName || "pending").toLowerCase().trim();
    const dateStr = d.drawDate ? new Date(d.drawDate).toISOString().split("T")[0] : "nodate";
    const key = `${normName}_${dateStr}`;

    if (!groupedMap[key]) {
      groupedMap[key] = {
        id: key,
        drawDate: d.drawDate,
        winnerName: d.winnerName,
        tokens: [],
        rewards: [],
        prizeAmount: 0,
        status: d.status,
        rewardType: d.rewardType,
        cashTaken: d.cashTaken,
      };
    }

    if (d.winnerToken && !groupedMap[key].tokens.includes(d.winnerToken)) {
      groupedMap[key].tokens.push(d.winnerToken);
    }
    const rw = d.notes?.includes("Winner Reward:") ? d.notes.replace("Winner Reward:", "").trim() : (d.giftName || d.notes || "");
    if (rw && !groupedMap[key].rewards.includes(rw)) {
      groupedMap[key].rewards.push(rw);
    }
    if (d.prizeAmount) {
      groupedMap[key].prizeAmount += Number(d.prizeAmount);
    }
  });

  const groupedDraws = Object.values(groupedMap);
  groupedDraws.forEach((g: any) => g.tokens.sort((a: number, b: number) => a - b));

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Trophy className="h-5 w-5 text-amber-500" />
              Draw History — {historyGroup.commName}
            </DialogTitle>
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
              {groupedDraws.length} Unique Winners ({historyGroup.draws.length} Draws)
            </Badge>
          </div>

          {/* Interactive Search, Sort & Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
            <Input
              placeholder="Search Winner Name, Token # or Gift..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-xs"
            />

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
              className="h-9 border border-input bg-background rounded-md px-2 text-xs font-semibold focus:outline-none"
            >
              <option value="desc">📅 Sort: Newest Date First</option>
              <option value="asc">📅 Sort: Oldest Date First</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 border border-input bg-background rounded-md px-2 text-xs font-semibold focus:outline-none"
            >
              <option value="all">🔍 Filter: All Statuses</option>
              <option value="completed">🏆 Completed Winner Draws</option>
              <option value="scheduled">⏳ Scheduled Draws</option>
            </select>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {groupedDraws.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No draw history records found matching your filters.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead>Date &amp; Time</TableHead>
                  <TableHead>Winner</TableHead>
                  <TableHead>Token Numbers (टोकन सं.)</TableHead>
                  <TableHead className="text-right">Prize Amount</TableHead>
                  <TableHead>Gift / Reward (क्या मिला)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedDraws.map((d: any) => (
                  <TableRow key={d.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-xs whitespace-nowrap">
                      {new Date(d.drawDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell>
                      {d.winnerName ? (
                        <span className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs">
                          <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          {d.winnerName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">Pending Draw</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-primary">
                      {d.tokens.length > 0 ? d.tokens.map((t: number) => `#${t}`).join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono font-bold text-emerald-600">
                      {d.prizeAmount ? formatCurrency(d.prizeAmount) : "—"}
                    </TableCell>
                    <TableCell className="text-xs font-bold">
                      {d.rewardType === "cash" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-300">
                          <Banknote className="h-3.5 w-3.5" />
                          {d.cashTaken ? formatCurrency(d.cashTaken) : "Cash ₹3,000"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-purple-600 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-300">
                          <Gift className="h-3.5 w-3.5 text-purple-600" />
                          {d.rewards.length > 0 ? d.rewards.join(", ") : "Gift Item"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusBadge[d.status] ?? "secondary"} className="text-[10px] uppercase">
                        {d.status}
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

