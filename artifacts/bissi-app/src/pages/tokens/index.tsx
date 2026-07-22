import React, { useState } from "react";
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
import { Plus, Ticket, ArrowRightLeft } from "lucide-react";
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

export default function TokensPage() {
  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [transferTokenId, setTransferTokenId] = useState<number | null>(null);

  const { role, user, isCustomer } = useRole();

  const { data: tokens, isLoading } = useListTokens({
    committeeId: committeeFilter !== "all" ? parseInt(committeeFilter, 10) : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    customerId: isCustomer ? user?.customerId ?? undefined : undefined,
  } as any);
  const { data: committees } = useListCommittees();
  const { data: customers } = useListCustomers({ limit: 200 });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tokens</h1>
          <p className="text-muted-foreground">Manage committee participation tokens.</p>
        </div>

        {!isCustomer && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Issue Token</Button>
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
                  <FormField
                    control={form.control}
                    name="committeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Committee</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
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
                        {customers?.data?.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.referenceNumber})</SelectItem>
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

      <Card>
        <CardHeader className="p-4 flex flex-row gap-4 border-b flex-wrap">
          <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by committee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Committees</SelectItem>
              {committees?.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="transferred">Transferred</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Token #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Committee</TableHead>
                <TableHead>Issued On</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading tokens...</TableCell>
                </TableRow>
              ) : !tokens?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Ticket className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No tokens found
                  </TableCell>
                </TableRow>
              ) : (
                tokens.map((token) => (
                  <TableRow key={token.id} className="hover:bg-muted/50">
                    <TableCell className="pl-4 font-mono font-semibold">{token.tokenNumber}</TableCell>
                    <TableCell>{token.customerName ?? `#${token.customerId}`}</TableCell>
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
