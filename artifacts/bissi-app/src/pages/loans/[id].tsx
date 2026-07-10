import React from "react";
import { useParams, Link } from "wouter";
import {
  useGetLoan,
  useGetLoanEmiSchedule,
  useUpdateLoan,
  useListCollections,
  getListLoansQueryKey,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Wallet,
  CreditCard,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Banknote,
  Smartphone,
  Building2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const statusBadge: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "secondary",
  active: "default",
  closed: "secondary",
  rejected: "destructive",
  overdue: "destructive",
};

const emiStatusIcon: Record<string, React.ReactNode> = {
  paid: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  overdue: <AlertTriangle className="h-4 w-4 text-destructive" />,
  partial: <TrendingDown className="h-4 w-4 text-orange-500" />,
};

const modeIcon: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-3 w-3" />,
  upi: <Smartphone className="h-3 w-3" />,
  bank: <Building2 className="h-3 w-3" />,
  card: <CreditCard className="h-3 w-3" />,
};

export default function LoanDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);

  const { data: loan, isLoading } = useGetLoan(id);
  const { data: emiSchedule } = useGetLoanEmiSchedule(id);
  const { data: collections } = useListCollections({ loanId: id, limit: 100 });
  const updateLoan = useUpdateLoan();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleApprove = () => {
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

  const handleReject = () => {
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

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading loan details…</div>;
  if (!loan) return <div className="p-8">Loan not found.</div>;

  const paidInstallments = emiSchedule?.filter((e) => e.status === "paid").length ?? 0;
  const totalInstallments = emiSchedule?.length ?? loan.tenure;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/loans">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                Loan #{loan.id}
              </h1>
              <Badge variant={statusBadge[loan.status] ?? "secondary"}>{loan.status}</Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
              <Link href={`/customers/${loan.customerId}`}>
                <span className="hover:underline cursor-pointer text-primary font-medium">{loan.customerName ?? `Customer #${loan.customerId}`}</span>
              </Link>
              {loan.customerMobile && <span>· {loan.customerMobile}</span>}
              {loan.branchName && <span>· {loan.branchName}</span>}
            </div>
          </div>
        </div>

        {loan.status === "pending" && (
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={updateLoan.isPending}>Approve & Disburse</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve Loan?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the loan as active and record today as the disbursement date.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleApprove}>Approve</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" onClick={handleReject} disabled={updateLoan.isPending}>Reject</Button>
          </div>
        )}
      </div>

      {/* Loan details */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Principal", value: formatCurrency(loan.principalAmount), icon: Wallet },
          { label: "Monthly EMI", value: loan.emiAmount ? formatCurrency(loan.emiAmount) : "—", icon: CreditCard },
          { label: "Total Amount", value: loan.totalAmount ? formatCurrency(loan.totalAmount) : "—", icon: TrendingDown },
          { label: "Paid", value: formatCurrency(loan.paidAmount ?? 0), icon: CheckCircle2 },
          { label: "Outstanding", value: loan.outstandingAmount != null ? formatCurrency(loan.outstandingAmount) : "—", icon: AlertTriangle },
          { label: "Progress", value: `${paidInstallments}/${totalInstallments} EMIs`, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-sm font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Loan meta */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-muted-foreground">Interest Rate</p><p className="font-semibold">{loan.interestRate}% p.a.</p></div>
            <div><p className="text-muted-foreground">Interest Type</p><p className="font-semibold capitalize">{loan.interestType}</p></div>
            <div><p className="text-muted-foreground">Tenure</p><p className="font-semibold">{loan.tenure} months</p></div>
            <div>
              <p className="text-muted-foreground">Disbursed On</p>
              <p className="font-semibold">
                {loan.disbursedAt ? new Date(loan.disbursedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not disbursed"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="emi">
        <TabsList>
          <TabsTrigger value="emi">EMI Schedule</TabsTrigger>
          <TabsTrigger value="payments">Payment History ({collections?.total ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="emi" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4 text-center">#</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">EMI Amount</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-center pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!emiSchedule?.length ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {loan.status === "pending" ? "EMI schedule will be generated after loan approval." : "No EMI schedule available."}
                    </TableCell></TableRow>
                  ) : emiSchedule.map((emi) => (
                    <TableRow key={emi.installmentNumber} className={emi.status === "overdue" ? "bg-destructive/5" : "hover:bg-muted/50"}>
                      <TableCell className="pl-4 text-center text-muted-foreground text-sm">{emi.installmentNumber}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(emi.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(emi.emiAmount)}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">{formatCurrency(emi.principalComponent)}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">{formatCurrency(emi.interestComponent)}</TableCell>
                      <TableCell className="text-right">{emi.paidAmount ? formatCurrency(emi.paidAmount) : "—"}</TableCell>
                      <TableCell className="text-center pr-4">
                        <span className="flex items-center justify-center gap-1">
                          {emiStatusIcon[emi.status]}
                          <span className="text-xs capitalize">{emi.status}</span>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Receipt</TableHead>
                    <TableHead>Collector</TableHead>
                    <TableHead className="text-center">Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="pr-4">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!collections?.data?.length ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No payments recorded</TableCell></TableRow>
                  ) : collections.data.map((col) => (
                    <TableRow key={col.id} className="hover:bg-muted/50">
                      <TableCell className="pl-4 font-mono text-xs text-muted-foreground">{col.receiptNumber ?? "—"}</TableCell>
                      <TableCell className="text-sm">{col.collectorName ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="gap-1 text-xs">{modeIcon[col.paymentMode]}{col.paymentMode.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(col.amount)}</TableCell>
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
