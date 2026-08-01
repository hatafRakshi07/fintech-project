'use client';

import React, { useState } from "react";
import { Link, useLocation } from "@/lib/router-adapter";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  FileSpreadsheet,
  Printer,
  ArrowLeft,
  Calendar,
  CreditCard,
  Download,
  Filter,
  Users,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface ReportPaymentEntry {
  id: string;
  loanId: string;
  customerName: string;
  mobileNumber: string;
  loanAmount: number;
  collectionPlan: string;
  paymentDate: string;
  amountDeposited: number;
  paymentMode: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

export default function DailyDiaryReportsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [reportType, setReportType] = useState<"OVERALL" | "DAILY" | "WEEKLY" | "MONTHLY">("OVERALL");

  const { data, isLoading } = useQuery<{
    success: boolean;
    reportType: string;
    totalCollected: number;
    totalEntries: number;
    payments: ReportPaymentEntry[];
  }>({
    queryKey: ["daily-diary-reports", reportType],
    queryFn: async () => {
      const res = await fetch(`/api/daily-diary/reports?type=${reportType}`);
      if (!res.ok) throw new Error("Failed to fetch reports data");
      return res.json();
    },
  });

  const payments = data?.payments || [];
  const totalCollected = data?.totalCollected || 0;

  // Export Excel function
  const handleExportExcel = () => {
    if (payments.length === 0) {
      toast({ title: "No Data", description: "No records to export for selected report.", variant: "destructive" });
      return;
    }

    const exportRows = payments.map((p) => ({
      "Customer Name": p.customerName,
      "Mobile Number": p.mobileNumber,
      "Loan Amount (₹)": p.loanAmount,
      "Collection Plan": p.collectionPlan,
      "Payment Date": p.paymentDate,
      "Amount Deposited (₹)": p.amountDeposited,
      "Payment Mode": p.paymentMode,
      "Notes": p.notes,
      "Recorded By": p.createdBy,
      "Timestamp": p.createdAt ? new Date(p.createdAt).toLocaleString() : "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${reportType}_Collection`);

    const fileName = `Daily_Diary_${reportType}_Collection_Report.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({ title: "Excel Downloaded", description: `Exported ${payments.length} records to ${fileName}` });
  };

  // Printable PDF view
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button
          variant="outline"
          className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white self-start"
          onClick={() => setLocation("/daily-diary")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Daily Diary
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white"
            onClick={handleExportExcel}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-400" />
            Export Excel
          </Button>

          <Button
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md"
            onClick={handlePrintPDF}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print PDF Report
          </Button>
        </div>
      </div>

      {/* Main Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-6 rounded-2xl border border-emerald-500/20 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-400" />
            Daily Diary Collection Reports & Ledgers
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Generate and export overall, daily, weekly, and monthly loan collection summaries.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-300 font-medium">Select Scope:</span>
          <Select
            value={reportType}
            onValueChange={(val: any) => setReportType(val)}
          >
            <SelectTrigger className="w-[160px] bg-slate-900 border-slate-700 text-slate-100">
              <SelectValue placeholder="Report Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OVERALL">Overall Collection</SelectItem>
              <SelectItem value="DAILY">Today's Collection</SelectItem>
              <SelectItem value="WEEKLY">This Week (7 Days)</SelectItem>
              <SelectItem value="MONTHLY">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Collection Total Summary Card */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-2 border-emerald-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Collection Report Total Summary — Scope: {reportType}
              </h2>
              <p className="text-xs text-slate-400">
                Detailed collection ledger breakdown showing total entries and collected amount.
              </p>
            </div>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-3 py-1">
            {payments.length} Transactions Found
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 font-semibold uppercase">Total Report Transactions</span>
            <span className="text-2xl font-bold text-white block mt-1">{payments.length}</span>
          </div>

          <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-4">
            <span className="text-xs text-emerald-400 font-semibold uppercase">Total Amount Collected</span>
            <span className="text-2xl font-bold text-emerald-400 block mt-1">
              ₹{totalCollected.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="bg-slate-900/90 border border-blue-500/40 rounded-xl p-4">
            <span className="text-xs text-blue-400 font-semibold uppercase font-medium">Selected Scope</span>
            <span className="text-xl font-bold text-blue-300 block mt-1">{reportType} REPORT</span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs text-slate-400 font-medium uppercase">Total Report Entries</span>
            <span className="text-2xl font-bold text-white block mt-1">{data?.totalEntries || 0}</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs text-slate-400 font-medium uppercase">Total Amount Collected</span>
            <span className="text-2xl font-bold text-emerald-400 block mt-1">
              ₹{totalCollected.toLocaleString('en-IN')}
            </span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs text-slate-400 font-medium uppercase">Active Filter</span>
            <Badge className="mt-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
              {reportType} COLLECTION REPORT
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Report Table */}
      <Card className="bg-slate-900 border-slate-800 shadow-xl">
        <CardHeader className="border-b border-slate-800 pb-4">
          <CardTitle className="text-lg font-bold text-white flex items-center justify-between">
            <span>{reportType} Collection Ledger</span>
            <span className="text-xs font-normal text-slate-400">Total: ₹{totalCollected.toLocaleString('en-IN')}</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading collection report...</div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No collection entries found for {reportType} scope.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Customer Name</th>
                    <th className="px-5 py-3">Mobile</th>
                    <th className="px-5 py-3">Payment Date</th>
                    <th className="px-5 py-3">Amount Deposited</th>
                    <th className="px-5 py-3">Payment Mode</th>
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3">Notes</th>
                    <th className="px-5 py-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-white">{p.customerName}</td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">{p.mobileNumber}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-200">{p.paymentDate}</td>
                      <td className="px-5 py-3.5 font-bold text-emerald-400">
                        ₹{p.amountDeposited.toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className="bg-slate-950 border-slate-800 text-slate-300 text-xs">
                          {p.paymentMode}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">{p.collectionPlan}</td>
                      <td className="px-5 py-3.5 text-slate-300">{p.notes || "-"}</td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">{p.createdBy}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-950 font-bold border-t-2 border-slate-800 text-slate-100">
                  <tr>
                    <td colSpan={3} className="px-5 py-4 text-slate-300">TOTAL {reportType} COLLECTION</td>
                    <td className="px-5 py-4 text-emerald-400 text-base">
                      ₹{totalCollected.toLocaleString('en-IN')}
                    </td>
                    <td colSpan={4} className="px-5 py-4 text-right text-slate-400">
                      Total Entries: {payments.length}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
