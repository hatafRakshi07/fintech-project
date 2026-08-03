import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { safeArray } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BookOpen, Plus, Search, Filter, Users, CheckCircle2, Clock,
  TrendingUp, CreditCard, Calendar, Phone, MapPin, Edit2, Trash2,
  ChevronRight, ArrowLeft, AlertCircle, Wallet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

type DailyLoan = {
  id: string;
  customerName: string;
  mobileNumber: string;
  referenceMobileNumbers?: string;
  address?: string;
  security?: string;
  loanAmount: number;
  startDate?: string;
  expectedCompleteDate?: string;
  collectionPlan: string;
  notes?: string;
  status: "ACTIVE" | "COMPLETED" | "DEFAULTED";
  totalCollected: number;
  remainingAmount: number;
  completionPct: number;
  lastPaymentDate?: string;
  createdAt: string;
};

type DashboardStats = {
  totalLoans: number;
  activeLoans: number;
  completedLoans: number;
  totalLoanAmount: number;
  totalAmountCollected: number;
  totalRemainingAmount: number;
  todayCollection: number;
  todayExpected: number;
};

type PaymentEntry = {
  id: string;
  paymentDate: string;
  amountDeposited: number;
  paymentMode: string;
  notes?: string;
  runningRemainingBalance: number;
};

type LoanDetail = DailyLoan & { payments: PaymentEntry[] };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const statusBadge = (s: string) => {
  if (s === "COMPLETED") return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">Completed</Badge>;
  if (s === "DEFAULTED") return <Badge variant="destructive">Defaulted</Badge>;
  return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Active</Badge>;
};

const COLLECTION_PLANS = ["100/day", "250/day", "300/day", "400/day", "500/day", "600/day", "700/day", "800/day", "1000/day", "1400/week", "3500/week", "Custom"];

// ─── Empty form ───────────────────────────────────────────────────────────────

