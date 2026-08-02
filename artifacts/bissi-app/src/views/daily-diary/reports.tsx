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
    paymentsCount: number;
    payments: ReportPaymentEntry[];
  }>({
    queryKey: ["daily-diary-reports", reportType],
    queryFn: async () => {
      const res = await fetch(`/api/daily-diary/reports?type=${reportType}`);
      if (!res.ok) throw new Error("Failed to load collection reports");
      return res.json();
    },
  });

  const payments = data?.payments || [];
  const totalCollected = data?.totalCollected || 0;

  // Export to Excel
  const handleExportExcel = () => {
    if (payments.length === 0) {
      toast({ title: "No Data", description: "No collection records available for export", variant: "destructive" });
      return;
    }

    const exportRows = payments.map((p) => ({
      "Payment ID": p.id,
      "Customer Name": p.customerName,
      "Mobile": p.mobileNumber,
      "Loan Amount": p.loanAmount,
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
          className="border-border text-foreground hover:bg-muted self-start"
          onClick={() => setLocation("/daily-diary")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Daily Diary
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-muted"
            onClick={handleExportExcel}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
            Export Excel
          </Button>

          <Button
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
            onClick={handlePrintPDF}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print PDF Report
          </Button>
        </div>
      </div>

      {/* Main Banner — Matches SKA Brand Theme */}
      <Card className="bg-card border border-border/80 p-6 rounded-2xl shadow-sm text-card-foreground flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <FileText className="h-6 w-6 text-emerald-600" />
            Daily Diary Collection Reports & Ledgers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate and export overall, daily, weekly, and monthly loan collection summaries.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-muted/40 p-2.5 rounded-xl border border-border">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-foreground font-medium">Select Scope:</span>
          <Select
            value={reportType}
            onValueChange={(val: any) => setReportType(val)}
          >
            <SelectTrigger className="w-[160px] bg-background border-input text-foreground">
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
      </Card>

      {/* Collection Total Summary Card */}
      <Card className="bg-card border border-border/80 shadow-sm rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl border border-emerald-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Collection Report Total Summary — Scope: {reportType}
              </h2>
              <p className="text-xs text-muted-foreground">
                Detailed collection ledger breakdown showing total entries and collected amount.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-xs px-3 py-1">
            {payments.length} Transactions Found
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-muted/40 border border-border/60 rounded-xl p-4">
            <span className="text-xs text-muted-foreground font-semibold uppercase">Total Report Transactions</span>
            <span className="text-2xl font-bold text-foreground block mt-1">{payments.length}</span>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-4">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold uppercase">Total Amount Collected</span>
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 block mt-1">
              ₹{totalCollected.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="bg-blue-500/5 border border-blue-200 dark:border-blue-900/40 rounded-xl p-4">
            <span className="text-xs text-blue-700 dark:text-blue-400 font-semibold uppercase font-medium">Selected Scope</span>
            <span className="text-xl font-bold text-blue-700 dark:text-blue-400 block mt-1">{reportType}</span>
          </div>
        </div>
      </Card>

      {/* Transactions Data Table */}
      <Card className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20 pb-4">
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Detailed Collection Transactions Ledger
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading collection report data...</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm font-medium">No collection deposits found for {reportType} scope.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/40 uppercase border-b border-border font-semibold">
                  <tr>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Mobile</th>
                    <th className="px-5 py-3">Payment Date</th>
                    <th className="px-5 py-3">Amount Deposited</th>
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3">Mode</th>
                    <th className="px-5 py-3">Notes</th>
                    <th className="px-5 py-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-foreground">
                        <Link href={`/daily-diary/${p.loanId}`} className="hover:underline text-amber-600 dark:text-amber-400">
                          {p.customerName}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{p.mobileNumber}</td>
                      <td className="px-5 py-3.5 font-medium text-foreground">{p.paymentDate}</td>
                      <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                        + ₹{p.amountDeposited.toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className="bg-background border-border text-foreground font-normal">
                          {p.collectionPlan}
                        </Badge>
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
    </div>
  );
}
