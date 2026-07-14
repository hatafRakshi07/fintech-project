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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Wallet, Banknote, Smartphone, Building2, CreditCard, AlertCircle, CheckCircle2, XCircle, Clock, Printer } from "lucide-react";
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
  billingName: z.string().optional(),
  billingPhone: z.string().optional(),
  billingAddress: z.string().optional(),
  billingGstin: z.string().optional(),
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
  const [selectedBillCollection, setSelectedBillCollection] = useState<any | null>(null);
  const [showBillingDetails, setShowBillingDetails] = useState(false);
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
      billingName: "",
      billingPhone: "",
      billingAddress: "",
      billingGstin: "",
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
      billingName: values.billingName || undefined,
      billingPhone: values.billingPhone || undefined,
      billingAddress: values.billingAddress || undefined,
      billingGstin: values.billingGstin || undefined,
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id="add-billing-details"
                    checked={showBillingDetails}
                    onCheckedChange={(checked) => setShowBillingDetails(!!checked)}
                  />
                  <label
                    htmlFor="add-billing-details"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Add Billing Recipient Details
                  </label>
                </div>

                {showBillingDetails && (
                  <div className="space-y-3 p-3 bg-muted/40 rounded-lg border">
                    <div className="flex justify-between items-center pb-1 border-b">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recipient Details</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => {
                          const customerId = form.getValues("customerId");
                          const cust = customers?.data?.find(c => c.id === Number(customerId));
                          if (cust) {
                            form.setValue("billingName", cust.name);
                            form.setValue("billingPhone", cust.mobile);
                            form.setValue("billingAddress", cust.address || "");
                          } else {
                            toast({ title: "Please select a customer first", variant: "destructive" });
                          }
                        }}
                      >
                        Copy Customer Info
                      </Button>
                    </div>
                    <FormField
                      control={form.control}
                      name="billingName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Recipient Name</FormLabel>
                          <FormControl><Input placeholder="Recipient Full Name" className="h-8 text-sm" {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={form.control}
                        name="billingPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Phone Number</FormLabel>
                            <FormControl><Input placeholder="10-digit mobile" className="h-8 text-sm" {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="billingGstin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">GSTIN (Optional)</FormLabel>
                            <FormControl><Input placeholder="22AAAAA0000A1Z5" className="h-8 text-sm uppercase" {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="billingAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Address</FormLabel>
                          <FormControl><Input placeholder="Recipient Address" className="h-8 text-sm" {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

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
          <CardContent className="p-0 overflow-x-auto">
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
        <CardContent className="p-0 overflow-x-auto">
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
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Bill</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading collections...</TableCell>
                </TableRow>
              ) : !collections?.data?.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No collections found</TableCell>
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
                    <TableCell>{verificationBadge((col as any).verificationStatus ?? "pending")}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setSelectedBillCollection(col)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </TableCell>
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
          <CardContent className="p-0 overflow-x-auto">
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

      {/* ── Printable Invoice/Bill Dialog ── */}
      <Dialog open={selectedBillCollection !== null} onOpenChange={(o) => { if (!o) setSelectedBillCollection(null); }}>
        <DialogContent className="max-w-xl p-6 bg-white text-black dark:bg-zinc-950 dark:text-zinc-50 border">
          <DialogHeader className="print:hidden">
            <DialogTitle>Receipt / Bill Preview</DialogTitle>
          </DialogHeader>
          {selectedBillCollection && (
            <div className="space-y-6">
              {/* Receipt Template */}
              <div id="printable-receipt" className="p-4 bg-white text-black rounded border border-zinc-200 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-zinc-900">RECEIPT / INVOICE</h2>
                    <p className="text-xs text-zinc-500">Bissi Fund Management System</p>
                    <p className="text-xs text-zinc-500 mt-1">Receipt No: <span className="font-mono font-semibold">{selectedBillCollection.receiptNumber || `RCP${selectedBillCollection.id}`}</span></p>
                    <p className="text-xs text-zinc-500">Date: {new Date(selectedBillCollection.collectedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
                  </div>
                  <div className="text-right">
                    <h3 className="font-bold text-zinc-800">OFFICE RECEIPT</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-200 font-semibold uppercase">{selectedBillCollection.verificationStatus}</span>
                  </div>
                </div>

                {/* Recipient details */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <h4 className="font-semibold text-zinc-500 uppercase tracking-wider mb-1">Billing Recipient</h4>
                    <p className="font-semibold text-zinc-900">{selectedBillCollection.billingName || selectedBillCollection.customerName}</p>
                    <p className="text-zinc-600">{selectedBillCollection.billingPhone || selectedBillCollection.customerMobile || "—"}</p>
                    {selectedBillCollection.billingAddress && <p className="text-zinc-600">{selectedBillCollection.billingAddress}</p>}
                    {selectedBillCollection.billingGstin && <p className="text-zinc-600 font-semibold mt-1">GSTIN: <span className="font-mono">{selectedBillCollection.billingGstin.toUpperCase()}</span></p>}
                  </div>
                  <div className="text-right">
                    <h4 className="font-semibold text-zinc-500 uppercase tracking-wider mb-1">Customer Info</h4>
                    <p className="font-semibold text-zinc-900">{selectedBillCollection.customerName}</p>
                    <p className="text-zinc-600">{selectedBillCollection.customerMobile || "—"}</p>
                  </div>
                </div>

                {/* Transaction details table */}
                <Table className="border rounded mt-4">
                  <TableHeader className="bg-zinc-50">
                    <TableRow>
                      <TableHead className="text-xs font-semibold py-2">Description</TableHead>
                      <TableHead className="text-xs font-semibold text-center py-2">Payment Mode</TableHead>
                      <TableHead className="text-xs font-semibold text-right py-2 pr-4">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="py-3">
                        <div className="font-medium text-zinc-900">
                          {selectedBillCollection.committeeName ? `Committee Payment - ${selectedBillCollection.committeeName}` : "General Deposit / Repayment"}
                        </div>
                        {selectedBillCollection.notes && <div className="text-xs text-zinc-500 mt-0.5">{selectedBillCollection.notes}</div>}
                      </TableCell>
                      <TableCell className="text-center py-3 capitalize text-zinc-800 font-medium">{selectedBillCollection.paymentMode}</TableCell>
                      <TableCell className="text-right py-3 pr-4 font-bold text-zinc-900">{formatCurrency(selectedBillCollection.amount)}</TableCell>
                    </TableRow>
                    {/* Total */}
                    <TableRow className="border-t bg-zinc-50/50">
                      <TableCell colSpan={2} className="text-right font-semibold py-2 text-zinc-600">Total Paid Amount:</TableCell>
                      <TableCell className="text-right font-bold py-2 pr-4 text-zinc-900 text-sm">{formatCurrency(selectedBillCollection.amount)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {/* Footer notes */}
                <div className="pt-4 border-t flex justify-between items-end text-[10px] text-zinc-400">
                  <p>This is a computer-generated receipt and does not require a physical signature.</p>
                  <p className="font-semibold">Thank you for your payment!</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 print:hidden">
                <Button variant="ghost" onClick={() => setSelectedBillCollection(null)}>Close</Button>
                <Button className="gap-2" onClick={() => {
                  const printContent = document.getElementById("printable-receipt")?.outerHTML || "";
                  const win = window.open("", "_blank");
                  if (win) {
                    win.document.write(`
                      <html>
                        <head>
                          <title>Receipt_${selectedBillCollection.receiptNumber || selectedBillCollection.id}</title>
                          <style>
                            body { font-family: system-ui, sans-serif; padding: 20px; color: black; background: white; }
                            .p-4 { padding: 1rem; }
                            .rounded { border-radius: 0.375rem; }
                            .border { border: 1px solid #e4e4e7; }
                            .space-y-4 > * + * { margin-top: 1rem; }
                            .space-y-6 > * + * { margin-top: 1.5rem; }
                            .flex { display: flex; }
                            .justify-between { justify-content: space-between; }
                            .items-start { align-items: flex-start; }
                            .items-end { align-items: flex-end; }
                            .border-b { border-bottom: 1px solid #e4e4e7; }
                            .pb-4 { padding-bottom: 1rem; }
                            .pt-4 { padding-top: 1rem; }
                            .border-t { border-top: 1px solid #e4e4e7; }
                            .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
                            .font-bold { font-weight: 700; }
                            .tracking-tight { letter-spacing: -0.025em; }
                            .text-xs { font-size: 0.75rem; }
                            .text-sm { font-size: 0.875rem; }
                            .text-zinc-500 { color: #71717a; }
                            .text-zinc-600 { color: #52525b; }
                            .text-zinc-900 { color: #18181b; }
                            .text-right { text-align: right; }
                            .font-semibold { font-weight: 600; }
                            .font-mono { font-family: monospace; }
                            .grid { display: grid; }
                            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                            .gap-4 { gap: 1rem; }
                            .mb-1 { margin-bottom: 0.25rem; }
                            .mt-1 { margin-top: 0.25rem; }
                            .mt-4 { margin-top: 1rem; }
                            table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                            th, td { border: 1px solid #e4e4e7; padding: 8px; text-align: left; font-size: 12px; }
                            th { background-color: #f4f4f5; }
                            .text-center { text-align: center; }
                            .capitalize { text-transform: capitalize; }
                            .bg-green-100 { background-color: #dcfce7; }
                            .text-green-800 { color: #166534; }
                            .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
                            .py-0.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
                          </style>
                        </head>
                        <body onload="window.print(); window.close();">
                          \${printContent}
                        </body>
                      </html>
                    `);
                    win.document.close();
                  }
                }}>
                  <Printer className="h-4 w-4 mr-2" /> Print Bill
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}