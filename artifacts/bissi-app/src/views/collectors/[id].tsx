import React from "react";
import { useParams, Link } from "wouter";
import {
  useGetCollector,
  useGetCollectorPerformance,
  useListCollections,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  TrendingUp,
  Wallet,
  Target,
  Calendar,
  Banknote,
  Smartphone,
  Building2,
  CreditCard,
} from "lucide-react";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const modeIcon: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-3 w-3" />,
  upi: <Smartphone className="h-3 w-3" />,
  bank: <Building2 className="h-3 w-3" />,
  card: <CreditCard className="h-3 w-3" />,
};

export default function CollectorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);

  const { data: collector, isLoading } = useGetCollector(id);
  const { data: perf } = useGetCollectorPerformance(id);
  const { data: collections } = useListCollections({ collectorId: id, limit: 50 });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading collector…</div>;
  if (!collector) return <div className="p-8">Collector not found.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/collectors">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{collector.name}</h1>
            <Badge variant={collector.status === "active" ? "default" : "secondary"}>{collector.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {collector.mobile} {collector.email ? `· ${collector.email}` : ""} · Branch: {collector.branchName}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Collections", value: perf?.totalCollections ?? collector.totalCollections ?? 0, icon: TrendingUp, currency: false },
          { label: "Total Amount", value: perf?.totalAmount ?? collector.totalAmount ?? 0, icon: Wallet, currency: true },
          { label: "This Month", value: perf?.thisMonthAmount ?? 0, icon: Calendar, currency: true },
          { label: "Success Rate", value: `${((perf?.successRate ?? 0) * 100).toFixed(0)}%`, icon: Target, currency: false },
        ].map(({ label, value, icon: Icon, currency }) => (
          <Card key={label}>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                <Icon className="h-3 w-3" /> {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">
                {currency ? formatCurrency(value as number) : value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="trend">
        <TabsList>
          <TabsTrigger value="trend">Daily Trend</TabsTrigger>
          <TabsTrigger value="collections">Recent Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="trend" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">30-Day Collection Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {!perf?.dailyTrend?.length ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No trend data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={perf.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${v / 1000}k`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(l) => `Date: ${l}`} />
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Customer</TableHead>
                    <TableHead>Committee</TableHead>
                    <TableHead className="text-center">Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="pr-4">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!collections?.data?.length ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No collections found</TableCell></TableRow>
                  ) : collections.data.map((col) => (
                    <TableRow key={col.id} className="hover:bg-muted/50">
                      <TableCell className="pl-4 font-medium">{col.customerName ?? `#${col.customerId}`}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{col.committeeName ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1 text-xs">
                          {modeIcon[col.paymentMode]}{col.paymentMode.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">{formatCurrency(col.amount)}</TableCell>
                      <TableCell className="pr-4 text-sm text-muted-foreground">
                        {new Date(col.collectedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
