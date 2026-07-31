import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as xlsx from "xlsx";

export default function PurchaseLedgerPage() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const { data: response, isLoading } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["ledger", "purchase", dateRange],
    queryFn: () => {
      let query = "";
      if (dateRange.start) query += `?startDate=${dateRange.start}`;
      if (dateRange.end) query += `${query ? '&' : '?'}endDate=${dateRange.end}`;
      return customFetch(`/v2/ledger/purchase${query}`);
    }
  });

  const transactions = response?.data || [];
  const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);

  const exportToExcel = () => {
    if (transactions.length === 0) return;
    
    const ws = xlsx.utils.json_to_sheet(transactions.map(t => ({
      "Date": new Date(t.date).toLocaleDateString(),
      "Category": t.category,
      "Supplier/Customer": t.customerName || "-",
      "Phone": t.customerPhone || "-",
      "Notes": t.notes || "-",
      "Type": t.type,
      "Amount": parseFloat(t.amount)
    })));
    
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Purchase Ledger");
    xlsx.writeFile(wb, `Purchase_Ledger_${new Date().getTime()}.xlsx`);
    
    toast({ title: "Exported successfully", description: "Your file is downloading." });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingDown className="text-rose-500 h-6 w-6" />
            Purchase Ledger
          </h1>
          <p className="text-muted-foreground">View all gifts, prizes, settlements, and refunds distributed.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input 
              type="date" 
              className="border p-2 rounded text-sm"
              value={dateRange.start}
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
            <span className="text-gray-400">to</span>
            <input 
              type="date" 
              className="border p-2 rounded text-sm"
              value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
          <Button onClick={exportToExcel} variant="outline" className="flex gap-2">
            <Download className="w-4 h-4" /> Export Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-rose-50/50 border-rose-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-rose-800">Total Purchased / Distributed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-900">
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading ledger...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Customer/Party</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No purchases found in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap">{new Date(t.date).toLocaleString()}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                            {t.category}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{t.customerName || "-"}</div>
                          <div className="text-xs text-gray-500">{t.customerPhone}</div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-xs truncate">{t.notes || "-"}</TableCell>
                        <TableCell className="text-right font-semibold text-rose-600">
                          -{parseFloat(t.amount).toLocaleString('en-IN')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
