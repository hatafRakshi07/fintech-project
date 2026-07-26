import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, AlertCircle, Ticket, Users } from "lucide-react";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

export default function DashboardV2Page() {
  const [dateFilter, setDateFilter] = useState("today");
  
  // Convert friendly filter to exact dates for API
  // Simplification for UI prototype
  const getDates = () => {
    const today = new Date().toISOString();
    return `?startDate=${today}&endDate=${today}`;
  };

  const { data: response, isLoading } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["dashboard", "v2-summary", dateFilter],
    queryFn: () => customFetch(`/v2/dashboard/summary${getDates()}`),
  });

  const schemesData = response?.data || [];

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Operational Dashboard</h1>
          <p className="text-muted-foreground text-sm">Real-time overview of all active Bissi schemes.</p>
        </div>
        <div className="w-48">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Select Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="custom">Custom Date Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground">Loading dashboard data...</div>
      ) : schemesData.length === 0 ? (
        <div className="h-40 flex flex-col items-center justify-center text-muted-foreground bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <p>No active Bissi schemes found.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {schemesData.map((scheme) => (
            <div key={scheme.schemeId} className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-indigo-900">{scheme.schemeName}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold">
                  {scheme.schemeCode}
                </span>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* BOX 1: Collected Amount */}
                <Link href={`/collections?schemeId=${scheme.schemeId}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer bg-emerald-50/50 border-emerald-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-800">Collected Amount</CardTitle>
                      <Wallet className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-emerald-900">{formatCurrency(scheme.boxes.collectedAmount)}</div>
                    </CardContent>
                  </Card>
                </Link>

                {/* BOX 2: Due Amount */}
                <Link href={`/pending?schemeId=${scheme.schemeId}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer bg-rose-50/50 border-rose-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-rose-800">Due Amount</CardTitle>
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-rose-900">{formatCurrency(scheme.boxes.dueAmount)}</div>
                    </CardContent>
                  </Card>
                </Link>

                {/* BOX 3: Due Tokens */}
                <Link href={`/tokens/pending?schemeId=${scheme.schemeId}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer bg-amber-50/50 border-amber-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-amber-800">Due Tokens</CardTitle>
                      <Ticket className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-900">{scheme.boxes.dueTokens}</div>
                    </CardContent>
                  </Card>
                </Link>

                {/* BOX 4: Members */}
                <Link href={`/memberships?schemeId=${scheme.schemeId}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer bg-blue-50/50 border-blue-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-blue-800">Members</CardTitle>
                      <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-900">{scheme.boxes.membersCount}</div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
