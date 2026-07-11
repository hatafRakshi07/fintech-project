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
import { ArrowLeft, Plus, Users, Wallet, Ticket, Calendar, Banknote, Smartphone, Building2, CreditCard } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

const addMemberSchema = z.object({
  customerId: z.coerce.number().min(1, "Customer required"),
  tokenNumber: z.string().optional(),
});

const typeColors: Record<string, string> = {
  daily: "bg-blue-100 text-blue-700",
  weekly: "bg-purple-100 text-purple-700",
  monthly: "bg-emerald-100 text-emerald-700",
  festival: "bg-orange-100 text-orange-700",
  special: "bg-pink-100 text-pink-700",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const modeIcon: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-3 w-3" />,
  upi: <Smartphone className="h-3 w-3" />,
  bank: <Building2 className="h-3 w-3" />,
  card: <CreditCard className="h-3 w-3" />,
};

export default function CommitteeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

  const { data: committee, isLoading } = useGetCommittee(id);
  const { data: members } = useListCommitteeMembers(id);
  const { data: collections } = useListCollections({ committeeId: id, limit: 100 });
  const { data: customers } = useListCustomers({ limit: 200 });
  const addMember = useAddCommitteeMember();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading committee…</div>;
  if (!committee) return <div className="p-8">Committee not found.</div>;

  const poolSize = committee.installmentAmount * committee.memberLimit;
  const memberIds = new Set(members?.map((m) => m.customerId) ?? []);
  const availableCustomers = (customers?.data ?? []).filter((c) => !memberIds.has(c.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/committees">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{committee.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${typeColors[committee.type] ?? "bg-muted text-muted-foreground"}`}>
                {committee.type}
              </span>
              <Badge variant={committee.status === "active" ? "default" : committee.status === "completed" ? "secondary" : "destructive"}>
                {committee.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Branch: {committee.branchName}</p>
          </div>
        </div>

        <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
          <DialogTrigger asChild>
            <Button disabled={committee.status !== "active"}><Plus className="h-4 w-4 mr-2" /> Add Member</Button>
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
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.referenceNumber})</SelectItem>
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Ticket className="h-3 w-3" /> Installment</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0"><div className="text-xl font-bold">{formatCurrency(committee.installmentAmount)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Members</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold">{committee.currentMembers ?? 0} <span className="text-sm font-normal text-muted-foreground">/ {committee.memberLimit}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> Total Pool</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0"><div className="text-xl font-bold">{formatCurrency(poolSize)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Draw Date</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-sm font-semibold">
              {committee.drawDate ? new Date(committee.drawDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not set"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">
            Members ({new Set(members?.map(m => m.customerId) ?? []).size})
          </TabsTrigger>
          <TabsTrigger value="collections">Collections ({collections?.total ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Ref No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Token(s)</TableHead>
                    <TableHead className="pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!members?.length ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No members yet</TableCell></TableRow>
                  ) : (() => {
                    // Group by customerId — one row per customer, show all tokens
                    const grouped = new Map<number, { name: string; mobile: string | null; ref: string; tokens: string[]; status: string; customerId: number }>();
                    for (const m of members) {
                      if (!grouped.has(m.customerId)) {
                        grouped.set(m.customerId, {
                          customerId: m.customerId,
                          name: m.customerName,
                          mobile: m.customerMobile ?? null,
                          ref: (m as typeof m & { referenceNumber?: string }).referenceNumber ?? "",
                          tokens: [],
                          status: m.status ?? "active",
                        });
                      }
                      grouped.get(m.customerId)!.tokens.push(m.tokenNumber);
                    }
                    return [...grouped.values()].map((g) => (
                      <TableRow key={g.customerId} className="hover:bg-muted/50">
                        <TableCell className="pl-4 font-mono text-xs text-muted-foreground">{g.ref || "—"}</TableCell>
                        <TableCell>
                          <Link href={`/customers/${g.customerId}`}>
                            <span className="font-medium hover:underline cursor-pointer text-primary">{g.name}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{g.mobile ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {g.tokens.sort((a, b) => parseInt(a) - parseInt(b)).map(t => (
                              <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                                {t}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="pr-4">
                          <Badge variant={g.status === "active" ? "default" : "secondary"}>{g.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
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
                    <TableHead>Collector</TableHead>
                    <TableHead className="text-center">Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="pr-4">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!collections?.data?.length ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No collections yet</TableCell></TableRow>
                  ) : collections.data.map((col) => (
                    <TableRow key={col.id} className="hover:bg-muted/50">
                      <TableCell className="pl-4 font-medium">{col.customerName ?? `#${col.customerId}`}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{col.collectorName ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1 text-xs">{modeIcon[col.paymentMode]}{col.paymentMode.toUpperCase()}</Badge>
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
