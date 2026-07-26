import React from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "@/lib/api";
import { safeArray } from "@/lib/utils";
import Header from "@/components/Header";
import { Download } from "lucide-react";
import { exportToExcel } from "@/lib/excel";

export default function CustomerHistoryPage() {
  const { id } = useParams(); // customer id
  const { data: rawHistory, isLoading, error } = useQuery<any[]>({
    queryKey: ["customer-history", id],
    queryFn: () => api.get(`/customers/${id}/history`),
    enabled: !!id,
  });
  const historyList = safeArray<any>(rawHistory);

  const handleExport = () => {
    if (historyList.length > 0) {
      exportToExcel({ History: historyList }, `customer_${id}_history`);
    }
  };

  return (
    <>
      <Header title="Customer Full History" back={true} />
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950 rounded-lg shadow hover:bg-amber-400"
        >
          <Download size={16} /> Export to Excel
        </button>
        {isLoading && <p>Loading...</p>}
        {error && <p className="text-red-500">Failed to load history.</p>}
        {historyList.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border border-border rounded-lg bg-card">
              <thead className="bg-slate-100 dark:bg-slate-800/40">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold">Date &amp; Time</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">Amount</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">Payment Mode</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">Committee</th>
                  <th className="px-3 py-2 text-left text-xs font-bold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((h) => (
                  <tr key={h.id} className="border-t border-border dark:border-slate-700/30">
                    <td className="px-3 py-1 text-xs">{fmt.date(h.collectedAt)} {new Date(h.collectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-3 py-1 text-xs">{fmt.currency(h.amount)}</td>
                    <td className="px-3 py-1 text-xs">{h.paymentMode}</td>
                    <td className="px-3 py-1 text-xs">{h.committeeName || "—"}</td>
                    <td className="px-3 py-1 text-xs truncate max-w-xs">{h.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
