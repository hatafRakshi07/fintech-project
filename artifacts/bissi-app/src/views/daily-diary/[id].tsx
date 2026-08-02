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
    collectionPlan: "500/day",
    startDate: "",
    expectedCompleteDate: "",
    notes: "",
  });

  // Query: Loan Customer Detail
  const { data: loanData, isLoading, error } = useQuery<{ loan: LoanDetail }>({
    queryKey: ["daily-diary-loan-detail", loanId],
    queryFn: async () => {
      if (!loanId) throw new Error("Loan ID missing");
      const res = await fetch(`/api/daily-diary/loans/${loanId}`);
      if (!res.ok) throw new Error("Failed to fetch customer profile");
      return res.json();
    },
    enabled: !!loanId,
  });

  const loan = loanData?.loan;

  // Initialize edit form when loan is loaded
  React.useEffect(() => {
    if (loan) {
      setEditProfileForm({
        customerName: loan.customerName || "",
        mobileNumber: loan.mobileNumber || "",
        referenceMobileNumbers: loan.referenceMobileNumbers || "",
        address: loan.address || "",
        security: loan.security || "",
        collectionPlan: loan.collectionPlan || "500/day",
        startDate: loan.startDate || "",
        expectedCompleteDate: loan.expectedCompleteDate || "",
        notes: loan.notes || "",
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
          title: "Admin Warning",
          description: `${err.message} Check 'Allow Admin Override' to proceed.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: err.message || "Payment failed", variant: "destructive" });
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
        <div className="text-muted-foreground text-sm animate-pulse">Loading Customer Profile & Ledger...</div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <Card className="p-8 border border-border text-center text-foreground max-w-md mx-auto my-12">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
        <h3 className="font-bold text-lg">Loan Account Not Found</h3>
        <p className="text-sm text-muted-foreground mt-1">The requested Daily Diary loan profile could not be found.</p>
        <Button className="mt-4" onClick={() => setLocation("/daily-diary")}>Back to Directory</Button>
      </Card>
    );
  }

  const isCompleted = loan.status === "COMPLETED";

  return (
    <div className="space-y-6 pb-12">
      {/* Top Nav Back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button
          variant="outline"
          className="border-border text-foreground hover:bg-muted self-start"
          onClick={() => setLocation("/daily-diary")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Daily Diary Directory
        </Button>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-muted"
              onClick={() => setIsEditProfileOpen(true)}
            >
              Edit Profile Details
            </Button>
          )}

          {!isCompleted ? (
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm font-medium"
              onClick={() => setIsAddPaymentOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Deposit
            </Button>
          ) : (
            <Badge variant="outline" className="bg-muted text-muted-foreground border-border px-3 py-1 text-xs">
              <Lock className="h-3.5 w-3.5 mr-1" />
              Loan Completed (Read-Only)
            </Badge>
          )}
        </div>
      </div>

      {/* Customer Header Summary Card — Matches SKA Brand */}
      <Card className="bg-card border border-border/80 p-6 rounded-2xl shadow-sm text-card-foreground">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600">
                <UserCircle className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                  {loan.customerName}
                  <Badge
                    variant="outline"
                    className={
                      isCompleted
                        ? "bg-muted text-muted-foreground border-border"
                        : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                    }
                  >
                    {loan.status}
                  </Badge>
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                    {loan.mobileNumber}
                  </span>

                  {loan.referenceMobileNumbers && (
                    <span className="flex items-center gap-1">
                      Ref: {loan.referenceMobileNumbers}
                    </span>
                  )}

                  {loan.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-amber-600" />
                      {loan.address}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-muted/40 p-3 rounded-xl border border-border/60">
              <span className="text-[11px] text-muted-foreground font-medium uppercase block">Total Loan</span>
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400">₹{loan.loanAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-muted/40 p-3 rounded-xl border border-border/60">
              <span className="text-[11px] text-muted-foreground font-medium uppercase block">Total Collected</span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">₹{loan.totalCollected.toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-muted/40 p-3 rounded-xl border border-border/60 col-span-2 sm:col-span-1">
              <span className="text-[11px] text-muted-foreground font-medium uppercase block">Remaining Balance</span>
              <span className="text-lg font-bold text-rose-600 dark:text-rose-400">₹{loan.remainingAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Repayment Progress bar */}
        <div className="mt-6 pt-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Repayment Completion</span>
            <span className="font-semibold text-foreground">
              {loan.completionPct}% Completed ({loan.totalPaymentsCount} Payments)
            </span>
          </div>
          <Progress value={loan.completionPct} className="h-2.5" />
        </div>
      </Card>

      {/* Profile Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border border-border shadow-sm p-4">
          <span className="text-xs text-muted-foreground font-medium uppercase">Collection Plan</span>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{loan.collectionPlan}</p>
          <span className="text-[11px] text-muted-foreground mt-1 block">Flexible daily/weekly deposits</span>
        </Card>

        <Card className="bg-card border border-border shadow-sm p-4">
          <span className="text-xs text-muted-foreground font-medium uppercase">Security / Guarantor</span>
          <p className="text-base font-semibold text-foreground mt-1 truncate">{loan.security || "None specified"}</p>
          <span className="text-[11px] text-muted-foreground mt-1 block">Security collateral on record</span>
        </Card>

        <Card className="bg-card border border-border shadow-sm p-4">
          <span className="text-xs text-muted-foreground font-medium uppercase">Loan Dates</span>
          <p className="text-sm font-medium text-foreground mt-1">Start: {loan.startDate || "-"}</p>
          <span className="text-[11px] text-muted-foreground block">Expected End: {loan.expectedCompleteDate || "-"}</span>
        </Card>
      </div>

      {/* Payment History Ledger Table */}
      <Card className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-amber-600" />
                Payment Ledger & Deposit History
              </CardTitle>
              <CardDescription>
                Chronological list of all daily deposits recorded for this loan.
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-xs px-3 py-1">
              {loan.payments?.length || 0} Deposit Entries
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {!loan.payments || loan.payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm font-medium">No payment deposits recorded yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Add Payment Deposit" above to record the first payment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/40 uppercase border-b border-border font-semibold">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Amount Deposited</th>
                    <th className="px-5 py-3">Remaining Balance After Payment</th>
                    <th className="px-5 py-3">Mode</th>
                    <th className="px-5 py-3">Notes</th>
                    <th className="px-5 py-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loan.payments.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-muted-foreground">{loan.payments.length - idx}</td>
                      <td className="px-5 py-3.5 font-semibold text-foreground">{p.paymentDate}</td>
                      <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                        + ₹{p.amountDeposited.toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-foreground">
                        {p.runningRemainingBalance !== undefined ? `₹${p.runningRemainingBalance.toLocaleString('en-IN')}` : "-"}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className="bg-background border-border text-foreground font-normal">
                          {p.paymentMode}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground max-w-xs truncate">{p.notes || "-"}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{p.createdBy || "System"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Modal */}
      <Dialog open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              Add Payment Deposit — {loan.customerName}
            </DialogTitle>
            <DialogDescription>
              Current Remaining Balance: <strong className="text-rose-600">₹{loan.remainingAmount.toLocaleString('en-IN')}</strong>
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
                id="adminOverrideCheckDetail"
                checked={paymentForm.allowAdminOverride}
                onChange={(e) => setPaymentForm({ ...paymentForm, allowAdminOverride: e.target.checked })}
                className="rounded border-input text-emerald-600 focus:ring-emerald-500"
              />
              <Label htmlFor="adminOverrideCheckDetail" className="text-xs text-muted-foreground cursor-pointer">
                Allow Admin Override (if payment exceeds remaining balance)
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

      {/* Edit Profile Details Modal */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer Loan Details</DialogTitle>
            <DialogDescription>
              Update contact info, collection plan, or security collateral for {loan.customerName}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3">
            <div className="space-y-2 col-span-1 md:col-span-2">
              <Label>Customer Name</Label>
              <Input
                value={editProfileForm.customerName}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, customerName: e.target.value })}
              />
            </div>

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

            <div className="space-y-2 col-span-1 md:col-span-2">
              <Label>Address</Label>
              <Input
                value={editProfileForm.address}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Security / Guarantor</Label>
              <Input
                value={editProfileForm.security}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, security: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Collection Plan</Label>
              <Select
                value={editProfileForm.collectionPlan}
                onValueChange={(val) => setEditProfileForm({ ...editProfileForm, collectionPlan: val })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="100/day">100/day</SelectItem>
                  <SelectItem value="250/day">250/day</SelectItem>
                  <SelectItem value="500/day">500/day</SelectItem>
                  <SelectItem value="1000/day">1000/day</SelectItem>
                  <SelectItem value="1400/week">1400/week</SelectItem>
                  <SelectItem value="3500/week">3500/week</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={editProfileForm.startDate}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Expected Completion Date</Label>
              <Input
                type="date"
                value={editProfileForm.expectedCompleteDate}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, expectedCompleteDate: e.target.value })}
              />
            </div>

            <div className="space-y-2 col-span-1 md:col-span-2">
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
              className="bg-primary text-primary-foreground"
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
