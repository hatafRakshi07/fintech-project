import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt, getStoredUser, ApiError } from "@/lib/api";
import { safeArray } from "@/lib/utils";
import Header from "@/components/Header";
import { Plus, CheckCircle2, Clock, User, X, CreditCard, Target, Phone, ChevronRight, Search, Landmark, Layers, Sparkles } from "lucide-react";

type TargetItem = {
  customerId: number;
  customerName: string;
  customerMobile: string;
  referenceNumber?: string | null;
  committeeId: number | null;
  committeeName: string | null;
  loanId: number | null;
  amountDue: number;
  dueAmount: number;
  isPaidToday: boolean;
  paidAmountToday: number;
  paymentModeToday: string | null;
  paidAtToday: string | null;
  lastPaymentDate: string | null;
  tokens?: string[];
};

type TargetSummary = {
  totalTargetCustomers: number;
  paidCount: number;
  pendingCount: number;
  totalTargetAmount: number;
  collectedAmount: number;
  remainingAmount: number;
  progressPercentage: number;
};

type BankAccount = {
  id: number;
  accountName: string;
  accountNumber?: string | null;
  bankName?: string | null;
  accountType: "bank" | "cash" | "upi" | "wallet";
  isActive: boolean;
};

type CustomerToken = {
  id: number;
  tokenNumber: string;
  committeeId: number;
  status: string;
};

type Customer = { id: number; name: string; mobile: string };

type NewCollection = {
  customerId: number;
  amount: string;
  paymentMode: "cash" | "upi" | "bank" | "card";
  accountId?: number;
  accountName?: string;
  committeeId?: number;
  loanId?: number;
  tokenId?: number;
  notes: string;
};

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
] as const;

