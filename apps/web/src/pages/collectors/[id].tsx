import React from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { safeArray } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, TrendingUp, Wallet, Calendar, Phone, MapPin, Gift, CreditCard, Ticket,
} from "lucide-react";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function CollectorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";  // UUID

  const { data: customer, isLoading } = useQuery<any>({
    queryKey: ["collector-detail", id],
    queryFn: () => api.get(`/customers/${id}`),
    enabled: !!id && id.length > 10,
  });

  const { data: historyData } = useQuery<any>({
    queryKey: ["collector-history", id],
    queryFn: () => api.get(`/customers/${id}/history`),
    enabled: !!id && id.length > 10,
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading member profile…</div>;
  if (!customer) return (
    <div className="p-8">
      <Link href="/collectors"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
      <p className="mt-4 text-muted-foreground">Member not found.</p>
    </div>
  );

  const tokens = safeArray<any>(historyData?.tokens ?? historyData?.memberships);
  const collections = safeArray<any>(historyData?.collections);
  const gifts = safeArray<any>(historyData?.gifts);
  const lotteries = safeArray<any>(historyData?.lotteries);

  const totalPaid = historyData?.summary?.totalPaid || 0;
  const totalCollections = historyData?.summary?.totalCollections || collections.length;
  const luckyWins = historyData?.summary?.luckyWins || lotteries.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/collectors">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
            <Badge variant="outline">{customer.status || "Active"}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
            {customer.mobile && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{customer.mobile}</span>}
            {customer.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{customer.address}</span>}
            {(customer.referenceNumber || customer.reference_number) && (
              <span>Ref: {customer.referenceNumber || customer.reference_number}</span>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" />Total Payments</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0"><div className="text-xl font-bold">{totalCollections}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" />Amount Paid</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0"><div className="text-xl font-bold">{formatCurrency(totalPaid)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Ticket className="h-3 w-3" />Active Tokens</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0"><div className="text-xl font-bold">{tokens.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Gift className="h-3 w-3" />Lucky Wins</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0"><div className="text-xl font-bold text-amber-600">{luckyWins}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tokens">
        <TabsList>
          <TabsTrigger value="tokens">Tokens ({tokens.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({totalCollections})</TabsTrigger>
          <TabsTrigger value="gifts">Gifts ({gifts.length})</TabsTrigger>
          <TabsTrigger value="lucky">Lucky ({lotteries.length})</TabsTrigger>
        </TabsList>

        {/* Tokens Tab */}
        <TabsContent value="tokens" className="mt-4">
          {tokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No bissi tokens found.</div>
          ) : (
            <div className="grid gap-3">
              {tokens.map((t: any) => (
                <Card key={t.id || t.tokenId || t.tokenNumber}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-primary">Token #{t.tokenNumber || t.displayToken || "—"}</span>
                        <Badge variant={t.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">{t.status || "Active"}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{t.committeeName || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(t.installmentAmount || 0)}/month</p>
                      {t.pendingThisMonth !== undefined && (
                        <Badge variant={t.pendingThisMonth ? "destructive" : "outline"} className="text-xs mt-1">
                          {t.pendingThisMonth ? "Pending this month" : "Paid this month"}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {collections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No payment records found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Committee</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collections.slice(0, 100).map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">{c.date?.slice(0, 10) || c.collectedAt?.slice(0, 10) || "—"}</TableCell>
                        <TableCell className="font-bold text-emerald-600">{formatCurrency(c.amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.committeeName || "—"}</TableCell>
                        <TableCell>#{c.tokenNumber || "—"}</TableCell>
                        <TableCell className="text-xs">{c.paymentMode || "Cash"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gifts Tab */}
        <TabsContent value="gifts" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {gifts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No gift records found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gift / Item</TableHead>
                      <TableHead>Committee</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gifts.map((g: any) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.giftName || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{g.committeeName || "—"}</TableCell>
                        <TableCell>#{g.tokenNumber || "—"}</TableCell>
                        <TableCell className="text-sm">{g.date?.slice(0, 10) || "—"}</TableCell>
                        <TableCell><Badge variant="default" className="text-xs">{g.status || "given"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lucky Tab */}
        <TabsContent value="lucky" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {lotteries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No lucky draw wins found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Committee</TableHead>
                      <TableHead>Reward</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotteries.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm">{l.date?.slice(0, 10) || "—"}</TableCell>
                        <TableCell className="font-mono">#{l.tokenNumber || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.committeeName || "—"}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">{l.rewardDescription || "Lucky"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
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
