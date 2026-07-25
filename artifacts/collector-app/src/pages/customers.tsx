import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
import { safeArray } from "@/lib/utils";
import Header from "@/components/Header";
import { Search, User, Phone, MapPin, ChevronRight, X, CreditCard } from "lucide-react";

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

  const { data: customers = [], isFetching } = useQuery<Customer[]>({
    queryKey: ["customers-search", search],
    queryFn: () =>
      api.get(`/customers?search=${encodeURIComponent(search)}&limit=20`).then((d: any) =>
        safeArray<Customer>(d),
      ),
    enabled: search.length >= 2,
  });

  return (
    <>
      <Header title="Customer Directory" />

      {selected ? (
        <CustomerDetail customer={selected} onBack={() => setSelected(null)} />
      ) : (
        <div className="p-4 space-y-3 max-w-lg mx-auto">
          {/* Search bar */}
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name or mobile..."
              className="w-full h-11 bg-card border border-border rounded-xl pl-10 pr-9 text-sm font-medium text-foreground focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm transition-all"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {search.length < 2 && (
            <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-2xl">
              <Search size={40} className="mx-auto mb-2 opacity-30 text-amber-500" />
              <p className="text-sm font-medium">Type at least 2 characters to search</p>
            </div>
          )}

          {isFetching && search.length >= 2 && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-2/3" />
                    <div className="h-2 bg-muted rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isFetching && search.length >= 2 && customers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-2xl">
              <User size={40} className="mx-auto mb-2 opacity-30 text-amber-500" />
              <p className="text-sm font-medium">No customers found matching search</p>
            </div>
          )}

          <div className="space-y-2">
            {customers.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="w-full bg-card rounded-2xl border border-border p-4 text-left flex items-center gap-3 hover:border-amber-500/40 active:bg-muted/40 transition-all shadow-sm"
              >
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <span className="text-amber-500 dark:text-amber-400 font-extrabold text-sm">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.mobile}</p>
                  {c.city && <p className="text-xs text-muted-foreground">{c.city}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      c.status === "active"
                        ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {c.status}
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground" />
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
  const { data: collections = [], isLoading } = useQuery<Collection[]>({
    queryKey: ["customer-collections", customer.id],
    queryFn: () =>
      api.get(`/collections?customerId=${customer.id}&limit=10`).then((d: any) =>
        Array.isArray(d) ? d : d.data ?? [],
      ),
  });

  return (
    <>
      <Header title={customer.name} back />
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Info card */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <span className="text-amber-500 dark:text-amber-400 font-black text-2xl">
                {customer.name.charAt(0)}
              </span>
            </div>
            <div>
              <h2 className="font-bold text-foreground text-lg">{customer.name}</h2>
              <p className="text-xs text-muted-foreground font-mono">#{customer.refNumber}</p>
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider inline-block mt-1 ${
                  customer.status === "active"
                    ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {customer.status}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-border">
            <InfoRow icon={<Phone size={15} />} value={customer.mobile} />
            {customer.alternateMobile && <InfoRow icon={<Phone size={15} />} value={customer.alternateMobile} />}
            {customer.address && (
              <InfoRow icon={<MapPin size={15} />} value={customer.address + (customer.city ? `, ${customer.city}` : "")} />
            )}
          </div>
        </div>

        {/* Recent collections */}
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Recent Payments
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-3 h-14 animate-pulse" />
              ))}
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground bg-card border border-border rounded-2xl">
              <CreditCard size={32} className="mx-auto mb-1 opacity-30 text-amber-500" />
              <p className="text-sm font-medium">No payments recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {collections.map((col) => (
                <div
                  key={col.id}
                  className="bg-card rounded-xl border border-border p-3.5 flex items-center justify-between shadow-sm"
                >
                  <div>
                    <p className="text-sm font-black text-foreground">{fmt.currency(col.amount)}</p>
                    <p className="text-xs text-amber-500 dark:text-amber-400 font-bold capitalize">
                      {col.paymentMode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground font-medium">{fmt.date(col.collectedAt)}</p>
                    {col.committeeName && (
                      <p className="text-xs text-muted-foreground truncate max-w-36">{col.committeeName}</p>
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
    <div className="flex items-start gap-2.5 text-xs font-medium text-foreground">
      <span className="text-amber-500 dark:text-amber-400 mt-0.5 shrink-0">{icon}</span>
      <span>{value}</span>
    </div>
  );
}