const emptyLoanForm = () => ({
  customerName: "", mobileNumber: "", referenceMobileNumbers: "",
  address: "", security: "", loanAmount: "", startDate: new Date().toISOString().slice(0, 10),
  expectedCompleteDate: "", collectionPlan: "500/day", customPlanAmount: "",
  notes: "", initialPaymentAmount: "",
});

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DailyDiaryPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [selectedLoan, setSelectedLoan] = useState<DailyLoan | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [form, setForm] = useState(emptyLoanForm());

  // ── Stats ──────────────────────────────────────────────────────────────────
  const { data: statsData } = useQuery<{ success: boolean; stats: DashboardStats }>({
    queryKey: ["daily-diary-stats"],
    queryFn: () => api.get("/daily-diary/dashboard"),
    refetchInterval: 30_000,
  });
  const stats = statsData?.stats;

  // ── Loans list ─────────────────────────────────────────────────────────────
  const { data: loansData, isLoading } = useQuery<{ success: boolean; loans: DailyLoan[] }>({
    queryKey: ["daily-diary-loans", statusFilter, planFilter, searchTerm],
    queryFn: () => {
      const p = new URLSearchParams();
      if (statusFilter !== "ALL") p.set("status", statusFilter);
      if (planFilter !== "ALL") p.set("plan", planFilter);
      if (searchTerm.trim()) p.set("search", searchTerm.trim());
      return api.get(`/daily-diary/loans?${p}`);
    },
    refetchInterval: 30_000,
  });
  const loans = safeArray<DailyLoan>(loansData?.loans ?? loansData);

  // ── Loan detail (with payments) ────────────────────────────────────────────
  const { data: detailData, isLoading: detailLoading } = useQuery<{ success: boolean; loan: LoanDetail }>({
    queryKey: ["daily-diary-loan", selectedLoan?.id],
    queryFn: () => api.get(`/daily-diary/loans/${selectedLoan!.id}`),
    enabled: !!selectedLoan && isDetailOpen,
  });
  const loanDetail = detailData?.loan;

  // ── Create loan ────────────────────────────────────────────────────────────
  const createLoan = useMutation({
    mutationFn: (data: typeof form) => api.post("/daily-diary/loans", {
      ...data,
      loanAmount: Number(data.loanAmount),
      initialPaymentAmount: data.initialPaymentAmount ? Number(data.initialPaymentAmount) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-diary-loans"] });
      qc.invalidateQueries({ queryKey: ["daily-diary-stats"] });
      setIsAddOpen(false);
      setForm(emptyLoanForm());
      toast({ title: "Loan added successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Delete loan ────────────────────────────────────────────────────────────
  const deleteLoan = useMutation({
    mutationFn: (id: string) => api.delete(`/daily-diary/loans/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-diary-loans"] });
      qc.invalidateQueries({ queryKey: ["daily-diary-stats"] });
      setIsDetailOpen(false);
      setSelectedLoan(null);
      toast({ title: "Loan deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Payment state ──────────────────────────────────────────────────────────
  const [payForm, setPayForm] = useState({ paymentDate: new Date().toISOString().slice(0, 10), amountDeposited: "", paymentMode: "Cash", notes: "" });
  const [isPayOpen, setIsPayOpen] = useState(false);

  const addPayment = useMutation({
    mutationFn: (data: typeof payForm) => api.post(`/daily-diary/loans/${selectedLoan!.id}/payments`, {
      ...data,
      amountDeposited: Number(data.amountDeposited),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-diary-loan", selectedLoan?.id] });
      qc.invalidateQueries({ queryKey: ["daily-diary-loans"] });
      qc.invalidateQueries({ queryKey: ["daily-diary-stats"] });
      setIsPayOpen(false);
      setPayForm({ paymentDate: new Date().toISOString().slice(0, 10), amountDeposited: "", paymentMode: "Cash", notes: "" });
      toast({ title: "Payment recorded" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyLoanForm());

  const updateLoan = useMutation({
    mutationFn: (data: typeof editForm) => api.put(`/daily-diary/loans/${selectedLoan!.id}`, {
      customerName: data.customerName,
      mobileNumber: data.mobileNumber,
      referenceMobileNumbers: data.referenceMobileNumbers,
      address: data.address,
      security: data.security,
      loanAmount: Number(data.loanAmount),
      startDate: data.startDate,
      expectedCompleteDate: data.expectedCompleteDate,
      collectionPlan: data.collectionPlan === "Custom" ? `${data.customPlanAmount}/day` : data.collectionPlan,
      notes: data.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-diary-loan", selectedLoan?.id] });
      qc.invalidateQueries({ queryKey: ["daily-diary-loans"] });
      setIsEditOpen(false);
      toast({ title: "Updated successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Detail view ────────────────────────────────────────────────────────────
  if (isDetailOpen && selectedLoan) {
    return (
      <LoanDetailView
        loan={selectedLoan}
        detail={loanDetail}
        loading={detailLoading}
        onBack={() => { setIsDetailOpen(false); setSelectedLoan(null); }}
        onDelete={() => deleteLoan.mutate(selectedLoan.id)}
        onEdit={() => {
          setEditForm({
            customerName: selectedLoan.customerName,
            mobileNumber: selectedLoan.mobileNumber || "",
            referenceMobileNumbers: selectedLoan.referenceMobileNumbers || "",
            address: selectedLoan.address || "",
            security: selectedLoan.security || "",
            loanAmount: String(selectedLoan.loanAmount),
            startDate: selectedLoan.startDate || "",
            expectedCompleteDate: selectedLoan.expectedCompleteDate || "",
            collectionPlan: selectedLoan.collectionPlan || "500/day",
            customPlanAmount: "",
            notes: selectedLoan.notes || "",
            initialPaymentAmount: "",
          });
          setIsEditOpen(true);
        }}
        isPayOpen={isPayOpen}
        setIsPayOpen={setIsPayOpen}
        payForm={payForm}
        setPayForm={setPayForm}
        onAddPayment={() => addPayment.mutate(payForm)}
        addPaymentPending={addPayment.isPending}
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editForm={editForm}
        setEditForm={setEditForm}
        onUpdateLoan={() => updateLoan.mutate(editForm)}
        updatePending={updateLoan.isPending}
        deletePending={deleteLoan.isPending}
      />
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-amber-600" />
            Daily Diary
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">
              Daily Loan Collection
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Flexible loan recovery ledger with daily and weekly repayment tracking.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add New Loan</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add New Daily Loan</DialogTitle></DialogHeader>
            <LoanForm form={form} setForm={setForm} onSubmit={() => createLoan.mutate(form)} pending={createLoan.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase font-medium">Total Customers</p>
              <p className="text-2xl font-bold">{stats.totalLoans}</p>
              <p className="text-xs text-muted-foreground">{stats.activeLoans} active · {stats.completedLoans} done</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase font-medium">Total Loan Amount</p>
              <p className="text-2xl font-bold text-amber-600">{fmt(stats.totalLoanAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase font-medium">Total Collected</p>
              <p className="text-2xl font-bold text-emerald-600">{fmt(stats.totalAmountCollected)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase font-medium">Total Remaining</p>
              <p className="text-2xl font-bold text-rose-600">{fmt(stats.totalRemainingAmount)}</p>
              <p className="text-xs text-emerald-600">Today: {fmt(stats.todayCollection)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or mobile..." className="pl-9"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Plans</SelectItem>
            <SelectItem value="day">Daily Plans</SelectItem>
            <SelectItem value="week">Weekly Plans</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loans Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Loan Amount</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Collected</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading loans...</TableCell></TableRow>
              ) : loans.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  No daily diary loan accounts found.
                </TableCell></TableRow>
              ) : loans.map(loan => (
                <TableRow key={loan.id} className="cursor-pointer hover:bg-muted/50"
                  onClick={() => { setSelectedLoan(loan); setIsDetailOpen(true); }}>
                  <TableCell>
                    <div className="font-medium">{loan.customerName}</div>
                    {loan.notes && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{loan.notes}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{loan.mobileNumber || "—"}</TableCell>
                  <TableCell className="font-bold text-amber-600">{fmt(loan.loanAmount)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{loan.collectionPlan}</Badge></TableCell>
                  <TableCell className="text-emerald-600 font-medium">{fmt(loan.totalCollected)}</TableCell>
                  <TableCell className="text-rose-600 font-medium">{fmt(loan.remainingAmount)}</TableCell>
                  <TableCell className="min-w-[100px]">
                    <div className="space-y-1">
                      <Progress value={loan.completionPct} className="h-2" />
                      <span className="text-xs text-muted-foreground">{loan.completionPct}%</span>
                    </div>
                  </TableCell>
                  <TableCell>{statusBadge(loan.status)}</TableCell>
                  <TableCell className="text-sm">{loan.startDate || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Loan Detail View ─────────────────────────────────────────────────────────

function LoanDetailView({ loan, detail, loading, onBack, onDelete, onEdit, isPayOpen, setIsPayOpen, payForm, setPayForm, onAddPayment, addPaymentPending, isEditOpen, setIsEditOpen, editForm, setEditForm, onUpdateLoan, updatePending, deletePending }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const deletePayment = useMutation({
    mutationFn: (id: string) => api.delete(`/daily-diary/payments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-diary-loan", loan.id] });
      qc.invalidateQueries({ queryKey: ["daily-diary-loans"] });
      toast({ title: "Payment deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const payments = detail?.payments || [];
  const loanData = detail || loan;

  return (
    <div className="space-y-6">
      {/* Back & Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Daily Diary
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Edit2 className="h-4 w-4 mr-2" />Edit
          </Button>
          <Button variant="outline" className="text-destructive border-destructive/30"
            onClick={() => { if (confirm("Delete this loan account?")) onDelete(); }}
            disabled={deletePending}>
            <Trash2 className="h-4 w-4 mr-2" />Delete
          </Button>
          <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
            <DialogTrigger asChild>
              <Button disabled={loanData.status === "COMPLETED"}>
                <Plus className="h-4 w-4 mr-2" />Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Payment Date</Label>
                  <Input type="date" value={payForm.paymentDate} onChange={e => setPayForm({ ...payForm, paymentDate: e.target.value })} />
                </div>
                <div>
                  <Label>Amount (₹)</Label>
                  <Input type="number" placeholder="500" value={payForm.amountDeposited}
                    onChange={e => setPayForm({ ...payForm, amountDeposited: e.target.value })} />
                </div>
                <div>
                  <Label>Payment Mode</Label>
                  <Select value={payForm.paymentMode} onValueChange={v => setPayForm({ ...payForm, paymentMode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Input value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
                </div>
                <Button className="w-full" onClick={onAddPayment}
                  disabled={addPaymentPending || !payForm.amountDeposited}>
                  {addPaymentPending ? "Saving..." : "Record Payment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Loan Profile Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <BookOpen className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-xl">{loanData.customerName}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {statusBadge(loanData.status)}
                <Badge variant="outline" className="text-xs">{loanData.collectionPlan}</Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-muted-foreground">Loan Amount</p>
              <p className="font-bold text-amber-700">{fmt(loanData.loanAmount)}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-xs text-muted-foreground">Total Collected</p>
              <p className="font-bold text-emerald-700">{fmt(loanData.totalCollected || 0)}</p>
            </div>
            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="font-bold text-rose-700">{fmt(Math.max(0, loanData.remainingAmount || 0))}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-muted-foreground">Completion</p>
              <p className="font-bold text-blue-700">{loanData.completionPct || 0}%</p>
            </div>
          </div>
          <Progress value={loanData.completionPct || 0} className="h-3 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {loanData.mobileNumber && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{loanData.mobileNumber}</div>}
            {loanData.referenceMobileNumbers && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{loanData.referenceMobileNumbers} (ref)</div>}
            {loanData.address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{loanData.address}</div>}
            {loanData.startDate && <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />Start: {loanData.startDate}</div>}
            {loanData.expectedCompleteDate && <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />Expected End: {loanData.expectedCompleteDate}</div>}
            {loanData.notes && <div className="flex items-center gap-2 col-span-full text-muted-foreground"><AlertCircle className="h-4 w-4" />{loanData.notes}</div>}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-amber-600" />
            Payment Ledger & Deposit History
            <Badge variant="secondary">{payments.length} payments</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading payments...</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No payment deposits recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance After</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p: PaymentEntry, idx: number) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>{p.paymentDate}</TableCell>
                      <TableCell className="font-bold text-emerald-600">+{fmt(p.amountDeposited)}</TableCell>
                      <TableCell className="text-amber-600 font-medium">{fmt(p.runningRemainingBalance)}</TableCell>
                      <TableCell>{p.paymentMode || "Cash"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.notes || "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                          onClick={() => { if (confirm("Delete this payment?")) deletePayment.mutate(p.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Loan Account</DialogTitle></DialogHeader>
          <LoanForm form={editForm} setForm={setEditForm} onSubmit={onUpdateLoan} pending={updatePending} submitLabel="Update" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Loan Form (shared by Add & Edit) ────────────────────────────────────────

function LoanForm({ form, setForm, onSubmit, pending, submitLabel = "Add Loan" }: any) {
  const f = form;
  const sf = (key: string, val: string) => setForm((prev: any) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Customer Name <span className="text-red-500">*</span></Label>
          <Input value={f.customerName} onChange={e => sf("customerName", e.target.value)} placeholder="Full name..." />
        </div>
        <div>
          <Label>Mobile Number</Label>
          <Input value={f.mobileNumber} onChange={e => sf("mobileNumber", e.target.value)} placeholder="10-digit mobile" />
        </div>
        <div>
          <Label>Reference Mobile</Label>
          <Input value={f.referenceMobileNumbers} onChange={e => sf("referenceMobileNumbers", e.target.value)} placeholder="Ref mobile..." />
        </div>
        <div className="col-span-2">
          <Label>Address</Label>
          <Input value={f.address} onChange={e => sf("address", e.target.value)} placeholder="Address..." />
        </div>
        <div>
          <Label>Security</Label>
          <Input value={f.security} onChange={e => sf("security", e.target.value)} placeholder="Any security..." />
        </div>
        <div>
          <Label>Loan Amount (₹) <span className="text-red-500">*</span></Label>
          <Input type="number" value={f.loanAmount} onChange={e => sf("loanAmount", e.target.value)} placeholder="20000" />
        </div>
        <div>
          <Label>Start Date</Label>
          <Input type="date" value={f.startDate} onChange={e => sf("startDate", e.target.value)} />
        </div>
        <div>
          <Label>Expected End Date</Label>
          <Input type="date" value={f.expectedCompleteDate} onChange={e => sf("expectedCompleteDate", e.target.value)} />
        </div>
        <div>
          <Label>Collection Plan <span className="text-red-500">*</span></Label>
          <Select value={f.collectionPlan} onValueChange={v => sf("collectionPlan", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COLLECTION_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {f.collectionPlan === "Custom" && (
          <div>
            <Label>Custom Amount/day (₹)</Label>
            <Input type="number" value={f.customPlanAmount} onChange={e => sf("customPlanAmount", e.target.value)} placeholder="e.g. 300" />
          </div>
        )}
        {submitLabel === "Add Loan" && (
          <div>
            <Label>Initial Payment (₹)</Label>
            <Input type="number" value={f.initialPaymentAmount} onChange={e => sf("initialPaymentAmount", e.target.value)} placeholder="Optional" />
          </div>
        )}
        <div className="col-span-2">
          <Label>Notes / Reason</Label>
          <Textarea value={f.notes} onChange={(e: any) => sf("notes", e.target.value)} placeholder="Any notes..." rows={2} />
        </div>
      </div>
      <Button className="w-full" onClick={onSubmit}
        disabled={pending || !f.customerName || !f.loanAmount}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </div>
  );
}
