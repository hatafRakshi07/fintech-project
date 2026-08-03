import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
import Header from "@/components/Header";
import {
  BookOpen,
  Search,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle2,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Filter,
  RefreshCw,
  Wallet,
  AlertCircle,
  FileText,
  User,
  X
} from "lucide-react";

interface OtherDuesInfo {
  bissiCommittees: Array<{ committeeName: string; tokenNumber: string; monthlyAmount: number }>;
  otherDailyLoans: Array<{ id: string; customerName: string; remainingAmount: number }>;
  totalOtherDuesCount: number;
}

interface DailyLoan {
  id: string;
  customerName: string;
  mobileNumber: string;
  referenceMobileNumbers?: string;
  address?: string;
  security?: string;
  loanAmount: number;
  startDate: string;
  expectedCompleteDate?: string;
  collectionPlan: string;
  notes?: string;
  status: "ACTIVE" | "COMPLETED" | "DEFAULTED";
  totalCollected: number;
  remainingAmount: number;
  completionPct: number;
  lastPaymentDate: string;
  otherDues?: OtherDuesInfo;
}

interface DashboardStats {
  todayTargetCollection: number;
  todayCollection: number;
  todayPendingCollection: number;
  todayAchievementPct: number;
  todayPaidCustomersCount: number;
  todayUnpaidActiveCustomersCount: number;
}

