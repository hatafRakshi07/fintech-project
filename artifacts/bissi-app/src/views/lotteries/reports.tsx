'use client';

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  Gift,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "@/lib/router-adapter";

export default function LotteryReportsPage() {
  const [, setLocation] = useLocation();

  const [reportType, setReportType] = useState<"LOTTERY_WISE" | "CUSTOMER_WISE" | "PENDING" | "COLLECTED" | "BISSI_WISE">("LOTTERY_WISE");
  const [bissiFilter, setBissiFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["lottery-reports", reportType, bissiFilter],
    queryFn: async () => {
      const res = await fetch(`/api/lottery/reports?type=${reportType}&bissi=${bissiFilter}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });

  const gifts = reportData?.gifts || [];

  const filteredGifts = gifts.filter((g: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      g.customerName?.toLowerCase().includes(term) ||
      g.tokenNumber?.toLowerCase().includes(term) ||
      g.giftName?.toLowerCase().includes(term) ||
      g.mobileNumber?.toLowerCase().includes(term) ||
      g.bissiName?.toLowerCase().includes(term)
    );
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            onClick={() => setLocation("/lotteries")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              Lottery Gift Reports & Analytics
            </h1>
            <p className="text-xs text-slate-400">
              Generate & print complete reports: Lottery-wise, Customer-wise, Pending, Collected, & Bissi-wise.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <Button
            variant="outline"
            className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-2 text-blue-400" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium block">Report Category</span>
              <Select value={reportType} onValueChange={(val: any) => setReportType(val)}>
                <SelectTrigger className="w-[200px] bg-slate-950 border-slate-800 text-slate-200 text-xs font-semibold">
                  <SelectValue placeholder="Report Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOTTERY_WISE">Lottery Wise Gift Report</SelectItem>
                  <SelectItem value="CUSTOMER_WISE">Customer Wise Gift Report</SelectItem>
                  <SelectItem value="PENDING">Pending Gift Report</SelectItem>
                  <SelectItem value="COLLECTED">Collected Gift Report</SelectItem>
                  <SelectItem value="BISSI_WISE">Bissi Wise Lottery Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium block">Bissi Scheme</span>
              <Select value={bissiFilter} onValueChange={setBissiFilter}>
                <SelectTrigger className="w-[180px] bg-slate-950 border-slate-800 text-slate-200 text-xs">
                  <SelectValue placeholder="Bissi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Bissi Schemes</SelectItem>
                  <SelectItem value="Sanwariya Seth">Sanwariya Seth</SelectItem>
                  <SelectItem value="Pyare Mohan">Pyare Mohan</SelectItem>
                  <SelectItem value="Hare Ka Sahara">Hare Ka Sahara</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search Name, Token, Gift..."
              className="pl-8 bg-slate-950 border-slate-800 text-slate-200 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Report Summary Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-4">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Gifts Logged</span>
            <span className="text-2xl font-bold text-amber-400 block mt-1">{reportData?.totalGifts || 0}</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-4">
            <span className="text-xs text-emerald-400 uppercase font-semibold">Collected Count</span>
            <span className="text-2xl font-bold text-emerald-400 block mt-1">{reportData?.collectedCount || 0}</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-4">
            <span className="text-xs text-amber-400 uppercase font-semibold">Pending Count</span>
            <span className="text-2xl font-bold text-amber-400 block mt-1">{reportData?.pendingCount || 0}</span>
          </CardContent>
        </Card>
      </div>

      {/* Printable Report Table */}
      <Card className="bg-slate-900 border-slate-800 shadow-xl">
        <CardHeader className="border-b border-slate-800 pb-4">
          <CardTitle className="text-lg font-bold text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-400" />
              {reportType.replace("_", " ")} Summary Sheet
            </span>
            <span className="text-xs font-normal text-slate-400">Total Entries: {filteredGifts.length}</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading report dataset...</div>
          ) : filteredGifts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No matching lottery gift records found for the selected report filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Bissi / Session</th>
                    <th className="px-4 py-3">Lottery Date</th>
                    <th className="px-4 py-3">Token #</th>
                    <th className="px-4 py-3">Customer Name</th>
                    <th className="px-4 py-3">Gift Won</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Collection Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredGifts.map((g: any) => (
                    <tr key={g.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-100">{g.bissiName}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{g.lotteryDate}</td>
                      <td className="px-4 py-3 font-black text-amber-400">#{g.tokenNumber}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-white block">{g.customerName}</span>
                        <span className="text-xs text-slate-400 block">{g.mobileNumber}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-100">{g.giftName}</td>
                      <td className="px-4 py-3">
                        {g.status === "Collected" ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                            Collected
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs">
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{g.collectionDate || "-"}</td>
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
