import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
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
        Array.isArray(d) ? d : d.data ?? [],
      ),
    enabled: search.length >= 2,
  });

  return (
    <>
      <Header title="Customers" />

      {selected ? (
        <CustomerDetail customer={selected} onBack={() => setSelected(null)} />
      ) : (
        <div className="p-4 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or mobile..."
              className="w-full h-11 bg-white border border-gray-200 rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={16} />
              </button>
            )}
          </div>

          {search.length < 2 && (
            <div className="text-center py-16 text-gray-400">
              <Search size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Type at least 2 characters to search</p>
            </div>
          )}

          {isFetching && search.length >= 2 && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                    <div className="h-2 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isFetching && search.length >= 2 && customers.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <User size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No customers found</p>
            </div>
          )}

          <div className="space-y-2">
            {customers.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left flex items-center gap-3 active:bg-gray-50">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <span className="text-indigo-700 font-bold text-sm">{c.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.mobile}</p>
                  {c.city && <p className="text-xs text-gray-400">{c.city}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${c.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {c.status}
                  </span>
                  <ChevronRight size={16} className="text-gray-300" />
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
      <div className="p-4 space-y-4">
        {/* Info card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <span className="text-indigo-700 font-bold text-2xl">{customer.name.charAt(0)}</span>
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">{customer.name}</h2>
              <p className="text-xs text-gray-400">#{customer.refNumber}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-block mt-0.5
                ${customer.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {customer.status}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <InfoRow icon={<Phone size={14} />} value={customer.mobile} />
            {customer.alternateMobile && <InfoRow icon={<Phone size={14} />} value={customer.alternateMobile} />}
            {customer.address && <InfoRow icon={<MapPin size={14} />} value={customer.address + (customer.city ? `, ${customer.city}` : "")} />}
          </div>
        </div>

        {/* Recent collections */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Recent Payments
          </h3>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 h-14 animate-pulse" />
              ))}
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CreditCard size={32} className="mx-auto mb-1 opacity-30" />
              <p className="text-sm">No payments yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {collections.map((col) => (
                <div key={col.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{fmt.currency(col.amount)}</p>
                    <p className="text-xs text-gray-400 capitalize">{col.paymentMode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{fmt.date(col.collectedAt)}</p>
                    {col.committeeName && <p className="text-xs text-indigo-500 truncate max-w-32">{col.committeeName}</p>}
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
    <div className="flex items-start gap-2 text-sm text-gray-600">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <span>{value}</span>
    </div>
  );
}
