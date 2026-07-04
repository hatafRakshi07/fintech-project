import React, { useState } from "react";
import {
  useGetCollectionReport,
  useGetLoanReport,
  useListBranches,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, CreditCard, AlertTriangle, TrendingUp, Building2 } from "lucide-react";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

const today = new Date().toISOString().split("T")[0];
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

export default function ReportsPage() {
  const [tab, setTab] = useState("collections");

  // Collection report filters
  const [colStart, setColStart] = useState(firstOfMonth);
  const [colEnd, setColEnd] = useState(today);
  const [colBranch, setColBranch] = useState("all");

  // Loan report filters
  const [loanStart, setLoanStart] = useState(firstOfMonth);
  const [loanEnd, setLoanEnd] = useState(today);
  const [loanBranch, setLoanBranch] = useState("all");

  const { data: branches } = useListBranches();

  const { data: colReport, isLoading: colLoading } = useGetCollectionReport({
    startDate: colStart,
    endDate: colEnd,
    branchId: colBranch !== "all" ? parseInt(colBranch, 10) : undefined,
  });

  const { data: loanReport, isLoading: loanLoading } = useGetLoanReport({
    startDate: loanStart,
    endDate: loanEnd,
    branchId: loanBranch !== "all" ? parseInt(loanBranch, 10) : undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Analytics and performance insights.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="collections">Collection Report</TabsTrigger>
          <TabsTrigger value="loans">Loan Report</TabsTrigger>
        </TabsList>

        {/* ─── Collection Report ─── */}
        <TabsContent value="collections" className="space-y-6 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" className="w-40" value={colStart} onChange={(e) => setColStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" className="w-40" value={colEnd} onChange={(e) => setColEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Branch</label>
              <Select value={colBranch} onValueChange={setColBranch}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches?.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {colLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading report...</div>
          ) : colReport && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Collected", value: formatCurrency(colReport.totalAmount), icon: Wallet },
                  { label: "Transactions", value: colReport.totalCount, icon: TrendingUp },
                  { label: "Avg per Transaction", value: formatCurrency(colReport.totalCount > 0 ? colReport.totalAmount / colReport.totalCount : 0), icon: CreditCard },
                  { label: "Active Branches", value: colReport.byBranch?.length ?? 0, icon: Building2 },
                ].map(({ label, value, icon: Icon }) => (
                  <Card key={label}>
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Icon className="h-3 w-3" /> {label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="text-xl font-bold">{value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Trend */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Daily Collection Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {colReport.daily?.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={colReport.daily}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(l) => `Date: ${l}`} />
                          <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* By Payment Mode */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">By Payment Mode</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {colReport.byPaymentMode?.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={colReport.byPaymentMode}
                            dataKey="amount"
                            nameKey="mode"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ mode, percent }) => `${mode} ${(percent * 100).toFixed(0)}%`}
                          >
                            {colReport.byPaymentMode.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* By Branch Table */}
              {colReport.byBranch && colReport.byBranch.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Branch-wise Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Branch</TableHead>
                          <TableHead className="text-right">Transactions</TableHead>
                          <TableHead className="text-right pr-4">Amount Collected</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {colReport.byBranch.map((row) => (
                          <TableRow key={row.branchName}>
                            <TableCell className="pl-4 font-medium">{row.branchName}</TableCell>
                            <TableCell className="text-right">{row.count}</TableCell>
                            <TableCell className="text-right pr-4 font-semibold">{formatCurrency(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ─── Loan Report ─── */}
        <TabsContent value="loans" className="space-y-6 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" className="w-40" value={loanStart} onChange={(e) => setLoanStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" className="w-40" value={loanEnd} onChange={(e) => setLoanEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Branch</label>
              <Select value={loanBranch} onValueChange={setLoanBranch}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches?.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loanLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading report...</div>
          ) : loanReport && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Loans", value: loanReport.totalLoans, icon: CreditCard, currency: false },
                  { label: "Total Disbursed", value: formatCurrency(loanReport.totalDisbursed), icon: Wallet, currency: false },
                  { label: "Total Collected", value: formatCurrency(loanReport.totalCollected), icon: TrendingUp, currency: false },
                  { label: "Total Overdue", value: formatCurrency(loanReport.totalOverdue), icon: AlertTriangle, currency: false },
                ].map(({ label, value, icon: Icon }) => (
                  <Card key={label}>
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Icon className="h-3 w-3" /> {label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="text-xl font-bold">{value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* By Branch Chart */}
              {loanReport.byBranch && loanReport.byBranch.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Disbursed by Branch</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={loanReport.byBranch} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                          <YAxis type="category" dataKey="branchName" tick={{ fontSize: 11 }} width={90} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Branch-wise Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-4">Branch</TableHead>
                            <TableHead className="text-right">Loans</TableHead>
                            <TableHead className="text-right pr-4">Disbursed</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loanReport.byBranch.map((row) => (
                            <TableRow key={row.branchName}>
                              <TableCell className="pl-4 font-medium">{row.branchName}</TableCell>
                              <TableCell className="text-right">{row.count}</TableCell>
                              <TableCell className="text-right pr-4 font-semibold">{formatCurrency(row.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

