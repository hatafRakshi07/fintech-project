import React, { useState } from "react";
import { Link } from "wouter";
import { useListCommittees, useCreateCommittee, useListBranches } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListCommitteesQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const committeeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  type: z.enum(['daily', 'weekly', 'monthly', 'festival', 'special']),
  installmentAmount: z.coerce.number().min(1, "Amount must be greater than 0"),
  memberLimit: z.coerce.number().min(2, "Must have at least 2 members"),
  branchId: z.coerce.number().min(1, "Branch is required"),
});

export default function CommitteesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  const { data: committees, isLoading } = useListCommittees({ type: typeFilter !== "all" ? typeFilter : undefined });
  const { data: branches } = useListBranches();
  
  const createCommittee = useCreateCommittee();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof committeeSchema>>({
    resolver: zodResolver(committeeSchema),
    defaultValues: {
      name: "",
      type: "monthly",
      installmentAmount: 1000,
      memberLimit: 20,
      branchId: 0,
    },
  });

  const onSubmit = (values: z.infer<typeof committeeSchema>) => {
    createCommittee.mutate({ data: { ...values, status: 'active' } }, {
      onSuccess: () => {
        toast({ title: "Committee created successfully" });
        setIsCreateOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListCommitteesQueryKey() });
      }
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Committees (Bissi)</h1>
          <p className="text-muted-foreground">Manage chit funds and committees.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Committee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Committee</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Committee Name</FormLabel>
                      <FormControl><Input placeholder="Diwali Special Bissi" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="festival">Festival</SelectItem>
                            <SelectItem value="special">Special</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="branchId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Branch</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {branches?.map(b => (
                              <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="installmentAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Installment Amount</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="memberLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Member Limit</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createCommittee.isPending}>
                    {createCommittee.isPending ? "Creating..." : "Create Committee"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="p-4 flex flex-row gap-4 border-b">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="festival">Festival</SelectItem>
              <SelectItem value="special">Special</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Committee Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Installment</TableHead>
                <TableHead className="text-center">Members</TableHead>
                <TableHead className="text-right">Total Pool</TableHead>
                <TableHead className="text-center pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading committees...</TableCell>
                </TableRow>
              ) : committees?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No committees found</TableCell>
                </TableRow>
              ) : (
                committees?.map((comm) => (
                  <TableRow key={comm.id} className="hover:bg-muted/50">
                    <TableCell className="pl-4 font-medium">
                      <Link href={`/committees/${comm.id}`}>
                        <span className="hover:underline text-primary">{comm.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{comm.type}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(comm.installmentAmount)}</TableCell>
                    <TableCell className="text-center">
                      {comm.currentMembers || 0} / {comm.memberLimit}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {formatCurrency(comm.installmentAmount * comm.memberLimit)}
                    </TableCell>
                    <TableCell className="text-center pr-4">
                      <Badge variant={comm.status === 'active' ? 'default' : comm.status === 'completed' ? 'secondary' : 'destructive'}>
                        {comm.status}
                      </Badge>
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
