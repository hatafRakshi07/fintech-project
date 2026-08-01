'use client';

import React, { useState, useMemo } from "react";
import { safeArray } from "@/lib/utils";
import {
  useListTokens,
  useCreateToken,
  useUpdateToken,
  useListCommittees,
  useListCustomers,
  getListTokensQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Plus,
  Ticket,
  ArrowRightLeft,
  Search,
  Users,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Grid,
  List,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";

const tokenSchema = z.object({
  customerId: z.coerce.number().min(1, "Customer is required"),
  committeeId: z.coerce.number().min(1, "Committee is required"),
  tokenNumber: z.string().optional(),
});

const transferSchema = z.object({
  transferToCustomerId: z.coerce.number().min(1, "Target customer is required"),
});

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  transferred: "secondary",
  closed: "destructive",
};

interface CustomerGroup {
  customerId: number;
  customerName: string;
  tokens: any[];
  activeCount: number;
  transferredCount: number;
  closedCount: number;
  committees: string[];
}

export default function TokensPage() {
  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [transferTokenId, setTransferTokenId] = useState<number | null>(null);

  const { role, user, isCustomer } = useRole();

  const { data: rawTokens, isLoading } = useListTokens({
    committeeId: committeeFilter !== "all" ? parseInt(committeeFilter, 10) : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    customerId: isCustomer ? user?.customerId ?? undefined : undefined,
  } as any);
  const { data: rawCommittees } = useListCommittees();
  const { data: customers } = useListCustomers({ limit: 200 });

  const tokens = safeArray<any>(rawTokens);
  const committees = safeArray<any>(rawCommittees);
  const customersList = safeArray<any>(customers);
  const createToken = useCreateToken();
  const updateToken = useUpdateToken();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof tokenSchema>>({
    resolver: zodResolver(tokenSchema),
    defaultValues: { customerId: 0, committeeId: 0, tokenNumber: "" },
  });

  const transferForm = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { transferToCustomerId: 0 },
  });

  const handleOpenIssueForCustomer = (custNameOrId?: number) => {
    if (custNameOrId) {
      form.setValue("customerId", custNameOrId);
    }
    setIsCreateOpen(true);
  };

  const onSubmit = (values: z.infer<typeof tokenSchema>) => {
    createToken.mutate(
      { data: { customerId: values.customerId, committeeId: values.committeeId, tokenNumber: values.tokenNumber || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Token issued successfully" });
          setIsCreateOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListTokensQueryKey() });
        },
        onError: () => toast({ title: "Failed to issue token", variant: "destructive" }),
      }
    );
  };

  const onTransfer = (values: z.infer<typeof transferSchema>) => {
    if (!transferTokenId) return;
    updateToken.mutate(
      { id: transferTokenId, data: { status: "transferred", transferToCustomerId: values.transferToCustomerId } },
      {
        onSuccess: () => {
          toast({ title: "Token transferred successfully" });
          setTransferTokenId(null);
          transferForm.reset();
          queryClient.invalidateQueries({ queryKey: getListTokensQueryKey() });
        },
        onError: () => toast({ title: "Transfer failed", variant: "destructive" }),
      }
    );
  };

  // Filter tokens based on search query
  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) return tokens;
    const q = searchQuery.toLowerCase().trim();
    return tokens.filter((t) => {
      const matchName = (t.customerName || "").toLowerCase().includes(q);
      const matchToken = (t.tokenNumber || "").toLowerCase().includes(q);
      const matchCommittee = (t.committeeName || "").toLowerCase().includes(q);
      return matchName || matchToken || matchCommittee;
    });
  }, [tokens, searchQuery]);

  // Group tokens by Customer
  const customerGroups = useMemo(() => {
    const map = new Map<string | number, CustomerGroup>();

    filteredTokens.forEach((t) => {
      const key = t.customerId ?? t.customerName ?? "unknown";
      if (!map.has(key)) {
        map.set(key, {
          customerId: t.customerId,
          customerName: t.customerName ?? `Customer #${t.customerId}`,
          tokens: [],
          activeCount: 0,
          transferredCount: 0,
          closedCount: 0,
          committees: [],
        });
      }
      const group = map.get(key)!;
      group.tokens.push(t);

      if (t.status === "active") group.activeCount++;
      else if (t.status === "transferred") group.transferredCount++;
      else if (t.status === "closed") group.closedCount++;

      if (t.committeeName && !group.committees.includes(t.committeeName)) {
        group.committees.push(t.committeeName);
      }
    });

    return Array.from(map.values());
  }, [filteredTokens]);

  const toggleCustomerExpanded = (key: string) => {
    setExpandedCustomers((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  // Summary Metrics
  const totalTokensCount = tokens.length;
  const activeTokensCount = tokens.filter((t) => t.status === "active").length;
  const totalCustomersCount = customerGroups.length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tokens</h1>
          <p className="text-muted-foreground">Manage committee participation tokens grouped by member.</p>
        </div>

        {!isCustomer && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => form.reset()}>
                <Plus className="h-4 w-4 mr-2" /> Issue Token
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Issue New Token</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ? field.value.toString() : undefined}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customersList.map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.referenceNumber || `#${c.id}`})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="committeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Committee</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ? field.value.toString() : undefined}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select committee" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {committees?.map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tokenNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token Number (optional — auto-generated if blank)</FormLabel>
                        <FormControl><Input placeholder="TK001" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={createToken.isPending}>
                      {createToken.isPending ? "Issuing..." : "Issue Token"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center space-x-3 bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border-purple-500/20">
          <div className="p-2.5 bg-purple-500/20 rounded-xl text-purple-600 dark:text-purple-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Members</p>
            <h3 className="text-xl font-bold">{totalCustomersCount}</h3>
          </div>
        </Card>

        <Card className="p-4 flex items-center space-x-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20">
          <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Tokens</p>
            <h3 className="text-xl font-bold">{totalTokensCount}</h3>
          </div>
        </Card>

        <Card className="p-4 flex items-center space-x-3 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20">
          <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Active Tokens</p>
            <h3 className="text-xl font-bold">{activeTokensCount}</h3>
          </div>
        </Card>

        <Card className="p-4 flex items-center space-x-3 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20">
          <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Avg per Member</p>
            <h3 className="text-xl font-bold">
              {totalCustomersCount > 0 ? (totalTokensCount / totalCustomersCount).toFixed(1) : "0"}
            </h3>
          </div>
        </Card>
      </div>

      {/* Transfer Dialog */}
      <Dialog open={transferTokenId !== null} onOpenChange={(o) => !o && setTransferTokenId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Token</DialogTitle>
          </DialogHeader>
          <Form {...transferForm}>
            <form onSubmit={transferForm.handleSubmit(onTransfer)} className="space-y-4">
              <FormField
                control={transferForm.control}
                name="transferToCustomerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer To Customer</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customersList.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.referenceNumber || `#${c.id}`})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={updateToken.isPending}>
                  {updateToken.isPending ? "Transferring..." : "Transfer"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Search, Filter & View Controls */}
      <Card>
        <CardHeader className="p-4 flex flex-col md:flex-row gap-3 border-b justify-between items-stretch md:items-center">
          <div className="flex flex-1 items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search member name or token #"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Committees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Committees</SelectItem>
                {committees?.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-end md:self-auto">
            <Button
              variant={viewMode === "grouped" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grouped")}
              className="text-xs font-semibold"
            >
              <Grid className="h-3.5 w-3.5 mr-1.5" /> Grouped by Person
            </Button>
            <Button
              variant={viewMode === "flat" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("flat")}
              className="text-xs font-semibold"
            >
              <List className="h-3.5 w-3.5 mr-1.5" /> Flat List
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading tokens...</div>
          ) : !filteredTokens.length ? (
            <div className="p-12 text-center text-muted-foreground">
              <Ticket className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-base">No tokens found</p>
              <p className="text-xs mt-1">Try adjusting your search query or filters.</p>
            </div>
          ) : viewMode === "grouped" ? (
            /* GROUPED BY PERSON / CUSTOMER VIEW */
            <div className="divide-y divide-border">
              {customerGroups.map((group) => {
                const groupKey = String(group.customerId || group.customerName);
                const isExpanded = expandedCustomers[groupKey] !== false; // default expanded

                return (
                  <div key={groupKey} className="transition-colors hover:bg-muted/20">
                    {/* Customer Group Header */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center space-x-3.5">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                          {group.customerName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-base text-foreground">{group.customerName}</h3>
                            <Badge variant="outline" className="text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200">
                              {group.tokens.length} {group.tokens.length === 1 ? "Token" : "Tokens"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {group.committees.length > 0
                              ? `Committees: ${group.committees.join(", ")}`
                              : "No committee linked"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 flex-wrap">
                        {/* Token Badges Pills */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {group.tokens.map((tok) => (
                            <Badge
                              key={tok.id}
                              variant={tok.status === "active" ? "secondary" : "outline"}
                              className="font-mono text-xs py-1 px-2.5 flex items-center gap-1 border-muted-foreground/30"
                              title={`${tok.committeeName || "Committee"} - ${tok.status}`}
                            >
                              <Ticket className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                              <span>{tok.tokenNumber}</span>
                              {tok.status !== "active" && (
                                <span className="text-[10px] text-muted-foreground uppercase">({tok.status})</span>
                              )}
                            </Badge>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                          {!isCustomer && group.customerId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => handleOpenIssueForCustomer(group.customerId)}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> Add Token
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleCustomerExpanded(groupKey)}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Tokens Sub-table when expanded */}
                    {isExpanded && (
                      <div className="bg-muted/30 border-t px-4 py-3">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent border-b">
                              <TableHead className="text-xs">Token #</TableHead>
                              <TableHead className="text-xs">Committee</TableHead>
                              <TableHead className="text-xs">Issued Date</TableHead>
                              <TableHead className="text-xs text-center">Status</TableHead>
                              <TableHead className="text-xs text-right" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.tokens.map((token) => (
                              <TableRow key={token.id} className="hover:bg-background/80">
                                <TableCell className="font-mono font-semibold text-sm">
                                  {token.tokenNumber}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {token.committeeName ?? `#${token.committeeId}`}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {new Date(token.createdAt).toLocaleDateString("en-IN")}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={statusVariant[token.status] ?? "secondary"} className="text-xs">
                                    {token.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {!isCustomer && token.status === "active" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => {
                                        setTransferTokenId(token.id);
                                        transferForm.reset();
                                      }}
                                    >
                                      <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Transfer
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* FLAT TABLE VIEW */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Token #</TableHead>
                    <TableHead>Customer / Member</TableHead>
                    <TableHead>Committee</TableHead>
                    <TableHead>Issued On</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="pr-4 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTokens.map((token) => (
                    <TableRow key={token.id} className="hover:bg-muted/50">
                      <TableCell className="pl-4 font-mono font-semibold">{token.tokenNumber}</TableCell>
                      <TableCell className="font-medium">{token.customerName ?? `#${token.customerId}`}</TableCell>
                      <TableCell>{token.committeeName ?? `#${token.committeeId}`}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(token.createdAt).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={statusVariant[token.status] ?? "secondary"}>{token.status}</Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {!isCustomer && token.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setTransferTokenId(token.id); transferForm.reset(); }}
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-1" /> Transfer
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
