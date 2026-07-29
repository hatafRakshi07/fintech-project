import React, { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetCommittee,
  useListCommitteeMembers,
  useAddCommitteeMember,
  useListCustomers,
  useListCollections,
  getListCommitteeMembersQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Plus, Users, Wallet, Ticket, Calendar, Banknote, Smartphone, Building2, CreditCard, Search, Sparkles, Phone, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { safeArray } from "@/lib/utils";

const addMemberSchema = z.object({
  customerId: z.coerce.number().min(1, "Customer required"),
  tokenNumber: z.string().optional(),
});

const typeColors: Record<string, string> = {
  daily: "bg-blue-500/10 text-blue-600 border-blue-200",
  weekly: "bg-purple-500/10 text-purple-600 border-purple-200",
  monthly: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  festival: "bg-amber-500/10 text-amber-600 border-amber-200",
  special: "bg-pink-500/10 text-pink-600 border-pink-200",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const modeIcon: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-3.5 w-3.5 text-emerald-600" />,
  upi: <Smartphone className="h-3.5 w-3.5 text-blue-600" />,
  bank: <Building2 className="h-3.5 w-3.5 text-purple-600" />,
  card: <CreditCard className="h-3.5 w-3.5 text-indigo-600" />,
};

function getInitials(name: string) {
  if (!name) return "CU";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function CommitteeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: committee, isLoading } = useGetCommittee(id);
  const { data: rawMembers } = useListCommitteeMembers(id);
  const { data: rawCollections } = useListCollections({ committeeId: id, limit: 200 });
  const { data: rawCustomers } = useListCustomers({ limit: 500 });
  
  const addMember = useAddCommitteeMember();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const members = safeArray<any>(rawMembers);
  const collections = safeArray<any>(rawCollections);
  const customers = safeArray<any>(rawCustomers);

  const form = useForm<z.infer<typeof addMemberSchema>>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { customerId: 0, tokenNumber: "" },
  });

  const onAddMember = (values: z.infer<typeof addMemberSchema>) => {
    addMember.mutate(
      { id, data: { customerId: values.customerId, tokenNumber: values.tokenNumber || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Member added successfully" });
          setIsAddMemberOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListCommitteeMembersQueryKey(id) });
        },
        onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return <div className="p-8 text-muted-foreground flex items-center justify-center min-h-[300px]">Loading committee details…</div>;
  if (!committee) return <div className="p-8 text-center text-muted-foreground">Committee not found.</div>;

  const poolSize = (committee.installmentAmount || 0) * (committee.memberLimit || 100);
  const memberIds = new Set(members.map((m) => m.customerId));
  const availableCustomers = customers.filter((c) => !memberIds.has(c.id));

  // Group members by customer
  const grouped = new Map<number, { name: string; mobile: string | null; ref: string; tokens: { number: string; status: string }[]; customerId: number }>();
  for (const m of members) {
    const custId = m.customerId || m.id;
    if (!grouped.has(custId)) {
      grouped.set(custId, {
        customerId: custId,
        name: m.customerName || `Customer #${custId}`,
        mobile: m.customerMobile || null,
        ref: m.customerReferenceNumber || `CUST-${custId}`,
        tokens: [],
      });
    }
    const tokenNum = m.tokenNumber || m.token_number || String(m.id);
    grouped.get(custId)!.tokens.push({
      number: tokenNum,
      status: m.status || "active",
    });
  }

  // Filter grouped items
  const allGroupedList = [...grouped.values()];
  const filteredGrouped = allGroupedList.filter((g) => {
    const matchesSearch =
      !searchQuery ||
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.mobile && g.mobile.includes(searchQuery)) ||
      (g.ref && g.ref.toLowerCase().includes(searchQuery.toLowerCase())) ||
      g.tokens.some((t) => t.number.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" ||
      g.tokens.some((t) => t.status === statusFilter);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/committees">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{committee.name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border capitalize ${typeColors[committee.type] ?? "bg-muted text-muted-foreground"}`}>
                {committee.type} Bissi
              </span>
              <Badge variant={committee.status === "active" ? "default" : committee.status === "completed" ? "secondary" : "destructive"} className="px-2.5 py-0.5">
                {committee.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <span>Branch: <strong className="text-foreground font-medium">{committee.branchName || "Shree Krishna Associate"}</strong></span>
              <span>•</span>
              <span>Total Tokens: <strong className="text-foreground font-medium">{members.length}</strong></span>
            </p>
          </div>
        </div>

        <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
          <DialogTrigger asChild>
            <Button disabled={committee.status !== "active"} className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Member to Committee</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onAddMember)} className="space-y-4">
                <FormField control={form.control} name="customerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableCustomers.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.referenceNumber || c.mobile})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={addMember.isPending}>
                    {addMember.isPending ? "Adding…" : "Add Member"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Monthly Installment</span>
              <Ticket className="h-4 w-4 text-primary opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-foreground">{formatCurrency(committee.installmentAmount)}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Per Token / Month</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Total Members</span>
              <Users className="h-4 w-4 text-blue-600 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-foreground">
              {members.length} <span className="text-sm font-normal text-muted-foreground">/ {committee.memberLimit}</span>
            </div>
            <div className="w-full bg-muted h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${Math.min(100, (members.length / (committee.memberLimit || 1)) * 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Total Pool Size</span>
              <Wallet className="h-4 w-4 text-emerald-600 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-emerald-600">{formatCurrency(poolSize)}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Full Maturity Pool Value</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Draw Status</span>
              <Calendar className="h-4 w-4 text-amber-600 opacity-80" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-bold text-foreground">
              {committee.drawDate ? new Date(committee.drawDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Monthly Draw"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Regular Draw Schedule</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Controls */}
      <Tabs defaultValue="members" className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="members" className="px-4 font-semibold">
              Members ({allGroupedList.length})
            </TabsTrigger>
            <TabsTrigger value="collections" className="px-4 font-semibold">
              Collections ({collections.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search member, mobile, token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tokens</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="lucky">Lucky Winners</SelectItem>
                <SelectItem value="out">Out / Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Members Tab Content */}
        <TabsContent value="members" className="mt-2">
          <Card className="border shadow-sm">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-5 w-[140px]">Ref No.</TableHead>
                    <TableHead className="min-w-[200px]">Customer</TableHead>
                    <TableHead className="w-[150px]">Mobile</TableHead>
                    <TableHead className="w-[150px]">Tokens Owned</TableHead>
                    <TableHead className="pr-5">Token Details & Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGrouped.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        No members matching filter criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredGrouped.map((g) => {
                      const totalTokens = g.tokens.length;
                      const luckyCount = g.tokens.filter((t) => t.status === "lucky").length;

                      return (
                        <TableRow key={g.customerId} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="pl-5 font-mono text-xs font-semibold text-muted-foreground">
                            {g.ref || `CUST-${g.customerId}`}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shadow-xs">
                                {getInitials(g.name)}
                              </div>
                              <div>
                                <Link href={`/customers/${g.customerId}`}>
                                  <span className="font-semibold text-sm hover:underline cursor-pointer text-foreground hover:text-primary transition-colors">
                                    {g.name}
                                  </span>
                                </Link>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            {g.mobile ? (
                              <a href={`tel:${g.mobile}`} className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
                                <Phone className="h-3 w-3 text-muted-foreground/70" />
                                {g.mobile}
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className="font-mono text-xs font-bold bg-primary/10 text-primary border-0">
                                {totalTokens} {totalTokens === 1 ? "Token" : "Tokens"}
                              </Badge>
                              {luckyCount > 0 && (
                                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1">
                                  <Sparkles className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> {luckyCount} Lucky
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="pr-5">
                            <div className="flex flex-wrap items-center gap-1.5 py-1">
                              {g.tokens.map((t) => {
                                const isLucky = t.status === "lucky";
                                const isOut = t.status === "out" || t.status === "closed";
                                return (
                                  <span
                                    key={t.number}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold border transition-all shadow-2xs ${
                                      isLucky
                                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/50 ring-1 ring-amber-400/20"
                                        : isOut
                                        ? "bg-muted text-muted-foreground border-muted-foreground/20"
                                        : "bg-card text-foreground border-border hover:border-primary/40"
                                    }`}
                                  >
                                    <span className="text-primary font-black">#{t.number}</span>
                                    {isLucky && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans font-semibold">✨ Lucky</span>}
                                    {!isLucky && !isOut && <span className="text-[10px] text-muted-foreground font-sans font-normal">Active</span>}
                                    {isOut && <span className="text-[10px] text-muted-foreground font-sans font-normal">Out</span>}
                                  </span>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Collections Tab Content */}
        <TabsContent value="collections" className="mt-2">
          <Card className="border shadow-sm">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-5">Receipt</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Collector</TableHead>
                    <TableHead className="text-center">Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="pr-5 text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No collections recorded yet for this committee.
                      </TableCell>
                    </TableRow>
                  ) : (
                    collections.map((col) => (
                      <TableRow key={col.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="pl-5 font-mono text-xs font-semibold text-muted-foreground">
                          {col.receiptNumber || `REC-${col.id}`}
                        </TableCell>
                        <TableCell className="font-semibold text-sm text-foreground">
                          {col.customerName || `#${col.customerId}`}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {col.collectorName || "Admin Collector"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="gap-1 text-xs capitalize bg-card">
                            {modeIcon[col.paymentMode] || <Banknote className="h-3.5 w-3.5" />}
                            {col.paymentMode || "Cash"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-black text-emerald-600 text-sm">
                          {formatCurrency(col.amount)}
                        </TableCell>
                        <TableCell className="pr-5 text-right text-xs font-mono text-muted-foreground">
                          {col.collectedAt
                            ? new Date(col.collectedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
