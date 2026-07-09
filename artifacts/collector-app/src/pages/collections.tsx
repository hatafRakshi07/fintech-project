import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt, getStoredUser, ApiError } from "@/lib/api";
import Header from "@/components/Header";
import { Plus, CheckCircle2, Clock, User, X } from "lucide-react";

type DueItem = {
  customerId: number;
  customerName: string;
  customerMobile: string;
  committeeId: number | null;
  committeeName: string | null;
  loanId: number | null;
  amountDue: number;
  lastPaymentDate: string | null;
};

type Customer = { id: number; name: string; mobile: string };

type NewCollection = {
  customerId: number;
  amount: string;
  paymentMode: "cash" | "upi" | "bank" | "card";
  committeeId?: number;
  loanId?: number;
  notes: string;
};

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
] as const;

export default function CollectionsPage() {
  const user = getStoredUser();
  const qc = useQueryClient();
  const [modalCustomer, setModalCustomer] = useState<DueItem | Customer | null>(null);
  const [form, setForm] = useState<NewCollection>({
    customerId: 0,
    amount: "",
    paymentMode: "cash",
    committeeId: undefined,
    loanId: undefined,
    notes: "",
  });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: dueItems = [], isLoading } = useQuery<DueItem[]>({
    queryKey: ["due-today", user?.branchId],
    queryFn: () =>
      api.get(`/collections/due-today${user?.branchId ? `?branchId=${user.branchId}` : ""}`),
  });

  const recordMutation = useMutation({
    mutationFn: (data: object) => api.post("/collections", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["due-today"] });
      qc.invalidateQueries({ queryKey: ["today-summary"] });
      setModalCustomer(null);
      setSuccessMsg("Payment recorded successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    },
  });

  function openModal(item: DueItem | Customer) {
    const customerId = "customerId" in item ? item.customerId : item.id;
    setForm({
      customerId,
      amount: "amountDue" in item ? String(Math.round(item.amountDue)) : "",
      paymentMode: "cash",
      committeeId: "committeeId" in item ? (item.committeeId ?? undefined) : undefined,
      loanId: "loanId" in item ? (item.loanId ?? undefined) : undefined,
      notes: "",
    });
    setModalCustomer(item);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId || !form.amount) return;
    recordMutation.mutate({
      customerId: form.customerId,
      amount: parseFloat(form.amount),
      paymentMode: form.paymentMode,
      committeeId: form.committeeId,
      loanId: form.loanId,
      notes: form.notes || undefined,
      branchId: user?.branchId ?? undefined,
      collectedAt: new Date().toISOString(),
    });
  }

  return (
    <>
      <Header title="Collections" />

      <div className="p-4 space-y-3">
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {/* Quick record button */}
        <button
          onClick={() => openModal({ id: 0, name: "", mobile: "" })}
          className="w-full bg-indigo-600 text-white rounded-2xl py-3.5 flex items-center justify-center gap-2 font-semibold text-sm active:bg-indigo-700">
          <Plus size={18} />
          Record New Payment
        </button>

        {/* Due today list */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Due Today ({dueItems.length})
          </h3>

          {isLoading ? (
            <LoadingSkeleton />
          ) : dueItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle2 size={40} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">All collections are up to date!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dueItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => openModal(item)}
                  className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left flex items-center gap-3 active:bg-gray-50">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <span className="text-indigo-700 font-bold text-sm">
                      {item.customerName?.charAt(0)?.toUpperCase() ?? "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{item.customerName}</p>
                    <p className="text-xs text-gray-400">{item.customerMobile}</p>
                    {item.committeeName && (
                      <p className="text-xs text-indigo-500 truncate">{item.committeeName}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-800 text-sm">{fmt.currency(item.amountDue)}</p>
                    {item.lastPaymentDate ? (
                      <p className="text-xs text-gray-400">Last: {fmt.shortDate(item.lastPaymentDate)}</p>
                    ) : (
                      <p className="text-xs text-amber-500 flex items-center gap-1 justify-end">
                        <Clock size={10} /> Never paid
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {modalCustomer !== null && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalCustomer(null)} />
          <div className="relative bg-white rounded-t-3xl w-full max-h-[90vh] overflow-y-auto p-6 pb-safe">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">Record Payment</h2>
              <button onClick={() => setModalCustomer(null)} className="p-1 text-gray-400">
                <X size={20} />
              </button>
            </div>

            {/* Customer info */}
            {"customerName" in modalCustomer && modalCustomer.customerName && (
              <div className="bg-indigo-50 rounded-xl p-3 mb-4 flex items-center gap-2">
                <User size={16} className="text-indigo-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-indigo-900">{modalCustomer.customerName}</p>
                  <p className="text-xs text-indigo-500">{modalCustomer.customerMobile}</p>
                </div>
              </div>
            )}

            {/* Customer search if no customer selected */}
            {form.customerId === 0 && (
              <CustomerSearchInline onSelect={(c) => {
                setForm(f => ({ ...f, customerId: c.id }));
                setModalCustomer(c);
              }} />
            )}

            {form.customerId !== 0 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.amount}
                    onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    required
                    className="w-full h-12 border border-gray-300 rounded-xl px-4 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Mode</label>
                  <div className="grid grid-cols-4 gap-2">
                    {PAYMENT_MODES.map(m => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, paymentMode: m.value }))}
                        className={`py-2 rounded-xl text-sm font-medium transition-colors
                          ${form.paymentMode === m.value
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-600"
                          }`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Add a note..."
                    className="w-full h-11 border border-gray-300 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {recordMutation.error && (
                  <p className="text-sm text-red-600">
                    {recordMutation.error instanceof ApiError ? recordMutation.error.message : "Failed to record payment"}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={recordMutation.isPending || !form.amount}
                  className="w-full h-12 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
                  {recordMutation.isPending ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Confirm Payment
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
      <label className="block text-sm font-medium text-gray-700 mb-1">Search Customer</label>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Name or phone number..."
        className="w-full h-11 border border-gray-300 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        autoFocus
      />
      {isFetching && <p className="text-xs text-gray-400 mt-1">Searching…</p>}
      {results.length > 0 && (
        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className="w-full text-left bg-gray-50 rounded-xl px-4 py-2.5 flex items-center gap-3 active:bg-gray-100">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <span className="text-indigo-700 text-xs font-bold">{c.name.charAt(0)}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{c.name}</p>
                <p className="text-xs text-gray-400">{c.mobile}</p>
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
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-100 rounded w-2/3" />
            <div className="h-2 bg-gray-100 rounded w-1/3" />
          </div>
          <div className="h-4 bg-gray-100 rounded w-16" />
        </div>
      ))}
    </div>
  );
}
