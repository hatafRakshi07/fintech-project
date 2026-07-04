import React, { useState } from "react";
import {
  useListLotteries,
  useCreateLottery,
  useUpdateLottery,
  useConductDraw,
  useListCommittees,
  getListLotteriesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Gift, Trophy, CalendarDays } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

  const { data: lotteries, isLoading } = useListLotteries({
    status: statusFilter !== "all" ? statusFilter : undefined,
    committeeId: committeeFilter !== "all" ? parseInt(committeeFilter, 10) : undefined,
  });
  const { data: committees } = useListCommittees();

  const createLottery = useCreateLottery();
  const conductDraw = useConductDraw();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      { id: drawConfirmId },
      {
        onSuccess: (result) => {
          toast({ title: `🎉 Winner: ${result.winnerName ?? "Selected!"}`, description: `Token: ${result.winnerToken ?? "—"}` });
          setDrawConfirmId(null);
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
            <AlertDialogTitle>Conduct Lucky Draw?</AlertDialogTitle>
            <AlertDialogDescription>
              This will randomly select a winner from all eligible committee members. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConductDraw} disabled={conductDraw.isPending}>
              {conductDraw.isPending ? "Drawing..." : "Conduct Draw"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <Card>
        <CardHeader className="p-4 border-b flex flex-row gap-4 flex-wrap">
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
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Committee</TableHead>
                <TableHead>Draw Date</TableHead>
                <TableHead>Winner</TableHead>
                <TableHead>Token</TableHead>
                <TableHead className="text-right">Prize</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading lotteries...</TableCell>
                </TableRow>
              ) : !lotteries?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Gift className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No lotteries found
                  </TableCell>
                </TableRow>
              ) : (
                lotteries.map((lottery) => (
                  <TableRow key={lottery.id} className="hover:bg-muted/50">
                    <TableCell className="pl-4 font-medium">{lottery.committeeName ?? `#${lottery.committeeId}`}</TableCell>
                    <TableCell>{new Date(lottery.drawDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                    <TableCell>
                      {lottery.winnerName ? (
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <Trophy className="h-4 w-4" /> {lottery.winnerName}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{lottery.winnerToken ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {lottery.prizeAmount ? formatCurrency(lottery.prizeAmount) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusBadge[lottery.status] ?? "secondary"}>{lottery.status}</Badge>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {lottery.status === "scheduled" && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => setDrawConfirmId(lottery.id)}
                        >
                          <Gift className="h-3 w-3 mr-1" /> Conduct Draw
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

