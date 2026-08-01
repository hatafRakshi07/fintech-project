'use client';

import React, { useState } from "react";
import { useParams, useLocation, Link } from "@/lib/router-adapter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  UserCircle,
  Phone,
  MapPin,
  Shield,
  Calendar,
  CreditCard,
  Plus,
  Clock,
  CheckCircle2,
  Lock,
  FileSpreadsheet,
  FileText,
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
import { useRole } from "@/hooks/use-role";

interface PaymentEntry {
  id: string;
  paymentDate: string;
  amountDeposited: number;
  paymentMode: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  runningRemainingBalance?: number;
}


interface LoanDetail {
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
  payments: PaymentEntry[];
}

export default function DailyDiaryDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { role } = useRole();
  const queryClient = useQueryClient();

  const loanId = params?.id;


  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  const isAdmin = ["super_admin", "owner", "branch_manager"].includes(role || "");

  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    amountDeposited: "",
    paymentMode: "Cash",
    notes: "",
    allowAdminOverride: false,
  });

  const [editProfileForm, setEditProfileForm] = useState({
    customerName: "",
    mobileNumber: "",
    referenceMobileNumbers: "",
    address: "",
    security: "",
    expectedCompleteDate: "",
    collectionPlan: "100/day",
    notes: "",
  });

  // Fetch Loan Details + Payment History
  const { data, isLoading, error } = useQuery<{ success: boolean; loan: LoanDetail }>({
    queryKey: ["daily-diary-loan-detail", loanId],
    queryFn: async () => {
      const res = await fetch(`/api/daily-diary/loans/${loanId}`);
      if (!res.ok) throw new Error("Failed to fetch customer loan profile");
      return res.json();
    },
    enabled: Boolean(loanId),
  });

  const loan = data?.loan;

  // Sync edit profile form state
  React.useEffect(() => {
    if (loan) {
      setEditProfileForm({
        customerName: loan.customerName,
        mobileNumber: loan.mobileNumber,
        referenceMobileNumbers: loan.referenceMobileNumbers,
        address: loan.address,
        security: loan.security,
        expectedCompleteDate: loan.expectedCompleteDate,
        collectionPlan: loan.collectionPlan,
        notes: loan.notes,
      });
    }
  }, [loan]);

  // Mutation: Add Payment
  const addPaymentMutation = useMutation({
    mutationFn: async (payload: typeof paymentForm) => {
      const res = await fetch(`/api/daily-diary/loans/${loanId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      if (!res.ok) {
        if (resData.warning) {
          throw { isWarning: true, message: resData.message };
        }
        throw new Error(resData.error || "Failed to record payment");
      }
      return resData;
    },
    onSuccess: () => {
      toast({ title: "Payment Recorded", description: "Payment added to permanent history ledger!" });
      queryClient.invalidateQueries({ queryKey: ["daily-diary-loan-detail", loanId] });
      queryClient.invalidateQueries({ queryKey: ["daily-diary-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["daily-diary-loans"] });
      setIsAddPaymentOpen(false);
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
          title: "Admin Override Needed",
          description: `${err.message} Toggle 'Allow Admin Override' to proceed.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Payment Failed", description: err.message, variant: "destructive" });
      }
    },
  });

  // Mutation: Update Profile
  const updateProfileMutation = useMutation({
    mutationFn: async (payload: typeof editProfileForm) => {
      const res = await fetch(`/api/daily-diary/loans/${loanId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) throw new Error(resData.error || "Failed to update profile");
      return resData;
    },
    onSuccess: () => {
      toast({ title: "Profile Updated", description: "Customer details updated successfully!" });
      queryClient.invalidateQueries({ queryKey: ["daily-diary-loan-detail", loanId] });
      setIsEditProfileOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400 text-sm animate-pulse">Loading Customer Profile & Ledger...</div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-300">
        <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
        <p className="font-semibold text-lg">Loan Account Not Found</p>
        <Button className="mt-4" onClick={() => setLocation("/daily-diary")}>Back to Dashboard</Button>
      </div>
    );
  }

  const isCompleted = loan.status === "COMPLETED";

  return (
    <div className="space-y-6 pb-12">
      {/* Top Nav Back button */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
          onClick={() => setLocation("/daily-diary")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Daily Diary Directory
        </Button>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => setIsEditProfileOpen(true)}
            >
              Edit Details
            </Button>
          )}

          {!isCompleted ? (
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg font-medium"
              onClick={() => setIsAddPaymentOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Payment
            </Button>
          ) : (
            <Badge className="bg-slate-800 text-slate-300 border-slate-700 px-3 py-1 text-xs">
              <Lock className="h-3.5 w-3.5 mr-1" />
              Loan Completed (Read-Only)
            </Badge>
          )}
        </div>
      </div>

      {/* Customer Header Summary Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <UserCircle className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  {loan.customerName}
                  <Badge
                    className={
                      isCompleted
                        ? "bg-slate-800 text-slate-300 border-slate-700"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    }
                  >
                    {loan.status}
                  </Badge>
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-1">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-emerald-400" />
                    {loan.mobileNumber}
                  </span>

                  {loan.referenceMobileNumbers && (
                    <span className="flex items-center gap-1 text-slate-400">
                      Ref: {loan.referenceMobileNumbers}
                    </span>
                  )}

                  {loan.address && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin className="h-3.5 w-3.5 text-amber-400" />
                      {loan.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {loan.security && (
              <div className="text-xs text-slate-400 pt-1 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-blue-400" />
                <span>Security / Guarantor: <strong className="text-slate-200">{loan.security}</strong></span>
              </div>
            )}
          </div>

          {/* Quick Repayment Progress */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 min-w-[280px]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Repayment Progress</span>
              <span className="font-bold text-emerald-400">{loan.completionPct}%</span>
            </div>
            <Progress value={loan.completionPct} className="h-2.5 bg-slate-900" />
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Start: {loan.startDate}</span>
              <span>Complete: {loan.expectedCompleteDate || "Flexible"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Daily Collection & Account Total Summary Banner */}
      {(() => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayPayments = loan.payments.filter(
          (p) => p.paymentDate === todayStr || (p.createdAt && p.createdAt.slice(0, 10) === todayStr)
        );
        const todayPaidAmount = todayPayments.reduce((acc, p) => acc + p.amountDeposited, 0);
        const hasPaidToday = todayPaidAmount > 0;

        return (
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-2 border-emerald-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Account Collection Summary — {loan.customerName}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Live daily status and total recovery ledger overview.
                  </p>
                </div>
              </div>

              <div>
                {isCompleted ? (
                  <Badge className="bg-slate-800 text-slate-300 border-slate-700">
                    ✓ Account Fully Completed
                  </Badge>
                ) : hasPaidToday ? (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-3 py-1">
                    ✓ Paid Today: ₹{todayPaidAmount.toLocaleString('en-IN')}
                  </Badge>
                ) : (
                  <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs px-3 py-1 animate-pulse">
                    ⚠️ Payment Due Today (Plan: {loan.collectionPlan})
                  </Badge>
                )}
              </div>
            </div>

            {/* 3 Main Account Financial Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase text-amber-400 tracking-wider">Total Loan Amount</span>
                  <span className="text-2xl font-black text-amber-400 block mt-1">
                    ₹{loan.loanAmount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 block">Plan: {loan.collectionPlan}</span>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                  <CreditCard className="h-6 w-6" />
                </div>
              </div>

              <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase text-emerald-400 tracking-wider">Total Amount Collected</span>
                  <span className="text-2xl font-black text-emerald-400 block mt-1">
                    ₹{loan.totalCollected.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-emerald-300/80 mt-1 block font-medium">
                    ✓ {loan.totalPaymentsCount} Deposits Logged
                  </span>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <Clock className="h-6 w-6" />
                </div>
              </div>

              <div className="bg-slate-900/90 border border-rose-500/40 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase text-rose-400 tracking-wider">Remaining Balance</span>
                  <span className="text-2xl font-black text-rose-400 block mt-1">
                    ₹{loan.remainingAmount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-rose-300/80 mt-1 block font-medium">
                    {loan.completionPct}% Recovered So Far
                  </span>
                </div>
                <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
                  <AlertCircle className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Financial Overview Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs text-slate-400 font-medium uppercase">Total Loan Amount</span>
            <span className="text-2xl font-bold text-amber-400 block mt-1">
              ₹{loan.loanAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">Plan: {loan.collectionPlan}</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs text-slate-400 font-medium uppercase">Total Amount Collected</span>
            <span className="text-2xl font-bold text-emerald-400 block mt-1">
              ₹{loan.totalCollected.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">{loan.totalPaymentsCount} Payments Made</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs text-slate-400 font-medium uppercase">Remaining Loan Amount</span>
            <span className="text-2xl font-bold text-rose-400 block mt-1">
              ₹{loan.remainingAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">Last Paid: {loan.lastPaymentDate}</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs text-slate-400 font-medium uppercase">Completion Status</span>
            <span className="text-2xl font-bold text-purple-400 block mt-1">
              {loan.completionPct}%
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {isCompleted ? "Fully Recovered" : "Active Repayments"}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Payment History Ledger Table */}
      <Card className="bg-slate-900 border-slate-800 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-400" />
              Complete Payment History Ledger
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Permanent immutable payment log. Latest payments displayed first.
            </CardDescription>
          </div>

          {!isCompleted && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs"
              onClick={() => setIsAddPaymentOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Deposit Entry
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {loan.payments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No payments recorded yet for this customer loan account.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Amount Deposited</th>
                    <th className="px-5 py-3">Remaining Balance After Deposit</th>
                    <th className="px-5 py-3">Payment Mode</th>
                    <th className="px-5 py-3">Notes / Reference</th>
                    <th className="px-5 py-3">Recorded By</th>
                    <th className="px-5 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {loan.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-100">{p.paymentDate}</td>
                      <td className="px-5 py-3.5 font-bold text-emerald-400">
                        +₹{p.amountDeposited.toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-amber-400">
                        ₹{(p.runningRemainingBalance ?? Math.max(0, loan.loanAmount - p.amountDeposited)).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className="bg-slate-950 border-slate-800 text-slate-300 text-xs">
                          {p.paymentMode}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">{p.notes || "-"}</td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">{p.createdBy}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">
                        {p.createdAt ? new Date(p.createdAt).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Ledger Footer Summary */}
                <tfoot className="bg-slate-950 font-bold border-t-2 border-slate-800 text-slate-100">
                  <tr>
                    <td className="px-5 py-4 text-slate-300">TOTAL COLLECTED</td>
                    <td className="px-5 py-4 text-emerald-400 text-base">
                      ₹{loan.totalCollected.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-rose-400 text-base font-black">
                      REMAINING: ₹{loan.remainingAmount.toLocaleString('en-IN')}
                    </td>
                    <td colSpan={2} className="px-5 py-4 text-slate-400">
                      Loan Amount: ₹{loan.loanAmount.toLocaleString('en-IN')}
                    </td>
                    <td colSpan={2} className="px-5 py-4 text-right text-purple-400">
                      COMPLETION: {loan.completionPct}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Add Payment */}
      <Dialog open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Add Deposit Entry — {loan.customerName}
            </DialogTitle>
            <DialogDescription>
              Enter amount deposited. Balance automatically subtracts after saving.
            </DialogDescription>
          </DialogHeader>

          {/* Dynamic Live Subtraction Calculator Preview Box */}
          {(() => {
            const enteredAmt = parseFloat(paymentForm.amountDeposited) || 0;
            const newRemaining = Math.max(0, loan.remainingAmount - enteredAmt);
            return (
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Current Remaining Loan Balance:</span>
                  <span className="font-semibold text-slate-200">₹{loan.remainingAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-400 font-medium">
                  <span>Minus Today Deposit Entry:</span>
                  <span>- ₹{enteredAmt.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-amber-400 font-bold border-t border-slate-800 pt-2 text-sm">
                  <span>New Remaining Loan Balance:</span>
                  <span className="text-base font-black text-rose-400">₹{newRemaining.toLocaleString('en-IN')}</span>
                </div>
              </div>
            );
          })()}

          <div className="space-y-4 py-2">

            <div className="space-y-2">
              <Label>Payment Date <span className="text-red-500">*</span></Label>
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
              <Label>Notes / Collector Reference</Label>
              <Input
                placeholder="e.g. UPI Ref # or Agent collection note"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="adminOverrideCheckProfile"
                checked={paymentForm.allowAdminOverride}
                onChange={(e) => setPaymentForm({ ...paymentForm, allowAdminOverride: e.target.checked })}
                className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
              />
              <Label htmlFor="adminOverrideCheckProfile" className="text-xs text-slate-300 cursor-pointer">
                Allow Admin Override (if payment exceeds remaining loan balance)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPaymentOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={() => addPaymentMutation.mutate(paymentForm)}
              disabled={addPaymentMutation.isPending}
            >
              {addPaymentMutation.isPending ? "Saving..." : "Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Edit Customer Profile */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-emerald-500" />
              Edit Customer Profile
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                value={editProfileForm.customerName}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, customerName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Input
                  value={editProfileForm.mobileNumber}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, mobileNumber: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Reference Numbers</Label>
                <Input
                  value={editProfileForm.referenceMobileNumbers}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, referenceMobileNumbers: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={editProfileForm.address}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Security / Guarantor</Label>
                <Input
                  value={editProfileForm.security}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, security: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Collection Plan</Label>
                <Input
                  value={editProfileForm.collectionPlan}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, collectionPlan: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes / Reason</Label>
              <Input
                value={editProfileForm.notes}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditProfileOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={() => updateProfileMutation.mutate(editProfileForm)}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? "Updating..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
