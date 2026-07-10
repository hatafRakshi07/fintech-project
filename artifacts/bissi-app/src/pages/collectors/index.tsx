import React, { useState } from "react";
import { Link } from "wouter";
import { useListCollectors, useCreateCollector, useListBranches } from "@workspace/api-client-react";
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
import { Search, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListCollectorsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const collectorSchema = z.object({
  name: z.string().min(2, "Name is required"),
  mobile: z.string().min(10, "Valid mobile is required"),
  branchId: z.coerce.number().min(1, "Branch is required"),
});

export default function CollectorsPage() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const { data: collectors, isLoading } = useListCollectors({ search });
  const { data: branches } = useListBranches();
  
  const createCollector = useCreateCollector();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof collectorSchema>>({
    resolver: zodResolver(collectorSchema),
    defaultValues: {
      name: "",
      mobile: "",
      branchId: 0,
    },
  });

  const onSubmit = (values: z.infer<typeof collectorSchema>) => {
    createCollector.mutate({ data: { ...values, status: 'active' } }, {
      onSuccess: () => {
        toast({ title: "Collector created successfully" });
        setIsCreateOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListCollectorsQueryKey() });
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
          <h1 className="text-2xl font-bold tracking-tight">Collectors</h1>
          <p className="text-muted-foreground">Manage field agents and collectors.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Collector</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Collector</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl><Input placeholder="9876543210" {...field} /></FormControl>
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
                          <SelectTrigger>
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
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
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createCollector.isPending}>
                    {createCollector.isPending ? "Creating..." : "Create Collector"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search collectors..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Total Collections</TableHead>
                <TableHead className="text-right">Amount Collected</TableHead>
                <TableHead className="text-center pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading collectors...</TableCell>
                </TableRow>
              ) : collectors?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No collectors found</TableCell>
                </TableRow>
              ) : (
                collectors?.map((collector) => (
                  <TableRow key={collector.id} className="hover:bg-muted/50 cursor-pointer">
                    <TableCell className="pl-4 font-medium">
                      <Link href={`/collectors/${collector.id}`}>
                        <span className="hover:underline text-primary">{collector.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell>{collector.mobile}</TableCell>
                    <TableCell>{collector.branchName}</TableCell>
                    <TableCell className="text-right">{collector.totalCollections || 0}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(collector.totalAmount || 0)}</TableCell>
                    <TableCell className="text-center pr-4">
                      <Badge variant={collector.status === 'active' ? 'default' : 'secondary'}>
                        {collector.status}
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
