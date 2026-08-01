'use client';

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
import { Plus, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { getListCommitteesQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const committeeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  type: z.enum(['daily', 'weekly', 'monthly', 'festival', 'special']),
  installmentAmount: z.coerce.number().min(1, "Amount must be greater than 0"),
  memberLimit: z.coerce.number().min(2, "Must have at least 2 members"),
  branchId: z.coerce.number().min(1, "Branch is required"),
  rules: z.string().optional(),
});

import { safeArray } from "@/lib/utils";

export default function CommitteesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  const { data: rawCommittees, isLoading } = useListCommittees({ type: typeFilter !== "all" ? typeFilter : undefined });
  const { data: rawBranches } = useListBranches();
  
  const committees = safeArray<any>(rawCommittees);
  const branches = safeArray<any>(rawBranches);
  
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

  const [editingCommittee, setEditingCommittee] = useState<any | null>(null);

  const onSubmit = (values: z.infer<typeof committeeSchema>) => {
    createCommittee.mutate({ data: { ...values, status: 'active' } as any }, {
      onSuccess: () => {
        toast({ title: "Committee created successfully" });
        setIsCreateOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListCommitteesQueryKey() });
      }
    });
  };

  const editForm = useForm<z.infer<typeof committeeSchema>>({
    resolver: zodResolver(committeeSchema),
    defaultValues: {
      name: "",
      type: "monthly",
      installmentAmount: 1000,
      memberLimit: 20,
      branchId: 1,
    },
  });

  const handleStartEdit = (comm: any) => {
    setEditingCommittee(comm);
    editForm.reset({
      name: comm.name || "",
      type: comm.type || "monthly",
      installmentAmount: Number(comm.installmentAmount || comm.installment_amount || 0),
      memberLimit: Number(comm.memberLimit || comm.member_limit || 100),
      branchId: Number(comm.branch_id || comm.branchId || 1),
      rules: comm.rules || "",
    });
  };

  const onEditSubmit = async (values: z.infer<typeof committeeSchema>) => {
    if (!editingCommittee) return;
    try {
      await api.put(`/committees/${editingCommittee.id}`, values);
      toast({ title: "Committee updated successfully!" });
      setEditingCommittee(null);
      queryClient.invalidateQueries({ queryKey: getListCommitteesQueryKey() });
    } catch (err: any) {
      toast({ title: "Failed to update committee", description: err?.message, variant: "destructive" });
    }
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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <FormField
                  control={form.control}
                  name="rules"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center justify-between">
                        <span>Bissi Rules & Terms (नियम व शर्तें)</span>
                        <span className="text-xs text-muted-foreground font-normal">Optional</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="1. Monthly installment due date is 10th of every month.&#10;2. Late fee ₹50/day applicable after grace period.&#10;3. Winner token will continue paying remaining monthly installments."
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading committees...</TableCell>
                </TableRow>
              ) : committees?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No committees found</TableCell>
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
                    <TableCell className="text-center">
                      <Badge variant={comm.status === 'active' ? 'default' : comm.status === 'completed' ? 'secondary' : 'destructive'}>
                        {comm.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button variant="ghost" size="sm" onClick={() => handleStartEdit(comm)}>
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Committee Dialog */}
      <Dialog open={!!editingCommittee} onOpenChange={(open) => !open && setEditingCommittee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Committee Details</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Committee Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                  control={editForm.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="installmentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Installment Amount (₹)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
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

              <FormField
                control={editForm.control}
                name="rules"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>Bissi Rules & Terms (नियम व शर्तें)</span>
                      <span className="text-xs text-muted-foreground font-normal">Optional</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Enter Bissi rules..."
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full">Save Changes</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