export default function DailyDiaryCollectorPage() {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "PENDING" | "PAID">("ALL");
  const [selectedLoan, setSelectedLoan] = useState<DailyLoan | null>(null);
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [selectedLoanLedger, setSelectedLoanLedger] = useState<any | null>(null);

  // Form State
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    amountDeposited: "",
    paymentMode: "Cash",
    notes: "",
  });

  const [toastMsg, setToastMsg] = useState<{ title: string; desc: string; type: "success" | "error" } | null>(null);

  const showToast = (title: string, desc: string, type: "success" | "error" = "success") => {
    setToastMsg({ title, desc, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Fetch Dashboard Stats
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery<{ success: boolean; stats: DashboardStats }>({
    queryKey: ["daily-diary-collector-dashboard"],
    queryFn: () => api.get("/daily-diary/dashboard"),
    refetchInterval: 15_000,
  });

  // Fetch Active Loans
  const { data: loansData, isLoading: isLoansLoading, refetch: refetchLoans } = useQuery<{ success: boolean; loans: DailyLoan[] }>({
    queryKey: ["daily-diary-collector-loans"],
    queryFn: () => api.get("/daily-diary/loans?status=ACTIVE"),
    refetchInterval: 15_000,
  });

  // Fetch Loan Detail / Ledger when viewing ledger
  const { data: loanDetailData } = useQuery<{ success: boolean; loan: any }>({
    queryKey: ["daily-diary-loan-detail", selectedLoanLedger?.id],
    queryFn: () => api.get(`/daily-diary/loans/${selectedLoanLedger?.id}`),
    enabled: Boolean(selectedLoanLedger?.id),
  });

  // Add Payment Mutation
  const addPaymentMutation = useMutation({
    mutationFn: async ({ loanId, payload }: { loanId: string; payload: typeof paymentForm }) => {
      const res = await api.post(`/daily-diary/loans/${loanId}/payments`, payload);
      return res;
    },
    onSuccess: () => {
      showToast("Deposit Saved!", `Payment recorded for ${selectedLoan?.customerName}. Loan balance updated.`);
      queryClient.invalidateQueries({ queryKey: ["daily-diary-collector-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["daily-diary-collector-loans"] });
      queryClient.invalidateQueries({ queryKey: ["daily-diary-loan-detail", selectedLoan?.id] });
      setIsCollectModalOpen(false);
      setSelectedLoan(null);
      setPaymentForm({
        paymentDate: new Date().toISOString().slice(0, 10),
        amountDeposited: "",
        paymentMode: "Cash",
        notes: "",
      });
    },
    onError: (err: any) => {
      showToast("Payment Error", err?.message || "Failed to record deposit entry", "error");
    },
  });

  const stats = dashboardData?.stats || {
    todayTargetCollection: 0,
    todayCollection: 0,
    todayPendingCollection: 0,
    todayAchievementPct: 0,
    todayPaidCustomersCount: 0,
    todayUnpaidActiveCustomersCount: 0,
  };

  const loans = loansData?.loans || [];
  const todayStr = new Date().toISOString().slice(0, 10);

  const filteredLoans = loans.filter((l) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        l.customerName.toLowerCase().includes(term) ||
        l.mobileNumber.toLowerCase().includes(term) ||
        (l.address && l.address.toLowerCase().includes(term));
      if (!matchesSearch) return false;
    }

    const isPaidToday = l.lastPaymentDate && (l.lastPaymentDate === todayStr || l.lastPaymentDate.includes(new Date().getDate().toString()));

    if (filterTab === "PENDING") {
      return !isPaidToday && l.remainingAmount > 0;
    }
    if (filterTab === "PAID") {
      return isPaidToday;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top App Bar Header */}
      <Header title="Daily Diary Loan Collection" />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-16 left-4 right-4 z-50 p-4 rounded-xl shadow-2xl border flex items-start justify-between ${
            toastMsg.type === "success"
              ? "bg-emerald-950 border-emerald-500/50 text-emerald-100"
              : "bg-rose-950 border-rose-500/50 text-rose-100"
          }`}
        >
          <div>
            <h4 className="font-bold text-sm">{toastMsg.title}</h4>
            <p className="text-xs mt-0.5 opacity-90">{toastMsg.desc}</p>
          </div>
          <button onClick={() => setToastMsg(null)} className="p-1 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Today Live Recovery Tracker Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/30 p-4 rounded-2xl shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Daily Recovery Tracker</h3>
                <p className="text-[11px] text-slate-300">Live Collection Status</p>
              </div>
            </div>
            <button
              onClick={() => refetchLoans()}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div
              onClick={() => setFilterTab("ALL")}
              className={`p-2.5 rounded-xl cursor-pointer transition-all ${
                filterTab === "ALL" ? "bg-amber-500/20 border-2 border-amber-400" : "bg-slate-950/70 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <span className="text-[10px] text-slate-400 font-medium uppercase block">Today Target</span>
              <span className="text-sm font-black text-amber-400 block mt-0.5">
                ₹{stats.todayTargetCollection.toLocaleString("en-IN")}
              </span>
            </div>

            <div
              onClick={() => setFilterTab("PAID")}
              className={`p-2.5 rounded-xl cursor-pointer transition-all ${
                filterTab === "PAID" ? "bg-emerald-500/20 border-2 border-emerald-400" : "bg-slate-950/70 border border-emerald-500/30 hover:border-emerald-400/60"
              }`}
            >
              <span className="text-[10px] text-emerald-400 font-medium uppercase block">Collected</span>
              <span className="text-sm font-black text-emerald-400 block mt-0.5">
                ₹{stats.todayCollection.toLocaleString("en-IN")}
              </span>
            </div>

            <div
              onClick={() => setFilterTab("PENDING")}
              className={`p-2.5 rounded-xl cursor-pointer transition-all ${
                filterTab === "PENDING" ? "bg-rose-500/20 border-2 border-rose-400" : "bg-slate-950/70 border border-rose-500/30 hover:border-rose-400/60"
              }`}
            >
              <span className="text-[10px] text-rose-400 font-medium uppercase block">Pending</span>
              <span className="text-sm font-black text-rose-400 block mt-0.5">
                ₹{stats.todayPendingCollection.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs text-slate-300 font-semibold">
              <span>Today's Target Recovered</span>
              <span className="text-emerald-400">{stats.todayAchievementPct}%</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, stats.todayAchievementPct)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
              <span className="cursor-pointer hover:underline" onClick={() => setFilterTab("PAID")}>
                Paid: <strong className="text-emerald-400">{stats.todayPaidCustomersCount} Customers</strong>
              </span>
              <span className="cursor-pointer hover:underline" onClick={() => setFilterTab("PENDING")}>
                Pending: <strong className="text-amber-400">{stats.todayUnpaidActiveCustomersCount} Customers</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Filter Status Tabs Window: ALL, PENDING DUE, PAID TODAY */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-sm">
          <button
            onClick={() => setFilterTab("ALL")}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
              filterTab === "ALL"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Loans ({loans.length})
          </button>

          <button
            onClick={() => setFilterTab("PENDING")}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              filterTab === "PENDING"
                ? "bg-rose-600 text-white shadow-md"
                : "text-rose-400/90 hover:text-rose-300"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Pending ({stats.todayUnpaidActiveCustomersCount})
          </button>

          <button
            onClick={() => setFilterTab("PAID")}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              filterTab === "PAID"
                ? "bg-emerald-500 text-white shadow-md"
                : "text-emerald-400/90 hover:text-emerald-300"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Paid ({stats.todayPaidCustomersCount})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Customer Name or Mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Active Customer Loans Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-4 w-4 text-emerald-400" />
              {filterTab === "PENDING" ? "Pending Due Today" : filterTab === "PAID" ? "Paid Today" : "All Active Daily Loans"} ({filteredLoans.length})
            </h3>

            <span className="text-xs text-slate-400">Tap card for history</span>
          </div>

          {isLoansLoading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading daily loans...</div>
          ) : filteredLoans.length === 0 ? (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-400 text-sm">
              No active daily loan customers found matching your search.
            </div>
          ) : (
            filteredLoans.map((loan) => (
              <div
                key={loan.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 p-4 rounded-2xl space-y-3 transition-all shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-base">{loan.customerName}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Phone className="h-3.5 w-3.5 text-slate-500" />
                      <span>{loan.mobileNumber}</span>
                    </div>
                    {loan.address && (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        <span className="truncate max-w-[200px]">{loan.address}</span>
                      </div>
                    )}
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {loan.collectionPlan}
                  </span>
                </div>

                {/* Balance Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Total Loan Amount</span>
                    <span className="font-bold text-slate-200 text-sm">
                      ₹{loan.loanAmount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Remaining Balance</span>
                    <span className="font-black text-rose-400 text-sm">
                      ₹{loan.remainingAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Collected: ₹{loan.totalCollected.toLocaleString("en-IN")}</span>
                    <span className="text-purple-400 font-semibold">{loan.completionPct}% Recovered</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, loan.completionPct)}%` }}
                    />
                  </div>
                </div>

                {/* Cross-Module Pending Dues Alert Badge / Box */}
                {loan.otherDues && loan.otherDues.totalOtherDuesCount > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-amber-400 font-bold text-[11px] uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                        Also Has Other Pending Dues ({loan.otherDues.totalOtherDuesCount})
                      </span>
                    </div>
                    <div className="space-y-1">
                      {loan.otherDues.bissiCommittees.map((b, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-950/80 px-2 py-1 rounded-lg border border-amber-500/20 text-[11px]">
                          <span className="font-semibold text-amber-200">{b.committeeName} (Token #{b.tokenNumber})</span>
                          <span className="font-bold text-amber-400">₹{b.monthlyAmount.toLocaleString("en-IN")}/mo</span>
                        </div>
                      ))}
                      {loan.otherDues.otherDailyLoans.map((ol, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
                          <span className="font-semibold text-slate-300">Daily Loan: {ol.customerName}</span>
                          <span className="font-bold text-rose-400">₹{ol.remainingAmount.toLocaleString("en-IN")} Bal</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setSelectedLoan(loan);
                      setPaymentForm({
                        paymentDate: new Date().toISOString().slice(0, 10),
                        amountDeposited: "",
                        paymentMode: "Cash",
                        notes: "",
                      });
                      setIsCollectModalOpen(true);
                    }}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Collect Cash Deposit
                  </button>

                  <button
                    onClick={() => {
                      setSelectedLoanLedger(loan);
                      setIsLedgerOpen(true);
                    }}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                    title="View Ledger History"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Collect Cash Modal / Sheet */}
      {isCollectModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 text-slate-100 shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-400" />
                  Deposit Entry — {selectedLoan.customerName}
                </h3>
                <p className="text-xs text-slate-400">Record daily cash/UPI recovery deposit</p>
              </div>
              <button
                onClick={() => setIsCollectModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Other Pending Dues Warning Alert in Modal */}
            {selectedLoan.otherDues && selectedLoan.otherDues.totalOtherDuesCount > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <span>Customer Also Has Other Active Dues!</span>
                </div>
                <div className="space-y-1 text-slate-300">
                  {selectedLoan.otherDues.bissiCommittees.map((b, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-950 p-1.5 rounded-lg border border-amber-500/20 text-[11px]">
                      <span className="font-semibold text-amber-200">{b.committeeName} (Token #{b.tokenNumber})</span>
                      <span className="font-bold text-amber-400">₹{b.monthlyAmount.toLocaleString("en-IN")}/mo</span>
                    </div>
                  ))}
                  {selectedLoan.otherDues.otherDailyLoans.map((ol, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-[11px]">
                      <span className="font-semibold text-slate-300">Daily Loan: {ol.customerName}</span>
                      <span className="font-bold text-rose-400">₹{ol.remainingAmount.toLocaleString("en-IN")} Bal</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Subtraction Calculation Preview Box */}
            {(() => {
              const entered = parseFloat(paymentForm.amountDeposited) || 0;
              const newBal = Math.max(0, selectedLoan.remainingAmount - entered);
              return (
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Current Loan Balance:</span>
                    <span className="font-semibold text-slate-200">
                      ₹{selectedLoan.remainingAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>Minus Today's Deposit:</span>
                    <span>- ₹{entered.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-bold">
                    <span className="text-amber-400">New Remaining Balance:</span>
                    <span className="text-rose-400 font-black text-base">
                      ₹{newBal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Quick Amount Chips */}
            <div className="space-y-1.5">
              <span className="text-xs text-slate-400 font-medium">Quick Amount Chips</span>
              <div className="flex flex-wrap gap-2">
                {[100, 200, 500, 1000, 1400].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() =>
                      setPaymentForm({ ...paymentForm, amountDeposited: String(amt) })
                    }
                    className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-600/30 border border-slate-700 hover:border-emerald-500 text-xs font-bold rounded-lg text-emerald-300 transition-colors"
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Deposit Form Fields */}
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Deposit Amount (₹) *</label>
                <input
                  type="number"
                  placeholder="e.g. 200 or 500"
                  value={paymentForm.amountDeposited}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, amountDeposited: e.target.value })
                  }
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-base font-bold placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Payment Date *</label>
                  <input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, paymentDate: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Payment Mode</label>
                  <select
                    value={paymentForm.paymentMode}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, paymentMode: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="Optional payment notes"
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, notes: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-600"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setIsCollectModalOpen(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedLoan) {
                    addPaymentMutation.mutate({
                      loanId: selectedLoan.id,
                      payload: paymentForm,
                    });
                  }
                }}
                disabled={addPaymentMutation.isPending}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/40"
              >
                {addPaymentMutation.isPending ? "Saving..." : "Save Deposit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Ledger Sheet Modal */}
      {isLedgerOpen && selectedLoanLedger && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 text-slate-100 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">
                  Ledger — {selectedLoanLedger.customerName}
                </h3>
                <p className="text-xs text-slate-400">Step-by-step deposit & balance history</p>
              </div>
              <button onClick={() => setIsLedgerOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {!loanDetailData?.loan?.payments?.length ? (
                <div className="p-6 text-center text-slate-500">
                  No payment deposits recorded for this loan yet.
                </div>
              ) : (
                loanDetailData.loan.payments.map((p: any) => (
                  <div
                    key={p.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{p.paymentDate}</span>
                      <span className="font-bold text-emerald-400 text-sm">
                        +₹{p.amountDeposited.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Balance After Deposit:</span>
                      <span className="font-bold text-amber-400">
                        ₹{(p.runningRemainingBalance ?? 0).toLocaleString("en-IN")}
                      </span>
                    </div>

                    {p.notes && (
                      <p className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-1 mt-1">
                        Note: {p.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setIsLedgerOpen(false)}
              className="w-full py-3 bg-slate-800 text-slate-200 font-bold text-xs rounded-xl"
            >
              Close Ledger
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