export default function CollectionsPage() {
  const user = getStoredUser();
  const qc = useQueryClient();
  const [filterTab, setFilterTab] = useState<"pending" | "paid" | "all">("pending");
  const [search, setSearch] = useState("");
  const [modalCustomer, setModalCustomer] = useState<TargetItem | Customer | null>(null);
  const [form, setForm] = useState<NewCollection>({
    customerId: 0,
    amount: "",
    paymentMode: "cash",
    accountId: undefined,
    accountName: undefined,
    committeeId: undefined,
    loanId: undefined,
    tokenId: undefined,
    notes: "",
  });

  // Multi-token auto-split state
  const [useMultiTokenSplit, setUseMultiTokenSplit] = useState(true);
  const [tokenSplits, setTokenSplits] = useState<{ tokenId: number; tokenNumber: string; committeeId: number; amount: string }[]>([]);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Predefined Collection Type & Committee Selection
  const [collectionType, setCollectionType] = useState<"daily" | "monthly">("daily");
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<number | undefined>(undefined);
  const [utrNumber, setUtrNumber] = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  // Fetch Bissi Schemes / Committees
  const { data: rawCommittees } = useQuery<any[]>({
    queryKey: ["committees-list"],
    queryFn: () => api.get("/committees"),
  });
  const DEFAULT_COMMITTEES = [
    { id: 1, name: "Sawariya Seth Bissi", installmentAmount: 3000 },
    { id: 2, name: "Pyare Mohan Bissi", installmentAmount: 3000 },
    { id: 3, name: "Hare Ka Sahara Bissi", installmentAmount: 2500 },
    { id: 4, name: "Shree Krishna Bissi", installmentAmount: 3000 },
  ];
  const fetchedCommittees = safeArray<any>(rawCommittees);
  const committees = fetchedCommittees.length > 0 ? fetchedCommittees : DEFAULT_COMMITTEES;

  // Query Destination Bank / Cash Accounts
  const { data: rawBankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get("/accounts"),
  });
  const bankAccounts = safeArray<BankAccount>(rawBankAccounts);

  const activeAccounts = bankAccounts.filter((a) => a.isActive);

  // Query Target Summary
  const { data: targetSummary } = useQuery<TargetSummary>({
    queryKey: ["today-target-summary", user?.branchId],
    queryFn: () => api.get(`/collections/today-target-summary${user?.branchId ? `?branchId=${user.branchId}` : ""}`),
    refetchInterval: 15_000,
  });

  // Query Target Items
  const { data: rawTargetItems, isLoading } = useQuery<TargetItem[]>({
    queryKey: ["due-today", user?.branchId, filterTab],
    queryFn: () =>
      api.get(`/collections/due-today?filter=${filterTab}${user?.branchId ? `&branchId=${user.branchId}` : ""}`),
    refetchInterval: 15_000,
  });
  const targetItems = safeArray<TargetItem>(rawTargetItems);

  // Query customer's active tokens when modal is open
  const currentCustomerId = form.customerId;
  const { data: rawCustomerTokens } = useQuery<CustomerToken[]>({
    queryKey: ["customer-tokens", currentCustomerId],
    queryFn: () => api.get(`/tokens?customerId=${currentCustomerId}`),
    enabled: currentCustomerId > 0,
  });
  const customerTokens = safeArray<CustomerToken>(rawCustomerTokens);

  // Query customer's payment history
  const { data: rawCustomerHistory } = useQuery<any[]>({
    queryKey: ["customer-history", currentCustomerId],
    queryFn: () => api.get(`/collections?customerId=${currentCustomerId}`),
    enabled: currentCustomerId > 0,
  });
  const customerHistory = safeArray<any>(rawCustomerHistory);

  // Auto-allocate lump sum across tokens when amount changes
  useEffect(() => {
    if (useMultiTokenSplit && customerTokens.length > 0 && form.amount) {
      const lumpSum = parseFloat(form.amount) || 0;
      if (lumpSum > 0) {
        const perToken = Math.round((lumpSum / customerTokens.length) * 100) / 100;
        const splits = customerTokens.map((t, idx) => {
          // Put remainder on first token if rounding difference
          const amt = idx === 0 ? Math.round((lumpSum - perToken * (customerTokens.length - 1)) * 100) / 100 : perToken;
          return {
            tokenId: t.id,
            tokenNumber: t.tokenNumber,
            committeeId: t.committeeId,
            amount: String(amt),
          };
        });
        setTokenSplits(splits);
      }
    }
  }, [form.amount, customerTokens, useMultiTokenSplit]);

  // Set default account whenever payment mode changes
  useEffect(() => {
    if (activeAccounts.length > 0 && !form.accountId) {
      const matched = activeAccounts.find((a) => a.accountType === form.paymentMode) || activeAccounts[0];
      if (matched) {
        setForm((f) => ({ ...f, accountId: matched.id, accountName: matched.accountName }));
      }
    }
  }, [form.paymentMode, activeAccounts]);

  const recordMutation = useMutation({
    mutationFn: (data: object) => api.post("/collections", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["due-today"] });
      qc.invalidateQueries({ queryKey: ["today-summary"] });
      qc.invalidateQueries({ queryKey: ["today-target-summary"] });
      qc.invalidateQueries({ queryKey: ["customer-history"] });
      setModalCustomer(null);
      setSuccessMsg("Payment recorded successfully!");
      setTimeout(() => setSuccessMsg(null), 3500);
    },
  });

  function openModal(item: TargetItem | Customer) {
    const customerId = "customerId" in item ? item.customerId : item.id;
    const dueAmt = "amountDue" in item ? item.amountDue : 500;
    const defaultAcc = activeAccounts[0];

    setForm({
      customerId,
      amount: String(Math.round(dueAmt)),
      paymentMode: "cash",
      accountId: defaultAcc?.id,
      accountName: defaultAcc?.accountName,
      committeeId: "committeeId" in item ? (item.committeeId ?? undefined) : undefined,
      loanId: "loanId" in item ? (item.loanId ?? undefined) : undefined,
      tokenId: undefined,
      notes: "",
    });
    setUtrNumber("");
    setScreenshotPreview(null);
    setSelectedCommitteeId("committeeId" in item ? (item.committeeId ?? undefined) : undefined);
    setModalCustomer(item);
  }

  function handleScreenshotFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setScreenshotPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId || !form.amount) return;

    const commId = selectedCommitteeId || form.committeeId;

    const noteParts = [];
    if (utrNumber.trim()) noteParts.push(`UTR: ${utrNumber.trim()}`);
    if (form.notes.trim()) noteParts.push(form.notes.trim());
    const finalNotes = noteParts.join(" | ");

    // Check if submitting batch multi-token allocation
    if (useMultiTokenSplit && customerTokens.length > 1 && tokenSplits.length > 0) {
      const tokenAllocations = tokenSplits.map((s) => ({
        tokenId: s.tokenId,
        committeeId: commId || s.committeeId,
        amount: parseFloat(s.amount) || 0,
        notes: `Token #${s.tokenNumber}${finalNotes ? ` (${finalNotes})` : ""}`,
      }));

      recordMutation.mutate({
        customerId: form.customerId,
        amount: parseFloat(form.amount),
        paymentMode: form.paymentMode,
        accountId: form.accountId,
        accountName: form.accountName,
        committeeId: commId,
        branchId: user?.branchId ?? undefined,
        collectedAt: new Date().toISOString(),
        tokenAllocations,
      });
    } else {
      // Single collection mode
      const matchedToken = customerTokens.find((t) => t.committeeId === commId) || customerTokens[0];
      recordMutation.mutate({
        customerId: form.customerId,
        amount: parseFloat(form.amount),
        paymentMode: form.paymentMode,
        accountId: form.accountId,
        accountName: form.accountName,
        committeeId: commId,
        loanId: form.loanId,
        tokenId: matchedToken?.id ?? form.tokenId,
        notes: finalNotes || undefined,
        branchId: user?.branchId ?? undefined,
        collectedAt: new Date().toISOString(),
      });
    }
  }

  // Filter items by client search string if typed
  const filteredItems = targetItems.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.customerName?.toLowerCase().includes(q) ||
      item.customerMobile?.includes(q) ||
      item.referenceNumber?.toLowerCase().includes(q)
    );
  });

  const progress = targetSummary?.progressPercentage ?? 0;

  return (
    <>
      <Header title="Daily Collection Target" />

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {successMsg && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 dark:text-emerald-400 rounded-2xl px-4 py-3.5 text-xs font-bold flex items-center gap-2.5 shadow-sm">
            <CheckCircle2 size={18} className="shrink-0" /> {successMsg}
          </div>
        )}

        {/* TARGET PROGRESS HEADER CARD */}
        <div className="glass-card rounded-2xl p-4.5 space-y-3 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-amber-500 dark:text-amber-400" />
              <h2 className="text-sm font-black text-foreground dark:text-white uppercase tracking-wider">
                Today's Target Progress
              </h2>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-550 dark:text-amber-400 border border-amber-500/20">
              {progress}% Completed
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-800/60 rounded-full h-2.5 overflow-hidden border border-border dark:border-slate-700/50 p-0.5">
            <div
              className="bg-gradient-to-r from-amber-550 to-emerald-500 h-full rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs font-semibold pt-1">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Collected: </span>
              <span className="text-emerald-500 dark:text-emerald-400 font-extrabold">
                {fmt.currency(targetSummary?.collectedAmount ?? 0)}
              </span>
              <span className="text-slate-500 text-[11px]"> ({targetSummary?.paidCount ?? 0} Paid)</span>
            </div>
            <div>
              <span className="text-slate-550 dark:text-slate-400">Target: </span>
              <span className="text-foreground dark:text-white font-black">
                {fmt.currency(targetSummary?.totalTargetAmount ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Quick record button */}
        <button
          onClick={() => openModal({ id: 0, name: "", mobile: "" })}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-550 text-slate-950 rounded-2xl py-3.5 flex items-center justify-center gap-2 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-[0.99]"
        >
          <Plus size={18} />
          Record Custom Collection
        </button>

        {/* Filter Pills & Search */}
        <div className="space-y-2.5">
          {/* Tabs */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setFilterTab("pending")}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                filterTab === "pending"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-500/20 shadow-md shadow-amber-500/20"
                  : "bg-slate-100 dark:bg-slate-800/40 border-border dark:border-slate-700/50 text-slate-550 dark:text-slate-400 hover:text-foreground"
              }`}
            >
              Pending ({targetSummary?.pendingCount ?? 0})
            </button>

            <button
              onClick={() => setFilterTab("paid")}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                filterTab === "paid"
                  ? "bg-emerald-600 text-white border-emerald-500/20 shadow-md shadow-emerald-500/20"
                  : "bg-slate-100 dark:bg-slate-800/40 border-border dark:border-slate-700/50 text-slate-550 dark:text-slate-400 hover:text-foreground"
              }`}
            >
              Paid Today ({targetSummary?.paidCount ?? 0})
            </button>

            <button
              onClick={() => setFilterTab("all")}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                filterTab === "all"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-500/20 shadow-md shadow-amber-500/20"
                  : "bg-slate-100 dark:bg-slate-800/40 border-border dark:border-slate-700/50 text-slate-550 dark:text-slate-400 hover:text-foreground"
              }`}
            >
              All Target ({targetSummary?.totalTargetCustomers ?? 0})
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search target customer by name or phone..."
              className="w-full h-10 bg-slate-100 dark:bg-slate-800/50 border border-border dark:border-slate-700/50 text-foreground dark:text-white placeholder:text-slate-500 rounded-xl pl-9 pr-4 text-xs font-medium focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        {/* TARGET CUSTOMERS LIST */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
            Target Customers ({filteredItems.length})
          </h3>

          {isLoading ? (
            <LoadingSkeleton />
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500 glass-card rounded-2xl p-6">
              <CheckCircle2 size={40} className="mx-auto mb-2 opacity-40 text-amber-500 dark:text-amber-400" />
              <p className="text-sm font-bold text-foreground dark:text-white">No customers found</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {filterTab === "pending"
                  ? "All daily target collections are completed!"
                  : "No collections match the current filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredItems.map((item, i) => (
                <div
                  key={i}
                  className="glass-card rounded-2xl p-4 text-left space-y-3 hover:border-amber-500/30 transition-all shadow-sm bg-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                          item.isPaidToday
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500 dark:text-emerald-400 font-extrabold"
                            : "bg-amber-500/15 border-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold"
                        }`}
                      >
                        {item.customerName?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-foreground dark:text-white text-sm truncate">{item.customerName}</p>
                          {item.referenceNumber && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              #{item.referenceNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Phone size={11} className="text-amber-500 dark:text-amber-400" /> {item.customerMobile}
                        </p>
                        {item.committeeName && (
                          <p className="text-xs text-amber-500 dark:text-amber-400 font-medium truncate mt-0.5">
                            {item.committeeName}
                          </p>
                        )}
                        {/* Token Badges */}
                        {item.tokens && item.tokens.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.tokens.map((tok) => (
                              <span
                                key={tok}
                                className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-black uppercase tracking-wide"
                              >
                                Token: {tok}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-black text-foreground dark:text-white text-base">
                        {fmt.currency(item.isPaidToday ? item.paidAmountToday : item.amountDue)}
                      </p>
                      {item.isPaidToday ? (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30 inline-block mt-0.5">
                          Paid Today ({item.paymentModeToday})
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-450 border border-amber-500/20 inline-block mt-0.5">
                          Due Today
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border dark:border-slate-700/30">
                    {item.customerMobile && (
                      <a
                        href={`tel:${item.customerMobile}`}
                        className="px-3 py-2 bg-slate-100 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-800/70 text-foreground dark:text-white border border-border dark:border-slate-700/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                        title="Call Customer"
                      >
                        <Phone size={13} className="text-amber-500 dark:text-amber-400" /> Call
                      </a>
                    )}

                    {!item.isPaidToday ? (
                      <button
                        onClick={() => openModal(item)}
                        className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-550 text-slate-950 font-bold rounded-xl py-2 text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-[0.99]"
                      >
                        <CreditCard size={14} /> Collect {fmt.currency(item.amountDue)}
                      </button>
                    ) : (
                      <button
                        onClick={() => openModal(item)}
                        className="flex-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30 font-bold rounded-xl py-2 text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <CheckCircle2 size={14} /> Paid {fmt.currency(item.paidAmountToday)} • Record Addl
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment Confirmation Modal */}
      {modalCustomer !== null && (
        <div className="fixed inset-0 z-[100] flex items-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setModalCustomer(null)} />
          <div className="relative bg-card dark:bg-slate-900 border-t border-border dark:border-slate-800 rounded-t-3xl w-full max-h-[90vh] overflow-y-auto p-6 pb-safe text-foreground dark:text-white shadow-2xl z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <CreditCard size={18} className="text-amber-500 dark:text-amber-400" /> Confirm Collection
              </h2>
              <button
                onClick={() => setModalCustomer(null)}
                className="p-1 rounded-xl text-slate-500 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Selected Customer Header Banner */}
            {modalCustomer !== null && ("customerName" in modalCustomer || "name" in modalCustomer) && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 mb-4 flex items-center gap-3">
                <User size={20} className="text-amber-500 dark:text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground dark:text-white">
                    {"customerName" in modalCustomer ? modalCustomer.customerName : (modalCustomer as any).name}
                  </p>
                  <p className="text-xs text-amber-500 dark:text-amber-400 font-medium">
                    {"customerMobile" in modalCustomer ? modalCustomer.customerMobile : (modalCustomer as any).mobile}
                  </p>
                  {/* Token List Badge in Header */}
                  {customerTokens && customerTokens.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {customerTokens.map((t) => (
                        <span
                          key={t.id}
                          className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wide"
                        >
                          Token: {t.tokenNumber}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-rose-500 font-bold mt-1.5">No active tokens found (कोई एक्टिव टोकन नहीं मिला)</p>
                  )}
                </div>
              </div>
            )}

            {/* Payment History Widget */}
            {currentCustomerId > 0 && customerHistory && customerHistory.length > 0 ? (() => {
              const sortedHistory = [...customerHistory].sort(
                (a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime()
              );
              const lastPayment = sortedHistory[0];
              const totalPaidBefore = sortedHistory.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
              
              return (
                <div className="bg-slate-100 dark:bg-slate-800/30 border border-border dark:border-slate-700/50 rounded-2xl p-3.5 mb-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-500 font-bold uppercase tracking-wider">
                    <span>Payment History (पिछला भुगतान)</span>
                    <span className="text-amber-500 font-extrabold">Total Paid: {fmt.currency(totalPaidBefore)}</span>
                  </div>
                  <div className="flex items-center justify-between font-medium pt-1 border-t border-border dark:border-slate-700/20">
                    <span className="text-slate-500">Last Paid Amount:</span>
                    <span className="font-extrabold text-foreground dark:text-white">{fmt.currency(lastPayment.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Last Paid Date & Time:</span>
                    <span className="font-mono text-foreground dark:text-white">
                      {new Date(lastPayment.collectedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Payment Mode:</span>
                    <span className="capitalize font-mono text-foreground dark:text-white">{lastPayment.paymentMode}</span>
                  </div>
                </div>
              );
            })() : currentCustomerId > 0 ? (
              <div className="bg-slate-100 dark:bg-slate-800/30 border border-border dark:border-slate-700/50 rounded-2xl p-3.5 mb-4 text-center text-xs text-slate-500 font-bold animate-fadeIn">
                No previous payments found (कोई पिछला भुगतान नहीं मिला)
              </div>
            ) : null}

            {/* Customer Search Inline if creating custom payment */}
            {form.customerId === 0 && (
              <CustomerSearchInline
                onSelect={(c) => {
                  setForm((f) => ({ ...f, customerId: c.id }));
                  setModalCustomer(c);
                }}
              />
            )}

            {form.customerId !== 0 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* PREDEFINED COLLECTION TYPE SELECTOR */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Collection Type (कलेक्शन का प्रकार)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCollectionType("daily")}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                        collectionType === "daily"
                          ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-500/20 shadow-md shadow-amber-500/20"
                          : "bg-slate-100 dark:bg-slate-800/40 border-border dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-foreground"
                      }`}
                    >
                      <span>📅</span> Daily Collection
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollectionType("monthly")}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                        collectionType === "monthly"
                          ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-500/20 shadow-md shadow-amber-500/20"
                          : "bg-slate-100 dark:bg-slate-800/40 border-border dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-foreground"
                      }`}
                    >
                      <span>🗓️</span> Monthly Bissi
                    </button>
                  </div>
                </div>

                {/* PREDEFINED BISSI SCHEME / COMMITTEE SELECTOR */}
                {committees.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Layers size={14} className="text-amber-500 dark:text-amber-400" /> Bissi Scheme / Committee (बिस्सी स्कीम चुनें)
                    </label>
                    <select
                      value={selectedCommitteeId || ""}
                      onChange={(e) => setSelectedCommitteeId(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full h-11 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white rounded-xl px-3.5 text-xs font-bold focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="">Select Bissi Scheme (Optional / Auto-detect)</option>
                      {committees.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Installment: ₹{c.installmentAmount || 3000})
                        </option>
                      ))}
                    </select>
                    {/* Selected Scheme Token Number Display */}
                    {selectedCommitteeId && (() => {
                      const matched = customerTokens.filter((t) => t.committeeId === selectedCommitteeId);
                      if (matched.length === 0) return null;
                      return (
                        <div className="mt-2 flex flex-wrap gap-1.5 animate-fadeIn">
                          {matched.map((t) => (
                            <span
                              key={t.id}
                              className="text-[10px] px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-black uppercase tracking-wide flex items-center gap-1.5"
                            >
                              <span>🎟️</span> Token: {t.tokenNumber}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Total Lump-Sum Amount Input */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Collection Amount (₹)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    required
                    className="w-full h-12 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white rounded-xl px-4 text-xl font-black focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                  />
                </div>

                {/* MULTI-TOKEN AUTO-SPLIT WIDGET */}
                {customerTokens.length > 1 && (
                  <div className="bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-amber-500 dark:text-amber-400" />
                        <span className="text-xs font-bold text-foreground dark:text-white">
                          Customer Tokens ({customerTokens.length} Active Tokens)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUseMultiTokenSplit(!useMultiTokenSplit)}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                          useMultiTokenSplit
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-500 dark:text-amber-400"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-border dark:border-slate-700/50"
                        }`}
                      >
                        {useMultiTokenSplit ? "Auto-Split Active" : "Single Lump Sum"}
                      </button>
                    </div>

                    {useMultiTokenSplit && (
                      <div className="space-y-2 pt-1 border-t border-border dark:border-slate-700/30">
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                          <Sparkles size={12} className="text-amber-500 dark:text-amber-400" /> Total ₹{form.amount || "0"} is split equally across {customerTokens.length} tokens:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                          {tokenSplits.map((s, idx) => (
                            <div key={s.tokenId} className="glass-card rounded-xl p-2 flex items-center justify-between text-xs bg-card">
                              <span className="font-bold text-foreground dark:text-white">Token #{s.tokenNumber}</span>
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 font-mono">₹</span>
                                <input
                                  type="number"
                                  value={s.amount}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updated = [...tokenSplits];
                                    updated[idx].amount = val;
                                    setTokenSplits(updated);
                                  }}
                                  className="w-20 h-7 bg-slate-100 dark:bg-slate-850 border border-border dark:border-slate-700/50 rounded text-right px-2 font-mono font-bold text-foreground dark:text-white focus:outline-none focus:border-amber-500/50"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Landmark size={14} className="text-amber-500 dark:text-amber-400" /> Destination Account (किस अकाउंट में पैसा गया)
                  </label>
                  {(() => {
                    const filteredAccounts = activeAccounts.filter(acc => {
                      if (form.paymentMode === "cash") return acc.accountType === "cash";
                      if (form.paymentMode === "upi") return acc.accountType === "upi" || acc.accountType === "bank";
                      return true;
                    });
                    
                    if (filteredAccounts.length === 0) {
                      return (
                        <p className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800/40 p-2.5 rounded-xl border border-border dark:border-slate-700/50">
                          No matching destination accounts found.
                        </p>
                      );
                    }
                    
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredAccounts.map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, accountId: acc.id, accountName: acc.accountName }))}
                            className={`p-2.5 rounded-xl text-xs font-bold text-left transition-all border flex items-center gap-2.5 ${
                              form.accountId === acc.id
                                ? "bg-amber-500/15 border-amber-500 text-amber-500 dark:text-amber-400 shadow-sm"
                                : "bg-slate-100 dark:bg-slate-800/30 border-border dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-foreground"
                            }`}
                          >
                            <div className={`w-3 h-3 rounded-full border ${form.accountId === acc.id ? "bg-amber-500 border-amber-500" : "border-slate-500"}`} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold text-foreground dark:text-white">{acc.accountName}</p>
                              <p className="text-[10px] text-slate-500 capitalize font-medium">{acc.bankName || acc.accountType}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Payment Mode Selector */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Payment Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_MODES.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, paymentMode: m.value }))}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                          form.paymentMode === m.value
                            ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-500/20 shadow-md shadow-amber-500/20"
                            : "bg-slate-100 dark:bg-slate-800/40 border-border dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-foreground"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ONLINE DETAILS: UTR NUMBER & SCREENSHOT UPLOAD */}
                {form.paymentMode !== "cash" && (
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 dark:text-amber-400">
                      <CreditCard size={15} /> Online Payment Verification Details
                    </div>

                    {/* UTR / Transaction Reference Number */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        UTR / Transaction Reference No. (ऑनलाइन UTR नंबर)
                      </label>
                      <input
                        type="text"
                        value={utrNumber}
                        onChange={(e) => setUtrNumber(e.target.value)}
                        placeholder="e.g. UTR9876543210"
                        className="w-full h-10 bg-slate-100 dark:bg-slate-855 border border-border dark:border-slate-700/50 text-foreground dark:text-white rounded-xl px-3.5 text-xs font-bold font-mono focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    {/* Screenshot Upload */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Payment Screenshot (स्क्रीनशॉट / रसीद)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotFile}
                        className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                      />
                      {screenshotPreview && (
                        <div className="mt-2.5 relative w-24 h-24 rounded-xl border-2 border-amber-500 overflow-hidden shadow-md">
                          <img src={screenshotPreview} alt="Payment Proof" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setScreenshotPreview(null)}
                            className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 text-xs font-bold shadow-md"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Notes / Remarks (optional)
                  </label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Daily collection received"
                    className="w-full h-11 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white placeholder:text-slate-500 rounded-xl px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {recordMutation.error && (
                  <p className="text-xs text-rose-500 dark:text-rose-450 font-bold bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                    {recordMutation.error instanceof ApiError
                      ? recordMutation.error.message
                      : "Failed to record payment"}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={recordMutation.isPending || !form.amount}
                  className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-550 text-slate-950 font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 mt-2"
                >
                  {recordMutation.isPending ? (
                    <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Confirm & Save Collection
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CustomerSearchInline({ onSelect }: { onSelect: (c: { id: number; name: string; mobile: string }) => void }) {
  const [q, setQ] = useState("");
  const { data: results = [], isFetching } = useQuery<{ id: number; name: string; mobile: string }[]>({
    queryKey: ["customers-search-inline", q],
    queryFn: () => api.get(`/customers?search=${encodeURIComponent(q)}&limit=10`),
    enabled: q.length >= 2,
    select: (d: any) => (Array.isArray(d) ? d : d.data ?? []),
  });

  return (
    <div className="mb-4">
      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
        Search Customer Profile
      </label>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Name or phone number..."
        className="w-full h-11 bg-slate-100 dark:bg-slate-800/40 border border-border dark:border-slate-700/50 text-foreground dark:text-white placeholder:text-slate-500 rounded-xl px-4 text-sm font-medium focus:outline-none focus:border-amber-500/50"
        autoFocus
      />
      {isFetching && <p className="text-xs text-amber-500 dark:text-amber-450 font-medium mt-1.5">Searching…</p>}
      {results.length > 0 && (
        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className="w-full text-left bg-slate-100 dark:bg-slate-800/30 border border-border dark:border-slate-700/50 hover:border-amber-500/30 rounded-xl px-4 py-2.5 flex items-center gap-3 active:bg-slate-200 dark:active:bg-slate-800/60 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <span className="text-amber-500 dark:text-amber-400 text-xs font-bold">{c.name.charAt(0)}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground dark:text-white">{c.name}</p>
                <p className="text-xs text-slate-550 dark:text-slate-500">{c.mobile}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted rounded w-2/3" />
            <div className="h-2 bg-muted rounded w-1/3" />
          </div>
          <div className="h-4 bg-muted rounded w-16" />
        </div>
      ))}
    </div>
  );
}
