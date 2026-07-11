import React, { useState } from "react";
import { Link } from "wouter";
import {
  useListLoans,
  useCreateLoan,
  useUpdateLoan,
  useGetLoanSummary,
  useListCustomers,
  useListBranches,
  getListLoansQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, CreditCard, Wallet, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

const loanSchema = z.object({
  customerId: z.coerce.number().min(1, "Customer is required"),
  principalAmount: z.coerce.number().min(1000, "Minimum ₹1,000"),
  interestRate: z.coerce.number().min(0.1, "Rate required").max(100),
  interestType: z.enum(["flat", "reducing"]),
  tenure: z.coerce.number().min(1, "Minimum 1 month").max(360),
  branchId: z.coerce.number().min(1, "Branch is required"),
  purpose: z.string().optional(),
});

const statusBadge: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "secondary",
  active: "default",
  closed: "secondary",
  rejected: "destructive",
  overdue: "destructive",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function LoansPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: loans, isLoading } = useListLoans({
    status: statusFilter !== "all" ? statusFilter : undefined,
    page,
    limit: 20,
  });
  const { data: summary } = useGetLoanSummary();
  const { data: customers } = useListCustomers({ limit: 200 });
  const { data: branches } = useListBranches();

  const createLoan = useCreateLoan();
  const updateLoan = useUpdateLoan();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof loanSchema>>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      customerId: 0,
      principalAmount: 10000,
      interestRate: 12,
      interestType: "flat",
      tenure: 12,
      branchId: 0,
      purpose: "",
    },
  });

  const onSubmit = (values: z.infer<typeof loanSchema>) => {
    createLoan.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Loan application submitted" });
          setIsCreateOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListLoansQueryKey() });
        },
        onError: () => toast({ title: "Failed to create loan", variant: "destructive" }),
      }
    );
  };

  const approveLoan = (id: number) => {
    updateLoan.mutate(
      { id, data: { status: "active", disbursedAt: new Date().toISOString() } },
      {
        onSuccess: () => {
          toast({ title: "Loan approved and disbursed" });
          queryClient.invalidateQueries({ queryKey: getListLoansQueryKey() });
        },
      }
    );
  };

  const rejectLoan = (id: number) => {
    updateLoan.mutate(
      { id, data: { status: "rejected" } },
      {
        onSuccess: () => {
          toast({ title: "Loan rejected" });
          queryClient.invalidateQueries({ queryKey: getListLoansQueryKey() });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loans</h1>
          <p className="text-muted-foreground">Manage loan applications, approvals and EMI schedules.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Loan</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Loan Application</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers?.data?.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.referenceNumber})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="principalAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Principal (₹)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tenure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenure (months)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="interestRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interest Rate (%)</FormLabel>
                        <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="interestType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interest Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="flat">Flat</SelectItem>
                            <SelectItem value="reducing">Reducing Balance</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branches?.map((b) => (
                            <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose (optional)</FormLabel>
                      <FormControl><Input placeholder="Business, Medical, Education…" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createLoan.isPending}>
                    {createLoan.isPending ? "Submitting..." : "Submit Application"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Loans", value: summary?.totalLoans ?? 0, icon: CreditCard, format: "num" },
          { label: "Active", value: summary?.activeLoans ?? 0, icon: CheckCircle2, format: "num" },
          { label: "Pending Approval", value: summary?.pendingApproval ?? 0, icon: Clock, format: "num" },
          { label: "Overdue", value: summary?.totalOverdue ?? 0, icon: AlertTriangle, format: "num" },
          { label: "Total Disbursed", value: summary?.totalDisbursed ?? 0, icon: Wallet, format: "currency" },
          { label: "Outstanding", value: summary?.totalOutstanding ?? 0, icon: CreditCard, format: "currency" },
        ].map(({ label, value, icon: Icon, format }) => (
          <Card key={label}>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Icon className="h-3 w-3" /> {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold">
                {format === "currency" ? formatCurrency(value as number) : value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="p-4 border-b">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Customer</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">EMI</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Rate / Tenure</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading loans...</TableCell>
                </TableRow>
              ) : !loans?.data?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No loans found</TableCell>
                </TableRow>
              ) : (
                loans.data.map((loan) => (
                  <TableRow key={loan.id} className="hover:bg-muted/50">
                    <TableCell className="pl-4">
                      <Link href={`/loans/${loan.id}`}>
                        <div className="font-medium hover:underline text-primary cursor-pointer">{loan.customerName ?? `#${loan.customerId}`}</div>
                      </Link>
                      {loan.customerMobile && (
                        <div className="text-xs text-muted-foreground">{loan.customerMobile}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(loan.principalAmount)}</TableCell>
                    <TableCell className="text-right">{loan.emiAmount ? formatCurrency(loan.emiAmount) : "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-orange-600">
                      {loan.outstandingAmount != null ? formatCurrency(loan.outstandingAmount) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {loan.interestRate}% {loan.interestType} · {loan.tenure}m
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusBadge[loan.status] ?? "secondary"}>{loan.status}</Badge>
                    </TableCell>
                    <TableCell className="pr-4 text-right space-x-1">
                      {loan.status === "pending" && (
                        <>
                          <Button size="sm" variant="default" onClick={() => approveLoan(loan.id)} disabled={updateLoan.isPending}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => rejectLoan(loan.id)} disabled={updateLoan.isPending}>
                            Reject
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {loans && loans.total > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, loans.total)} of {loans.total}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page * 20 >= loans.total} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

