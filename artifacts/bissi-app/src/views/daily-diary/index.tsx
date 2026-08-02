'use client';

import React, { useState } from "react";
import { Link, useLocation } from "@/lib/router-adapter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  CreditCard,
  Calendar,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  ShieldCheck,
  Phone,
  MapPin,
  Sparkles,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface DailyDiaryLoan {
  id: string;
  customerName: string;
  mobileNumber: string;
  referenceMobileNumbers: string;
  address: string;
  security: string;
  loanAmount: number;
  startDate: string;
  expectedCompleteDate: string;
  collectionPlan: string;
  notes: string;
  status: "ACTIVE" | "COMPLETED";
  totalCollected: number;
  remainingAmount: number;
  completionPct: number;
  totalPaymentsCount: number;
  lastPaymentDate: string;
}

interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  completedCustomers: number;
  totalLoanAmount: number;
  totalAmountCollected: number;
  totalRemainingAmount: number;
  todayCollection: number;
  todayTargetCollection?: number;
  todayPendingCollection?: number;
  todayAchievementPct?: number;
  todayPaidCustomersCount?: number;
  todayUnpaidActiveCustomersCount?: number;
  weekCollection: number;
  monthCollection: number;
}


export default function DailyDiaryDashboardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isQuickPaymentOpen, setIsQuickPaymentOpen] = useState(false);
  const [selectedLoanForPayment, setSelectedLoanForPayment] = useState<DailyDiaryLoan | null>(null);

  // New Customer Form State
  const [newCustomer, setNewCustomer] = useState({
    customerName: "",
    mobileNumber: "",
    referenceMobileNumbers: "",
    address: "",
    security: "",
    loanAmount: "",
    startDate: new Date().toISOString().slice(0, 10),
    expectedCompleteDate: "",
    collectionPlan: "100/day",
    notes: "",
    initialPaymentAmount: "",
  });

  // Quick Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    amountDeposited: "",
    paymentMode: "Cash",
    notes: "",
    allowAdminOverride: false,
  });

  // Fetch Dashboard Stats
  const { data: statsData, isLoading: isStatsLoading } = useQuery<{ success: boolean; stats: DashboardStats }>({
    queryKey: ["daily-diary-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/daily-diary/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard stats");
      return res.json();
    },
  });

  // Fetch Loans Directory
  const { data: loansData, isLoading: isLoansLoading } = useQuery<{ success: boolean; loans: DailyDiaryLoan[] }>({
    queryKey: ["daily-diary-loans", searchTerm, statusFilter, planFilter],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (searchTerm) queryParams.set("search", searchTerm);
      if (statusFilter !== "ALL") queryParams.set("status", statusFilter);
      if (planFilter !== "ALL") queryParams.set("plan", planFilter);

      const res = await fetch(`/api/daily-diary/loans?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch loans");
      return res.json();
    },
  });

  // Mutation: Create Customer Loan
  const createLoanMutation = useMutation({
    mutationFn: async (payload: typeof newCustomer) => {
      const res = await fetch("/api/daily-diary/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to create loan");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Loan Account Created", description: "Daily Diary customer loan added successfully!" });
      queryClient.invalidateQueries({ queryKey: ["daily-diary-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["daily-diary-loans"] });
      setIsAddCustomerOpen(false);
      setNewCustomer({
        customerName: "",
        mobileNumber: "",
        referenceMobileNumbers: "",
        address: "",
        security: "",
        loanAmount: "",
        startDate: new Date().toISOString().slice(0, 10),
        expectedCompleteDate: "",
        collectionPlan: "100/day",
        notes: "",
        initialPaymentAmount: "",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Mutation: Add Payment
  const addPaymentMutation = useMutation({
    mutationFn: async ({ loanId, payload }: { loanId: string; payload: typeof paymentForm }) => {
      const res = await fetch(`/api/daily-diary/loans/${loanId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.warning) {
          throw { isWarning: true, message: data.message, remainingAmount: data.remainingAmount };
        }
        throw new Error(data.error || "Failed to record payment");
      }
      return data;
    },
    onSuccess: () => {
      toast({ title: "Payment Recorded", description: "Deposit entry added to customer history!" });
      queryClient.invalidateQueries({ queryKey: ["daily-diary-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["daily-diary-loans"] });
      setIsQuickPaymentOpen(false);
      setSelectedLoanForPayment(null);
      setPaymentForm({
        paymentDate: new Date().toISOString().slice(0, 10),
        amountDeposited: "",
        paymentMode: "Cash",
        notes: "",
        allowAdminOverride: false,
      });
    },
    onError: (err: any) => {
      if (err.isWarning) {
        toast({
          title: "Admin Warning",
          description: `${err.message} Toggle 'Admin Override' to confirm.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: err.message || "Payment submission failed", variant: "destructive" });
      }
    },
  });

  // CSV Import Trigger
  const seedCsvMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/daily-diary/seed-csv", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "CSV import failed");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "CSV Imported Successfully!",
        description: `Imported ${data.stats.insertedCount} new accounts, updated ${data.stats.updatedCount} accounts.`,
      });
      queryClient.invalidateQueries({ queryKey: ["daily-diary-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["daily-diary-loans"] });
    },
    onError: (err: any) => {
      toast({ title: "CSV Seed Error", description: err.message, variant: "destructive" });
    },
  });

  const stats = statsData?.stats || {
    totalCustomers: 0,
    activeCustomers: 0,
    completedCustomers: 0,
    totalLoanAmount: 0,
    totalAmountCollected: 0,
    totalRemainingAmount: 0,
    todayCollection: 0,
    weekCollection: 0,
    monthCollection: 0,
  };

  const loans = loansData?.loans || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-6 rounded-2xl border border-emerald-500/20 text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Daily Diary <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">Daily Loan Collection</span>
              </h1>
              <p className="text-sm text-slate-300">
                Flexible loan recovery ledger with daily, weekly, and custom repayment tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
            onClick={() => seedCsvMutation.mutate()}
            disabled={seedCsvMutation.isPending}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-400" />
            {seedCsvMutation.isPending ? "Importing CSV..." : "Import CSV"}
          </Button>

          <Button
            variant="outline"
            className="bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
            onClick={() => setLocation("/daily-diary/reports")}
          >
            <FileText className="h-4 w-4 mr-2 text-blue-400" />
            Collection Reports
          </Button>

          <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 font-medium">
                <Plus className="h-4 w-4 mr-2" />
                Add Loan Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Users className="h-5 w-5 text-emerald-600" />
                  New Daily Diary Loan Account
                </DialogTitle>
                <DialogDescription>
                  Enter customer details, loan amount, and repayment plan. No fixed installments required.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3">
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label>Customer Name <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="e.g. Ramesh Saxena"
                    value={newCustomer.customerName}
                    onChange={(e) => setNewCustomer({ ...newCustomer, customerName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mobile Number <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="10-digit mobile"
                    value={newCustomer.mobileNumber}
                    onChange={(e) => setNewCustomer({ ...newCustomer, mobileNumber: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Reference Numbers (Optional)</Label>
                  <Input
                    placeholder="e.g. 9829012345, 9414012345"
                    value={newCustomer.referenceMobileNumbers}
                    onChange={(e) => setNewCustomer({ ...newCustomer, referenceMobileNumbers: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Loan Amount (₹) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    placeholder="e.g. 20000"
                    value={newCustomer.loanAmount}
                    onChange={(e) => setNewCustomer({ ...newCustomer, loanAmount: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Collection Plan</Label>
                  <Select
                    value={newCustomer.collectionPlan}
                    onValueChange={(val) => setNewCustomer({ ...newCustomer, collectionPlan: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100/day">100/day</SelectItem>
                      <SelectItem value="250/day">250/day</SelectItem>
                      <SelectItem value="500/day">500/day</SelectItem>
                      <SelectItem value="1400/week">1400/week</SelectItem>
                      <SelectItem value="3500/week">3500/week</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Start Date <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={newCustomer.startDate}
                    onChange={(e) => setNewCustomer({ ...newCustomer, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Expected Complete Date</Label>
                  <Input
                    type="date"
                    value={newCustomer.expectedCompleteDate}
                    onChange={(e) => setNewCustomer({ ...newCustomer, expectedCompleteDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label>Address</Label>
                  <Input
                    placeholder="Customer address or shop location"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Security / Guarantor</Label>
                  <Input
                    placeholder="Cheque / Property / Guarantor name"
                    value={newCustomer.security}
                    onChange={(e) => setNewCustomer({ ...newCustomer, security: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Initial Deposit (₹) (Optional)</Label>
                  <Input
                    type="number"
                    placeholder="First deposit if made immediately"
                    value={newCustomer.initialPaymentAmount}
                    onChange={(e) => setNewCustomer({ ...newCustomer, initialPaymentAmount: e.target.value })}
                  />
                </div>

                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label>Notes / Reason</Label>
                  <Input
                    placeholder="Special instructions or loan purpose"
                    value={newCustomer.notes}
                    onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddCustomerOpen(false)}>Cancel</Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={() => createLoanMutation.mutate(newCustomer)}
                  disabled={createLoanMutation.isPending}
                >
                  {createLoanMutation.isPending ? "Creating..." : "Save Loan Account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Daily Collection Live Tracker — Prominent Total Summary Section */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-2 border-emerald-500/30 rounded-2xl p-5 shadow-2xl space-y-4">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Today's Daily Collection Summary
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-normal">
                  Live Today Tracker
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Tracking today's target collection vs. actual received amount vs. uncollected pending balance.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
              Paid Today: {stats.todayPaidCustomersCount || 0} Customers
            </Badge>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">
              Unpaid Today: {stats.todayUnpaidActiveCustomersCount || 0} Customers
            </Badge>
          </div>
        </div>

        {/* 3 Main Daily Metrics Highlight Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Today's Target Collection */}
          <div className="bg-slate-900/90 border border-blue-500/30 rounded-xl p-4 flex items-center justify-between shadow-inner">
            <div>
              <span className="text-xs font-semibold uppercase text-blue-400 tracking-wider">Today's Expected Target</span>
              <span className="text-2xl font-black text-blue-400 block mt-1">
                ₹{(stats.todayTargetCollection || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Expected recovery for today</span>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <Calendar className="h-6 w-6" />
            </div>
          </div>

          {/* Today's Actual Collected */}
          <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between shadow-inner">
            <div>
              <span className="text-xs font-semibold uppercase text-emerald-400 tracking-wider">Today's Total Collected</span>
              <span className="text-2xl font-black text-emerald-400 block mt-1">
                ₹{(stats.todayCollection || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-emerald-300/80 mt-1 block font-medium">✓ Received in ledger today</span>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>

          {/* Today's Pending / Uncollected */}
          <div className="bg-slate-900/90 border border-rose-500/40 rounded-xl p-4 flex items-center justify-between shadow-inner">
            <div>
              <span className="text-xs font-semibold uppercase text-rose-400 tracking-wider">Today's Pending / Uncollected</span>
              <span className="text-2xl font-black text-rose-400 block mt-1">
                ₹{(stats.todayPendingCollection || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-rose-300/80 mt-1 block font-medium">⚠️ Remaining due for today</span>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
              <AlertCircle className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Progress Bar for Today's Target Recovery */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-medium flex items-center gap-1.5">
              <span>Today's Recovery Rate</span>
              <span className="text-emerald-400 font-bold">{stats.todayAchievementPct || 0}% Achieved</span>
            </span>
            <span className="text-slate-400">
              Collected ₹{(stats.todayCollection || 0).toLocaleString('en-IN')} of ₹{(stats.todayTargetCollection || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <Progress value={stats.todayAchievementPct || 0} className="h-3 bg-slate-950 border border-slate-800" />
        </div>
      </div>

      {/* Dashboard KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/60 text-white shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Customers</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-white">{stats.totalCustomers}</span>
                <span className="text-xs text-emerald-400 font-medium">Active: {stats.activeCustomers}</span>
              </div>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/60 text-white shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Loan Amount</p>
              <span className="text-2xl font-bold text-amber-400 mt-1 block">
                ₹{stats.totalLoanAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/60 text-white shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Collected</p>
              <span className="text-2xl font-bold text-emerald-400 mt-1 block">
                ₹{stats.totalAmountCollected.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/60 text-white shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Remaining Balance</p>
              <span className="text-2xl font-bold text-rose-400 mt-1 block">
                ₹{stats.totalRemainingAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collection Period Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Today's Collection</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">₹{stats.todayCollection.toLocaleString('en-IN')}</p>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Today</Badge>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">This Week Collection</p>
            <p className="text-xl font-bold text-blue-400 mt-0.5">₹{stats.weekCollection.toLocaleString('en-IN')}</p>
          </div>
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Last 7 Days</Badge>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">This Month Collection</p>
            <p className="text-xl font-bold text-purple-400 mt-0.5">₹{stats.monthCollection.toLocaleString('en-IN')}</p>
          </div>
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">This Month</Badge>
        </div>
      </div>

      {/* Controls & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search Name, Mobile, Reference No..."
            className="pl-9 bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">Filter:</span>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] bg-slate-950 border-slate-800 text-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[150px] bg-slate-950 border-slate-800 text-slate-200">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Plans</SelectItem>
              <SelectItem value="100/day">100/day</SelectItem>
              <SelectItem value="250/day">250/day</SelectItem>
              <SelectItem value="500/day">500/day</SelectItem>
              <SelectItem value="1400/week">1400/week</SelectItem>
              <SelectItem value="3500/week">3500/week</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Customer Directory Cards */}
      {isLoansLoading ? (
        <div className="text-center py-12 text-slate-400">Loading Daily Diary loans...</div>
      ) : loans.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400">
          <BookOpen className="h-10 w-10 mx-auto mb-2 text-slate-600" />
          <p className="text-base font-medium">No Daily Diary loan accounts found.</p>
          <p className="text-xs text-slate-500 mt-1">Add a new customer account or click "Import CSV" to populate records.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loans.map((loan) => (
            <Card
              key={loan.id}
              className={`bg-slate-900/90 border transition-all duration-200 hover:border-slate-700 shadow-md ${
                loan.status === "COMPLETED" ? "border-slate-800 opacity-90" : "border-slate-800"
              }`}
            >
              <CardContent className="p-5 space-y-4">
                {/* Title & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-base text-white hover:text-emerald-400 transition-colors">
                      <Link href={`/daily-diary/${loan.id}`} className="flex items-center gap-1.5">
                        {loan.customerName}
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                      </Link>
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <Phone className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{loan.mobileNumber}</span>
                    </div>
                  </div>

                  <Badge
                    className={
                      loan.status === "COMPLETED"
                        ? "bg-slate-800 text-slate-300 border-slate-700"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    }
                  >
                    {loan.status}
                  </Badge>
                </div>

                {/* Info Pills */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">Loan Amount</span>
                    <span className="font-bold text-amber-400">₹{loan.loanAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">Collection Plan</span>
                    <span className="font-semibold text-emerald-400">{loan.collectionPlan}</span>
                  </div>
                </div>

                {/* Progress Bar & Repayment Stats */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Collected: <strong className="text-emerald-400">₹{loan.totalCollected.toLocaleString('en-IN')}</strong>
                    </span>
                    <span className="text-slate-400">
                      Remaining: <strong className="text-rose-400">₹{loan.remainingAmount.toLocaleString('en-IN')}</strong>
                    </span>
                  </div>
                  <Progress value={loan.completionPct} className="h-2 bg-slate-950" />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span>{loan.completionPct}% Completed</span>
                    <span>Last Payment: {loan.lastPaymentDate || "-"}</span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white text-xs"
                    onClick={() => setLocation(`/daily-diary/${loan.id}`)}
                  >
                    Profile & History
                  </Button>

                  {loan.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3"
                      onClick={() => {
                        setSelectedLoanForPayment(loan);
                        setPaymentForm({
                          paymentDate: new Date().toISOString().slice(0, 10),
                          amountDeposited: "",
                          paymentMode: "Cash",
                          notes: "",
                          allowAdminOverride: false,
                        });
                        setIsQuickPaymentOpen(true);
                      }}
                    >
                      + Payment
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Add Payment Modal */}
      <Dialog open={isQuickPaymentOpen} onOpenChange={setIsQuickPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Add Payment — {selectedLoanForPayment?.customerName}
            </DialogTitle>
            <DialogDescription>
              Record deposit for loan balance of ₹{selectedLoanForPayment?.remainingAmount.toLocaleString('en-IN')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Amount Deposited (₹) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                placeholder="e.g. 500"
                value={paymentForm.amountDeposited}
                onChange={(e) => setPaymentForm({ ...paymentForm, amountDeposited: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select
                value={paymentForm.paymentMode}
                onValueChange={(val) => setPaymentForm({ ...paymentForm, paymentMode: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Bank">Bank Transfer</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes / Reference</Label>
              <Input
                placeholder="e.g. UPI Ref # or Agent Collector note"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="adminOverrideCheck"
                checked={paymentForm.allowAdminOverride}
                onChange={(e) => setPaymentForm({ ...paymentForm, allowAdminOverride: e.target.checked })}
                className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
              />
              <Label htmlFor="adminOverrideCheck" className="text-xs text-slate-300 cursor-pointer">
                Allow Admin Override (if payment exceeds remaining loan balance)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickPaymentOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={() => {
                if (selectedLoanForPayment) {
                  addPaymentMutation.mutate({
                    loanId: selectedLoanForPayment.id,
                    payload: paymentForm,
                  });
                }
              }}
              disabled={addPaymentMutation.isPending}
            >
              {addPaymentMutation.isPending ? "Saving..." : "Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
