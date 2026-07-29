import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
import { safeArray } from "@/lib/utils";
import Header from "@/components/Header";
import { Search, User, Phone, MapPin, ChevronRight, X, CreditCard, Users } from "lucide-react";

type Customer = {
  id: number;
  refNumber: string;
  name: string;
  mobile: string;
  alternateMobile?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  status: string;
};

type Collection = {
  id: number;
  amount: number;
  paymentMode: string;
  collectedAt: string;
  committeeName?: string | null;
};

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);

  // Load all customers by default, filter with search
  const { data: rawCustomers, isFetching } = useQuery<any>({
    queryKey: ["customers-list", search],
    queryFn: () =>
      api.get(`/customers?search=${encodeURIComponent(search)}&limit=50`),
  });
  const customers = safeArray<Customer>(rawCustomers);

  return (
    <>
      <Header title="Customer Directory" />

      {selected ? (
        <CustomerDetail customer={selected} onBack={() => setSelected(null)} />
      ) : (
        <div className="p-4 space-y-3 max-w-lg mx-auto">
          {/* Customer count badge */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                <Users size={16} className="text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{customers.length} Customers</p>
                <p className="text-[10px] text-slate-500">Tap any customer for details</p>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name or mobile..."
              className="w-full h-11 bg-slate-100 dark:bg-slate-800/50 border border-border dark:border-slate-700/50 rounded-xl pl-10 pr-9 text-sm font-medium text-foreground dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 shadow-sm transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-foreground p-1"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {isFetching && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700/50 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-2/3" />
                    <div className="h-2 bg-slate-200 dark:bg-slate-700/50 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isFetching && customers.length === 0 && (
            <div className="text-center py-12 glass-card rounded-2xl">
              <User size={40} className="mx-auto mb-2 opacity-30 text-amber-500 dark:text-amber-400" />
              <p className="text-sm font-medium text-slate-500">No customers found</p>
              <p className="text-xs text-slate-450 mt-1">Try a different search term</p>
            </div>
          )}

          <div className="space-y-2">
            {customers.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="w-full glass-card rounded-2xl p-4 text-left flex items-center gap-3 hover:border-amber-500/30 active:bg-slate-100 dark:active:bg-slate-800/50 transition-all bg-card"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/15 flex items-center justify-center shrink-0">
                  <span className="text-amber-600 dark:text-amber-405 font-extrabold text-sm">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground dark:text-white text-sm truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone size={10} /> {c.mobile}
                  </p>
                  {c.city && <p className="text-xs text-slate-550 flex items-center gap-1"><MapPin size={10} /> {c.city}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      c.status === "active"
                        ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-slate-200 dark:bg-slate-700/40 text-slate-500 border border-border dark:border-slate-600/30"
                    }`}
                  >
                    {c.status}
                  </span>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function CustomerDetail({ customer, onBack }: { customer: Customer; onBack: () => void }) {
  const { data: rawCollections, isLoading } = useQuery<any>({
    queryKey: ["customer-collections", customer.id],
    queryFn: () => api.get(`/collections?customerId=${customer.id}&limit=10`),
  });
  const collections = safeArray<Collection>(rawCollections);

  return (
    <>
      <Header title={customer.name} back />
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Info card */}
        <div className="glass-card rounded-2xl p-5 space-y-4 bg-card">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/15 flex items-center justify-center shrink-0">
              <span className="text-amber-650 dark:text-amber-400 font-extrabold text-2xl">
                {customer.name.charAt(0)}
              </span>
            </div>
            <div>
              <h2 className="font-bold text-foreground dark:text-white text-lg">{customer.name}</h2>
              <p className="text-xs text-slate-500 font-mono">#{customer.refNumber}</p>
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider inline-block mt-1 ${
                  customer.status === "active"
                    ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-slate-200 dark:bg-slate-700/40 text-slate-500 border border-border dark:border-slate-600/30"
                }`}
              >
                {customer.status}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-border dark:border-slate-700/30">
            <InfoRow icon={<Phone size={15} />} value={customer.mobile} />
            {customer.alternateMobile && <InfoRow icon={<Phone size={15} />} value={customer.alternateMobile} />}
            {customer.address && (
              <InfoRow icon={<MapPin size={15} />} value={customer.address + (customer.city ? `, ${customer.city}` : "")} />
            )}
          </div>

          {/* Collector Action: Submit Customer Aadhaar KYC */}
          <div className="pt-2">
            <CustomerKycModal customer={customer} />
          </div>
        </div>

        {/* Recent collections */}
        <div>
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2 px-1">
            Recent Payments
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="glass-card rounded-xl p-3 h-14 animate-pulse bg-card" />
              ))}
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-8 glass-card rounded-2xl">
              <CreditCard size={32} className="mx-auto mb-1 opacity-30 text-amber-500" />
              <p className="text-sm font-medium text-slate-500">No payments recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {collections.map((col) => (
                <div
                  key={col.id}
                  className="glass-card rounded-xl p-3.5 flex items-center justify-between bg-card"
                >
                  <div>
                    <p className="text-sm font-extrabold text-foreground dark:text-white">{fmt.currency(col.amount)}</p>
                    <p className="text-xs text-amber-500 dark:text-amber-400 font-bold capitalize">
                      {col.paymentMode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-medium">{fmt.date(col.collectedAt)}</p>
                    {col.committeeName && (
                      <p className="text-xs text-slate-400 truncate max-w-36">{col.committeeName}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function InfoRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-start gap-2.5 text-xs font-medium text-foreground dark:text-white">
      <span className="text-amber-500 dark:text-amber-400 mt-0.5 shrink-0">{icon}</span>
      <span>{value}</span>
    </div>
  );
}

function CustomerKycModal({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState("");
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: "front" | "back") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (side === "front") setAadhaarFrontUrl(base64);
      else setAadhaarBackUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!aadhaarNumber || aadhaarNumber.replace(/\D/g, "").length < 12) {
      setMsg("Please enter a valid 12-digit Aadhaar Card number");
      return;
    }
    if (!aadhaarFrontUrl || !aadhaarBackUrl) {
      setMsg("Please upload both Aadhaar Front & Back photos");
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          userName: customer.name,
          userMobile: customer.mobile,
          userRole: "customer",
          aadhaarNumber,
          aadhaarFrontUrl,
          aadhaarBackUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "KYC submission failed");
      setMsg("Customer Aadhaar KYC submitted successfully for approval!");
      setTimeout(() => { setOpen(false); setMsg(""); }, 1800);
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2.5 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
      >
        🆔 Upload Customer Aadhaar KYC Photo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-md space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-foreground text-sm">Customer Aadhaar KYC ({customer.name})</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            {msg && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-medium">
                {msg}
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Aadhaar Card Number (12 digits)
              </label>
              <input
                className="w-full px-3 h-10 bg-slate-100 dark:bg-slate-800 border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-amber-500"
                placeholder="1234 5678 9012"
                maxLength={14}
                value={aadhaarNumber}
                onChange={(e) => setAadhaarNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Aadhaar Photos (Front & Back)
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="cursor-pointer border border-dashed border-amber-500/30 rounded-xl p-3 flex flex-col items-center justify-center text-center bg-slate-100 dark:bg-slate-800/40 hover:border-amber-500">
                  {aadhaarFrontUrl ? (
                    <img src={aadhaarFrontUrl} alt="Front" className="max-h-20 object-contain rounded" />
                  ) : (
                    <>
                      <span className="text-xs font-bold text-amber-500">Front Photo</span>
                      <span className="text-[9px] text-slate-400">Take/Upload</span>
                    </>
                  )}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, "front")} />
                </label>

                <label className="cursor-pointer border border-dashed border-amber-500/30 rounded-xl p-3 flex flex-col items-center justify-center text-center bg-slate-100 dark:bg-slate-800/40 hover:border-amber-500">
                  {aadhaarBackUrl ? (
                    <img src={aadhaarBackUrl} alt="Back" className="max-h-20 object-contain rounded" />
                  ) : (
                    <>
                      <span className="text-xs font-bold text-amber-500">Back Photo</span>
                      <span className="text-[9px] text-slate-400">Take/Upload</span>
                    </>
                  )}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, "back")} />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs"
              >
                {loading ? "Submitting..." : "Submit Customer KYC"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
