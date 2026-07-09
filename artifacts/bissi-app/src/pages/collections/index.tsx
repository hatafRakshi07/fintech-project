import React, { useState } from "react";
import {
  useListCollections,
  useCreateCollection,
  useGetTodayCollectionSummary,
  useGetDueToday,
  useListCustomers,
  useListCollectors,
  useListCommittees,
  getListCollectionsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient as useQC } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Wallet, Banknote, Smartphone, Building2, CreditCard, AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";

const collectionSchema = z.object({
  customerId: z.coerce.number().min(1, "Customer is required"),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  paymentMode: z.enum(["cash", "upi", "bank", "card"]),
  collectorId: z.coerce.number().optional(),
  committeeId: z.coerce.number().optional(),
  notes: z.string().optional(),
});

const paymentModeIcon: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-4 w-4" />,
  upi: <Smartphone className="h-4 w-4" />,
  bank: <Building2 className="h-4 w-4" />,
  card: <CreditCard className="h-4 w-4" />,
};

const verificationBadge = (status: string) => {
  if (status === "verified") return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" />Verified</Badge>;
  if (status === "rejected") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
  return <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300"><Clock className="h-3 w-3" />Pending</Badge>;
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function CollectionsPage() {
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [verifyDialogId, setVerifyDialogId] = useState<number | null>(null);
  const [verifyNotes, setVerifyNotes] = useState("");
  const { role } = useRole();
  const isManager = ["super_admin", "owner", "branch_manager"].includes(role ?? "");

  const { data: collections, isLoading } = useListCollections({ page, limit: 20, date: dateFilter || undefined });
  const { data: summary } = useGetTodayCollectionSummary();
  const { data: dueList } = useGetDueToday();
  const { data: customers } = useListCustomers({ limit: 200 });
  const { data: collectors } = useListCollectors();
  const { data: committees } = useListCommittees();

  // Pending verifications (managers only)
  const { data: pendingCollections, isLoading: pendingLoading } = useQuery<any[]>({
    queryKey: ["collections-pending"],
    queryFn: () => api.get("/collections?verificationStatus=pending&limit=50"),
    enabled: isManager,
    select: (d: any) => (Array.isArray(d) ? d : d.data ?? []),
    refetchInterval: 30_000,
  });

  const { data: pendingCount } = useQuery<{ count: number }>({
    queryKey: ["collections-pending-count"],
    queryFn: () => api.get("/collections/pending-verifications"),
    enabled: isManager,
    refetchInterval: 30_000,
  });

  const createCollection = useCreateCollection();
  const queryClient = useQC();
  const { toast } = useToast();

  const verifyMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: "verified" | "rejected"; notes?: string }) =>
      api.patch(`/collections/${id}/verify`, { verificationStatus: status, verificationNotes: notes }),
    onSuccess: (_, vars) => {
      toast({ title: vars.status === "verified" ? "Collection verified ✓" : "Collection rejected" });
      queryClient.invalidateQueries({ queryKey: ["collections-pending"] });
      queryClient.invalidateQueries({ queryKey: ["collections-pending-count"] });
      queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
      setVerifyDialogId(null);
      setVerifyNotes("");
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const form = useForm<z.infer<typeof collectionSchema>>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      customerId: 0,
      amount: 500,
      paymentMode: "cash",
      collectorId: undefined,
      committeeId: undefined,
      notes: "",
    },
  });

  const onSubmit = (values: z.infer<typeof collectionSchema>) => {
    const payload = {
      customerId: values.customerId,
      amount: values.amount,
      paymentMode: values.paymentMode as "cash" | "upi" | "bank" | "card",
      collectorId: values.collectorId || undefined,
      committeeId: values.committeeId || undefined,
      notes: values.notes || undefined,
    };
    createCollection.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({ title: "Payment recorded successfully" });
          setIsCreateOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
        },
        onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
      }
    );
  };

  const recordQuickCollection = (customerId: number, amount: number, committeeId: number) => {
    createCollection.mutate(
      { data: { customerId, amount, paymentMode: "cash", committeeId } },
      {
        onSuccess: () => {
          toast({ title: "Payment recorded" });
          queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
          <p className="text-muted-foreground">Daily collection ledger and due list.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Record Payment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers?.data?.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.referenceNumber})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (₹)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Mode</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="upi">UPI</SelectItem>
                            <SelectItem value="bank">Bank Transfer</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="committeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Committee (optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Link to committee" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">None</SelectItem>
                          {committees?.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="collectorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collector (optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Assign collector" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">None</SelectItem>
                          {collectors?.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                  <Button type="submit" disabled={createCollection.isPending}>
                    {createCollection.isPending ? "Saving..." : "Record Payment"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Today Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Today", value: summary?.totalAmount ?? 0, icon: Wallet },
          { label: "Cash", value: summary?.cashAmount ?? 0, icon: Banknote },
          { label: "UPI", value: summary?.upiAmount ?? 0, icon: Smartphone },
          { label: "Bank", value: summary?.bankAmount ?? 0, icon: Building2 },
          { label: "Card", value: summary?.cardAmount ?? 0, icon: CreditCard },
          { label: "Transactions", value: summary?.totalCount ?? 0, icon: Plus, currency: false },
        ].map(({ label, value, icon: Icon, currency = true }) => (
          <Card key={label}>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Icon className="h-3 w-3" /> {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold">{currency ? formatCurrency(value as number) : value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Due Today */}
      {dueList && dueList.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-4 w-4" /> Due Today ({dueList.length} customers)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Customer</TableHead>
                  <TableHead>Committee</TableHead>
                  <TableHead className="text-right">Due Amount</TableHead>
                  <TableHead className="pr-4 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dueList.map((item) => (
                  <TableRow key={item.customerId}>
                    <TableCell className="pl-4 font-medium">
                      <div>{item.customerName}</div>
                      <div className="text-xs text-muted-foreground">{item.mobile}</div>
                    </TableCell>
                    <TableCell className="text-sm">{item.committeeName}</TableCell>
                    <TableCell className="text-right font-semibold text-orange-700">{formatCurrency(item.dueAmount)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => recordQuickCollection(item.customerId, item.dueAmount, item.committeeId)}
                        disabled={createCollection.isPending}
                      >
                        Mark Paid
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Collections Ledger */}
      <Card>
        <CardHeader className="p-4 border-b flex flex-row gap-4">
          <Input
            type="date"
            className="w-[180px]"
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
            placeholder="Filter by date"
          />
          {dateFilter && (
            <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>Clear</Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Customer</TableHead>
                <TableHead>Collector</TableHead>
                <TableHead>Committee</TableHead>
                <TableHead className="text-center">Mode</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading collections...</TableCell>
                </TableRow>
              ) : !collections?.data?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No collections found</TableCell>
                </TableRow>
              ) : (
                collections.data.map((col) => (
                  <TableRow key={col.id} className="hover:bg-muted/50">
                    <TableCell className="pl-4">
                      <div className="font-medium">{col.customerName ?? `#${col.customerId}`}</div>
                      {col.customerMobile && <div className="text-xs text-muted-foreground">{col.customerMobile}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{col.collectorName ?? "—"}</TableCell>
                    <TableCell className="text-sm">{col.committeeName ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="gap-1">
                        {paymentModeIcon[col.paymentMode]}
                        {col.paymentMode.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">{formatCurrency(col.amount)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{col.receiptNumber ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(col.collectedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="pr-4">{verificationBadge((col as any).verificationStatus ?? "pending")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {collections && collections.total > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, collections.total)} of {collections.total}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page * 20 >= collections.total} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Manager: Pending Verification ── */}
      {isManager && (
        <Card className="border-amber-200">
          <CardHeader className="p-4 border-b bg-amber-50/50 dark:bg-amber-900/10">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <Clock className="h-4 w-4" />
              Pending Verification
              {(pendingCount?.count ?? 0) > 0 && (
                <Badge variant="outline" className="ml-1 text-amber-600 border-amber-300">{pendingCount?.count}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Customer</TableHead>
                  <TableHead>Collector</TableHead>
                  <TableHead className="text-center">Mode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !pendingCollections?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400 opacity-60" />
                      All collections verified!
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingCollections.map((col: any) => (
                    <TableRow key={col.id} className="hover:bg-muted/50">
                      <TableCell className="pl-4">
                        <div className="font-medium">{col.customerName ?? `#${col.customerId}`}</div>
                        {col.customerMobile && <div className="text-xs text-muted-foreground">{col.customerMobile}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{col.collectorName ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1">
                          {paymentModeIcon[col.paymentMode]}
                          {col.paymentMode?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">{formatCurrency(col.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {col.collectedAt ? new Date(col.collectedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white h-7 px-3 gap-1"
                            onClick={() => verifyMutation.mutate({ id: col.id, status: "verified" })}
                            disabled={verifyMutation.isPending}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-3 gap-1"
                            onClick={() => { setVerifyDialogId(col.id); setVerifyNotes(""); }}
                            disabled={verifyMutation.isPending}>
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reject with notes dialog */}
      <Dialog open={verifyDialogId !== null} onOpenChange={(o) => { if (!o) setVerifyDialogId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Collection</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Optionally provide a reason for rejection:</p>
            <Textarea
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setVerifyDialogId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => verifyDialogId && verifyMutation.mutate({ id: verifyDialogId, status: "rejected", notes: verifyNotes })}
                disabled={verifyMutation.isPending}>
                Confirm Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}