import React, { useState, useEffect } from "react";
import {
  useListCollections,
  useCreateCollection,
  useGetTodayCollectionSummary,
  useGetDueToday,
  useListCollectors,
  useListCommittees,
  getListCollectionsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient as useQC } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { customFetch } from "@workspace/api-client-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Wallet, Banknote, Smartphone, Building2, CreditCard, AlertCircle, CheckCircle2, XCircle, Clock, Printer, Search } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";

const collectionSchema = z.object({
  committeeId: z.coerce.number().min(1, "Bissi scheme is required"),
  customerId: z.coerce.number().min(1, "Customer is required"),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  paymentMode: z.enum(["cash", "upi", "bank", "card"]),
  utrNumber: z.string().optional(),
  collectorId: z.coerce.number().optional(),
  notes: z.string().optional(),
  billingName: z.string().optional(),
  billingPhone: z.string().optional(),
  billingAddress: z.string().optional(),
  billingGstin: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMode === "upi" && (!data.utrNumber || data.utrNumber.trim().length < 4)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "UTR Number is required for UPI payment", path: ["utrNumber"] });
  }
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

import { safeArray } from "@/lib/utils";

export default function CollectionsPage() {
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [verifyDialogId, setVerifyDialogId] = useState<number | null>(null);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [selectedBillCollection, setSelectedBillCollection] = useState<any | null>(null);
  const [showBillingDetails, setShowBillingDetails] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerMemberships, setSelectedCustomerMemberships] = useState<any[]>([]);
  const [extraBissiPayments, setExtraBissiPayments] = useState<Record<number, boolean>>({});
  const { role, user, isCustomer } = useRole();
  const isManager = ["super_admin", "owner", "branch_manager"].includes(role ?? "");

  const { data: collections, isLoading } = useListCollections({
    page,
    limit: 50,
    date: dateFilter || undefined,
    customerId: isCustomer ? user?.customerId ?? undefined : undefined,
  } as any);
  const { data: summary } = useGetTodayCollectionSummary();
  const { data: dueList } = useGetDueToday();
  const { data: collectors } = useListCollectors();
  const { data: committees } = useListCommittees();

  const collectionsList = safeArray<any>(collections);
  const collectorsList = safeArray<any>(collectors);
  const committeesList = safeArray<any>(committees);

  const form = useForm<z.infer<typeof collectionSchema>>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      committeeId: 0,
      customerId: 0,
      amount: 0,
      paymentMode: "cash",
      utrNumber: "",
      collectorId: undefined,
      notes: "",
      billingName: "",
      billingPhone: "",
      billingAddress: "",
      billingGstin: "",
    },
  });

  const watchedCommitteeId = useWatch({ control: form.control, name: "committeeId" });
  const watchedCustomerId = useWatch({ control: form.control, name: "customerId" });
  const watchedPaymentMode = useWatch({ control: form.control, name: "paymentMode" });

  // Filtered customers by selected bissi
  const { data: filteredCustomers, isLoading: customersLoading } = useQuery<any>({
    queryKey: ["customers-by-bissi", watchedCommitteeId, customerSearch],
    queryFn: () => customFetch(`/customers?committeeId=${watchedCommitteeId}&search=${encodeURIComponent(customerSearch)}&limit=100`),
    enabled: !!watchedCommitteeId && watchedCommitteeId > 0,
  });
  const customersList = filteredCustomers?.data || filteredCustomers?.customers || [];

  // Fetch selected customer's all bissi memberships for cross-bissi pending
  const { data: customerBissiData } = useQuery<any>({
    queryKey: ["customer-bissi-pending", watchedCustomerId],
    queryFn: () => customFetch(`/customers/${watchedCustomerId}/bissi-pending`),
    enabled: !!watchedCustomerId && watchedCustomerId > 0,
  });

  useEffect(() => {
    if (customerBissiData?.memberships) {
      setSelectedCustomerMemberships(customerBissiData.memberships);
      // Pre-fill amount from selected committee's installment
      const membership = customerBissiData.memberships.find((m: any) => m.committeeId === Number(watchedCommitteeId));
      if (membership && !form.getValues("amount")) {
        form.setValue("amount", Number(membership.installmentAmount));
      }
    }
  }, [customerBissiData, watchedCustomerId, watchedCommitteeId]);

  useEffect(() => {
    // Auto-fill amount when committee is selected
    const selected = committeesList.find((c: any) => c.id === Number(watchedCommitteeId));
    if (selected?.installmentAmount) {
      form.setValue("amount", Number(selected.installmentAmount));
    }
    setExtraBissiPayments({});
  }, [watchedCommitteeId]);

  useEffect(() => {
    // Reset customer when bissi changes
    form.setValue("customerId", 0);
    setCustomerSearch("");
    setSelectedCustomerMemberships([]);
  }, [watchedCommitteeId]);

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

  const onSubmit = (values: z.infer<typeof collectionSchema>) => {
    const utrNotes = values.utrNumber ? `UTR: ${values.utrNumber}` : "";
    const combinedNotes = [utrNotes, values.notes].filter(Boolean).join(" | ");

    // Build token allocations for primary + extra bissi payments
    const extraPayments = selectedCustomerMemberships.filter((m: any) =>
      extraBissiPayments[m.committeeId] && m.committeeId !== Number(values.committeeId)
    );

    if (extraPayments.length > 0) {
      const tokenAllocations = [
        { committeeId: Number(values.committeeId), amount: Number(values.amount), notes: combinedNotes || undefined },
        ...extraPayments.map((m: any) => ({
          committeeId: m.committeeId,
          amount: Number(m.installmentAmount),
          notes: combinedNotes || undefined,
        })),
      ];
      createCollection.mutate(
        {
          data: {
            customerId: values.customerId,
            amount: values.amount,
            paymentMode: values.paymentMode as any,
            collectorId: values.collectorId || undefined,
            notes: combinedNotes || undefined,
            billingName: values.billingName || undefined,
            billingPhone: values.billingPhone || undefined,
            billingAddress: values.billingAddress || undefined,
            billingGstin: values.billingGstin || undefined,
            tokenAllocations,
          } as any,
        },
        {
          onSuccess: () => {
            toast({ title: `${tokenAllocations.length} payments recorded successfully` });
            setIsCreateOpen(false);
            form.reset();
            setExtraBissiPayments({});
            setSelectedCustomerMemberships([]);
            queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
          },
          onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
        }
      );
    } else {
      createCollection.mutate(
        {
          data: {
            customerId: values.customerId,
            amount: values.amount,
            paymentMode: values.paymentMode as any,
            collectorId: values.collectorId || undefined,
            committeeId: Number(values.committeeId),
            notes: combinedNotes || undefined,
            billingName: values.billingName || undefined,
            billingPhone: values.billingPhone || undefined,
            billingAddress: values.billingAddress || undefined,
            billingGstin: values.billingGstin || undefined,
          } as any,
        },
        {
          onSuccess: () => {
            toast({ title: "Payment recorded successfully" });
            setIsCreateOpen(false);
            form.reset();
            setExtraBissiPayments({});
            setSelectedCustomerMemberships([]);
            queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
          },
          onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
        }
      );
    }
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
        {!isCustomer && (
          <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) { form.reset(); setExtraBissiPayments({}); setSelectedCustomerMemberships([]); setCustomerSearch(""); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Record Payment</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record Bissi Payment</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                  {/* ── Step 1: Select Bissi (Required) ── */}
                  <FormField
                    control={form.control}
                    name="committeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-sm">① Bissi Scheme चुनें (जरूरी)</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v)}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger className="font-semibold"><SelectValue placeholder="-- Bissi Scheme Select Karo --" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {committeesList.map((c: any) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.name} {c.installmentAmount ? `(₹${Number(c.installmentAmount).toLocaleString('en-IN')}/month)` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* ── Step 2: Search & Select Customer (filtered by selected Bissi) ── */}
                  {Number(watchedCommitteeId) > 0 && (
                    <FormField
                      control={form.control}
                      name="customerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold text-sm">② Customer / Member चुनें</FormLabel>
                          <div className="relative mb-1">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              className="pl-8 h-9 text-sm"
                              placeholder="नाम, मोबाइल या Ref नंबर से खोजें..."
                              value={customerSearch}
                              onChange={(e) => setCustomerSearch(e.target.value)}
                            />
                          </div>
                          <Select
                            onValueChange={(v) => field.onChange(v)}
                            value={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={customersLoading ? "Loading customers..." : "Customer Select Karo"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {customersList.length === 0 ? (
                                <SelectItem value="0" disabled>
                                  {customersLoading ? "Loading..." : "इस Bissi में कोई customer नहीं मिला"}
                                </SelectItem>
                              ) : (
                                customersList.map((c: any) => (
                                  <SelectItem key={c.id} value={c.id.toString()}>
                                    {c.name} {c.mobile ? `· ${c.mobile}` : ""} {c.referenceNumber ? `(${c.referenceNumber})` : ""}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* ── Other Bissi Pending Panel ── */}
                  {Number(watchedCustomerId) > 0 && selectedCustomerMemberships.length > 1 && (
                    <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-50/40 dark:bg-amber-900/10 space-y-2">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                        ⚠️ इस Customer की अन्य Bissi Schemes — यहाँ से एक साथ जमा कर सकते हैं
                      </p>
                      <div className="space-y-1.5">
                        {selectedCustomerMemberships.map((m: any) => {
                          const isPrimary = m.committeeId === Number(watchedCommitteeId);
                          const isPending = !m.paidThisMonth;
                          return (
                            <div key={m.committeeId} className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs ${isPrimary ? "bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20" : isPending ? "bg-rose-50 border-rose-200 dark:bg-rose-900/10" : "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10"}`}>
                              <div>
                                <span className="font-semibold">{m.committeeName}</span>
                                <span className="ml-2 font-mono text-muted-foreground">Token #{m.tokenNumber}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`font-bold font-mono ${isPending ? "text-rose-600" : "text-emerald-600"}`}>
                                  ₹{Number(m.installmentAmount).toLocaleString('en-IN')}
                                </span>
                                {isPrimary ? (
                                  <Badge className="text-[10px] bg-indigo-500/20 text-indigo-700 border border-indigo-300">Primary</Badge>
                                ) : isPending ? (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-300">🔴 Pending</Badge>
                                    <Checkbox
                                      checked={!!extraBissiPayments[m.committeeId]}
                                      onCheckedChange={(checked) => setExtraBissiPayments(prev => ({ ...prev, [m.committeeId]: !!checked }))}
                                    />
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">✓ Paid</Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {Object.values(extraBissiPayments).some(Boolean) && (
                        <p className="text-[11px] text-amber-700 font-semibold pt-1">
                          ✅ Checked bissi का payment भी एक साथ जमा होगा
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── Amount & Payment Mode ── */}
                  {Number(watchedCommitteeId) > 0 && (
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
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="cash"><span className="flex items-center gap-2"><Banknote className="h-4 w-4" />Cash</span></SelectItem>
                                <SelectItem value="upi"><span className="flex items-center gap-2"><Smartphone className="h-4 w-4" />UPI</span></SelectItem>
                                <SelectItem value="bank"><span className="flex items-center gap-2"><Building2 className="h-4 w-4" />Bank Transfer</span></SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* ── UPI: UTR Number (Required) + Screenshot (Optional) ── */}
                  {watchedPaymentMode === "upi" && (
                    <div className="space-y-3 p-3 rounded-lg border border-blue-400/40 bg-blue-50/40 dark:bg-blue-900/10">
                      <p className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                        <Smartphone className="h-3.5 w-3.5" /> UPI Payment Details
                      </p>
                      <FormField
                        control={form.control}
                        name="utrNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold">UTR / Transaction Number <span className="text-rose-500">*जरूरी</span></FormLabel>
                            <FormControl>
                              <Input
                                placeholder="12-digit UTR number (e.g. 123456789012)"
                                className="h-9 font-mono"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div>
                        <Label className="text-xs text-muted-foreground">Screenshot (Optional — अपलोड करें)</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          className="h-9 text-xs mt-1"
                          onChange={(e) => {
                            // Screenshot stored locally for reference; stored as note
                            const file = e.target.files?.[0];
                            if (file) {
                              const currentNotes = form.getValues("notes") || "";
                              form.setValue("notes", [currentNotes, `Screenshot: ${file.name}`].filter(Boolean).join(" | "));
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Collector & Notes ── */}
                  {Number(watchedCommitteeId) > 0 && (
                    <>
                      <FormField
                        control={form.control}
                        name="collectorId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Collector (optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Assign collector" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="0">None</SelectItem>
                                {collectorsList.map((c: any) => (
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
                        <label htmlFor="add-billing-details" className="text-sm font-medium leading-none cursor-pointer">
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
                                const cust = customersList.find((c: any) => c.id === Number(watchedCustomerId));
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
                          <FormField control={form.control} name="billingName" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Recipient Name</FormLabel>
                              <FormControl><Input placeholder="Recipient Full Name" className="h-8 text-sm" {...field} /></FormControl>
                            </FormItem>
                          )} />
                          <div className="grid grid-cols-2 gap-2">
                            <FormField control={form.control} name="billingPhone" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Phone Number</FormLabel>
                                <FormControl><Input placeholder="10-digit mobile" className="h-8 text-sm" {...field} /></FormControl>
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="billingGstin" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">GSTIN (Optional)</FormLabel>
                                <FormControl><Input placeholder="22AAAAA0000A1Z5" className="h-8 text-sm uppercase" {...field} /></FormControl>
                              </FormItem>
                            )} />
                          </div>
                          <FormField control={form.control} name="billingAddress" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Address</FormLabel>
                              <FormControl><Input placeholder="Recipient Address" className="h-8 text-sm" {...field} /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex justify-end pt-4 gap-2">
                    <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createCollection.isPending || Number(watchedCommitteeId) < 1 || Number(watchedCustomerId) < 1}>
                      {createCollection.isPending ? "Saving..." : "Record Payment"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!isCustomer && (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Today", value: summary?.totalAmount ?? 0, icon: Wallet },
            { label: "Cash", value: summary?.cashAmount ?? 0, icon: Banknote },
            { label: "UPI", value: summary?.upiAmount ?? 0, icon: Smartphone },
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
      )}

      {!isCustomer && dueList && dueList.length > 0 && (
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
              ) : collectionsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No collections found</TableCell>
                </TableRow>
              ) : (
                collectionsList.map((col: any) => (
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
                        <div className="font-medium text-foreground">{col.customerName ?? `#${col.customerId}`}</div>
                        <div className="text-xs text-muted-foreground font-mono">{col.customerMobile || col.customerRef || "Ref on file"}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-semibold text-primary">{col.collectorName ?? "Field Collector"}</div>
                        <div className="text-[10px] text-muted-foreground">Collected By</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1 text-xs">
                          {paymentModeIcon[col.paymentMode]}
                          {col.paymentMode?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">{formatCurrency(col.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>{col.collectedAt ? new Date(col.collectedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</div>
                        {col.notes && <div className="text-[10px] text-muted-foreground max-w-[150px] truncate">{col.notes}</div>}
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

      {/* ── Collector: Customer Dues Lookup ── */}
      {!isCustomer && <CollectorDuesPanel />}

      {/* ── Collector: KYC Panel ── */}
      {!isCustomer && <CollectorKycPanel />}
    </div>
  );
}

// ── Collector: Customer Dues Lookup ─────────────────────────────────────────
function CollectorDuesPanel() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQC();
  const createCollection = useCreateCollection();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: searchResults } = useQuery<any>({
    queryKey: ["collector-lookup", debouncedSearch],
    queryFn: () => customFetch(`/collector/customer-lookup?search=${encodeURIComponent(debouncedSearch)}`),
    enabled: debouncedSearch.length >= 2,
  });

  const { data: duesData, isLoading: duesLoading } = useQuery<any>({
    queryKey: ["customer-dues", selectedCustomerId],
    queryFn: () => customFetch(`/customers/${selectedCustomerId}/dues`),
    enabled: !!selectedCustomerId,
  });

  const customer = duesData?.customer;
  const dues = duesData?.dues || [];
  const totalDue = duesData?.totalDue || 0;

  const [payMode, setPayMode] = useState("cash");
  const [utrNumber, setUtrNumber] = useState("");
  const [selectedDues, setSelectedDues] = useState<Record<string, boolean>>({});
  const [isPayOpen, setIsPayOpen] = useState(false);

  const selectedTotal = dues
    .filter((_: any, i: number) => selectedDues[i])
    .reduce((s: number, d: any) => s + Number(d.dueAmount || 0), 0);

  const handlePayDues = () => {
    if (payMode === "upi" && !utrNumber.trim()) {
      toast({ title: "UPI ke liye UTR number daalna zaroori hai", variant: "destructive" });
      return;
    }
    const selectedList = dues.filter((_: any, i: number) => selectedDues[i]);
    if (selectedList.length === 0) {
      toast({ title: "Koi due select nahi kiya", variant: "destructive" });
      return;
    }

    const notes = payMode === "upi" && utrNumber ? `UTR: ${utrNumber}` : undefined;

    if (selectedList.length === 1 || selectedList.every((d: any) => d.committeeId === selectedList[0].committeeId)) {
      const d = selectedList[0];
      createCollection.mutate(
        { data: { customerId: selectedCustomerId!, amount: selectedTotal, paymentMode: payMode as any, committeeId: d.committeeId || undefined, notes } as any },
        {
          onSuccess: () => {
            toast({ title: "Payment recorded ✓" });
            queryClient.invalidateQueries({ queryKey: ["customer-dues", selectedCustomerId] });
            queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
            setSelectedDues({});
            setUtrNumber("");
            setIsPayOpen(false);
          },
          onError: () => toast({ title: "Payment record karne mein error", variant: "destructive" }),
        }
      );
    } else {
      // Multiple bissi — use tokenAllocations
      const tokenAllocations = selectedList.map((d: any) => ({
        committeeId: d.committeeId,
        amount: d.dueAmount,
        notes,
      }));
      createCollection.mutate(
        { data: { customerId: selectedCustomerId!, amount: selectedTotal, paymentMode: payMode as any, notes, tokenAllocations } as any },
        {
          onSuccess: () => {
            toast({ title: `${tokenAllocations.length} dues recorded ✓` });
            queryClient.invalidateQueries({ queryKey: ["customer-dues", selectedCustomerId] });
            queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
            setSelectedDues({});
            setUtrNumber("");
            setIsPayOpen(false);
          },
          onError: () => toast({ title: "Payment record karne mein error", variant: "destructive" }),
        }
      );
    }
  };

  return (
    <Card className="border-indigo-500/20 bg-indigo-500/5 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
          <Search className="h-4 w-4" /> Customer Due Search — Token / Name / Mobile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="Customer ka naam, mobile ya token number dalein..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedCustomerId(null); }}
            />
          </div>
        </div>

        {/* Search Results */}
        {searchResults?.customers?.length > 0 && !selectedCustomerId && (
          <div className="border rounded-lg overflow-hidden">
            {searchResults.customers.map((c: any) => (
              <button
                key={c.id}
                className="w-full text-left px-4 py-3 hover:bg-muted/60 border-b last:border-0 flex justify-between items-center text-sm"
                onClick={() => { setSelectedCustomerId(c.id); setSearch(c.name); }}
              >
                <div>
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{c.mobile}</span>
                </div>
                <Badge variant="outline" className="text-xs font-mono">{c.referenceNumber}</Badge>
              </button>
            ))}
          </div>
        )}

        {/* Customer Dues */}
        {selectedCustomerId && duesData && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">{customer?.name}</p>
                <p className="text-xs text-muted-foreground">{customer?.mobile} · Ref: {customer?.referenceNumber}</p>
              </div>
              <Badge variant="destructive" className="font-mono">Total Due: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalDue)}</Badge>
            </div>

            {duesLoading ? (
              <p className="text-xs text-muted-foreground">Loading dues...</p>
            ) : dues.length === 0 ? (
              <p className="text-xs text-emerald-600 font-semibold">✓ Koi due nahi hai is month</p>
            ) : (
              <>
                <div className="space-y-2">
                  {dues.map((d: any, i: number) => (
                    <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs ${d.dueType === 'bissi' ? 'bg-rose-50/40 border-rose-200' : 'bg-amber-50/40 border-amber-200'}`}>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={!!selectedDues[i]} onCheckedChange={(v) => setSelectedDues(p => ({ ...p, [i]: !!v }))} />
                        <div>
                          <span className="font-semibold">
                            {d.dueType === 'bissi' ? `📋 Bissi: ${d.committeeName} (Token #${d.tokenNumber})` : `💰 Loan #${d.loanId}: ${d.purpose || 'Personal'}`}
                          </span>
                        </div>
                      </div>
                      <span className="font-bold font-mono text-rose-700">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(d.dueAmount))}</span>
                    </div>
                  ))}
                </div>

                {Object.values(selectedDues).some(Boolean) && (
                  <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 space-y-2">
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span>Selected Amount:</span>
                      <span className="font-mono text-indigo-700">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(selectedTotal)}</span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={payMode}
                        onChange={(e) => setPayMode(e.target.value)}
                        className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="bank">Bank Transfer</option>
                      </select>
                      {payMode === "upi" && (
                        <Input
                          className="flex-1 h-9 text-sm font-mono"
                          placeholder="UTR Number (जरूरी)*"
                          value={utrNumber}
                          onChange={(e) => setUtrNumber(e.target.value)}
                        />
                      )}
                    </div>
                    <Button
                      className="w-full gap-2 font-bold"
                      onClick={handlePayDues}
                      disabled={createCollection.isPending}
                    >
                      <Wallet className="h-4 w-4" />
                      {createCollection.isPending ? "Recording..." : "Jama Karo (Record Payment)"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Collector: KYC Verification Panel ─────────────────────────────────────
function CollectorKycPanel() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState("");
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState("");
  const { toast } = useToast();
  const queryClient = useQC();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: searchResults } = useQuery<any>({
    queryKey: ["kyc-collector-lookup", debouncedSearch],
    queryFn: () => customFetch(`/collector/customer-lookup?search=${encodeURIComponent(debouncedSearch)}`),
    enabled: debouncedSearch.length >= 2,
  });

  const { data: kycStatus } = useQuery<any>({
    queryKey: ["kyc-status-collector", selectedCustomer?.id],
    queryFn: () => customFetch(`/kyc/me?customerId=${selectedCustomer.id}`),
    enabled: !!selectedCustomer?.id,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: "front" | "back") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast({ variant: "destructive", title: "File too large (max 8MB)" }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      if (side === "front") setAadhaarFrontUrl(b64);
      else setAadhaarBackUrl(b64);
      toast({ title: `Aadhaar ${side === "front" ? "Front" : "Back"} photo loaded` });
    };
    reader.readAsDataURL(file);
  };

  const submitKyc = useMutation({
    mutationFn: async () => {
      if (!aadhaarNumber || aadhaarNumber.replace(/\D/g, "").length < 12)
        throw new Error("Valid 12-digit Aadhaar number daalen");
      if (!aadhaarFrontUrl) throw new Error("Aadhaar front photo upload karein");
      if (!aadhaarBackUrl) throw new Error("Aadhaar back photo upload karein");

      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          userName: selectedCustomer.name,
          userMobile: selectedCustomer.mobile,
          userRole: "customer",
          aadhaarNumber,
          aadhaarFrontUrl,
          aadhaarBackUrl,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "KYC submit failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "KYC submitted for admin review ✓" });
      queryClient.invalidateQueries({ queryKey: ["kyc-status-collector"] });
      setAadhaarNumber(""); setAadhaarFrontUrl(""); setAadhaarBackUrl("");
    },
    onError: (err: any) => toast({ variant: "destructive", title: err.message }),
  });

  return (
    <Card className="border-amber-500/20 bg-amber-50/20 dark:bg-amber-900/10 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <CheckCircle2 className="h-4 w-4" /> Collector KYC — Customer Aadhaar Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Customer naam ya mobile number dalein..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedCustomer(null); setAadhaarNumber(""); setAadhaarFrontUrl(""); setAadhaarBackUrl(""); }}
          />
        </div>

        {searchResults?.customers?.length > 0 && !selectedCustomer && (
          <div className="border rounded-lg overflow-hidden">
            {searchResults.customers.map((c: any) => (
              <button
                key={c.id}
                className="w-full text-left px-4 py-3 hover:bg-muted/60 border-b last:border-0 flex justify-between items-center text-sm"
                onClick={() => { setSelectedCustomer(c); setSearch(c.name); }}
              >
                <div>
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{c.mobile}</span>
                </div>
                <Badge variant="outline" className="text-xs">{c.referenceNumber}</Badge>
              </button>
            ))}
          </div>
        )}

        {selectedCustomer && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/40 border flex justify-between items-center">
              <div>
                <p className="font-bold text-sm">{selectedCustomer.name}</p>
                <p className="text-xs text-muted-foreground">{selectedCustomer.mobile} · {selectedCustomer.address || "Address on file"}</p>
              </div>
              {kycStatus?.status && (
                <Badge variant={kycStatus.status === "approved" ? "default" : kycStatus.status === "pending" ? "secondary" : "outline"}
                  className={kycStatus.status === "approved" ? "bg-emerald-600" : ""}>
                  {kycStatus.status === "approved" ? "✓ KYC Verified" : kycStatus.status === "pending" ? "⏳ Under Review" : "KYC Not Done"}
                </Badge>
              )}
            </div>

            {kycStatus?.status !== "approved" && (
              <>
                <div>
                  <Label className="text-xs font-bold">Aadhaar Card Number (12 Digits)</Label>
                  <Input
                    className="mt-1 font-mono"
                    placeholder="e.g. 1234 5678 9012"
                    maxLength={14}
                    value={aadhaarNumber}
                    onChange={(e) => setAadhaarNumber(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(["front", "back"] as const).map((side) => {
                    const imgUrl = side === "front" ? aadhaarFrontUrl : aadhaarBackUrl;
                    return (
                      <div key={side} className="border-2 border-dashed rounded-xl p-3 text-center space-y-2 hover:border-primary/50 transition-colors">
                        {imgUrl ? (
                          <img src={imgUrl} alt={`Aadhaar ${side}`} className="w-full h-24 object-contain rounded" />
                        ) : (
                          <div className="h-24 flex items-center justify-center text-muted-foreground text-xs">
                            📷 Aadhaar {side === "front" ? "Front" : "Back"}
                          </div>
                        )}
                        <Label htmlFor={`kyc-${side}`} className="cursor-pointer">
                          <Button type="button" size="sm" variant="outline" className="pointer-events-none text-xs w-full">
                            {imgUrl ? "Change" : "Upload"} {side === "front" ? "Front" : "Back"}
                          </Button>
                        </Label>
                        <input
                          id={`kyc-${side}`}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => handleFileChange(e, side)}
                        />
                      </div>
                    );
                  })}
                </div>

                <Button
                  className="w-full gap-2 font-bold"
                  onClick={() => submitKyc.mutate()}
                  disabled={submitKyc.isPending}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submitKyc.isPending ? "Submitting..." : "Submit KYC for Admin Verification"}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}