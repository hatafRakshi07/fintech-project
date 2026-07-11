import React, { useState } from "react";
import { Link } from "wouter";
import { useListBranches, useCreateBranch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Search, Plus, MapPin, Users, UserSquare2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListBranchesQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const branchSchema = z.object({
  name: z.string().min(2, "Branch name is required"),
  code: z.string().min(2, "Branch code is required"),
  city: z.string().min(2, "City is required"),
  address: z.string().optional(),
  managerName: z.string().optional(),
  phone: z.string().optional(),
});

export default function BranchesPage() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const { data: branches, isLoading } = useListBranches({ search });
  const createBranch = useCreateBranch();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof branchSchema>>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: "",
      code: "",
      city: "",
      address: "",
      managerName: "",
      phone: "",
    },
  });

  const onSubmit = (values: z.infer<typeof branchSchema>) => {
    createBranch.mutate({ data: { ...values, status: 'active' } }, {
      onSuccess: () => {
        toast({ title: "Branch created successfully" });
        setIsCreateOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branches</h1>
          <p className="text-muted-foreground">Manage organization branches.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Branch</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Branch</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Branch Name</FormLabel>
                        <FormControl><Input placeholder="Main Branch" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Branch Code</FormLabel>
                        <FormControl><Input placeholder="BR001" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl><Input placeholder="Mumbai" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="managerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager Name (Optional)</FormLabel>
                      <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createBranch.isPending}>
                    {createBranch.isPending ? "Creating..." : "Create Branch"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">Loading branches...</div>
        ) : branches?.length === 0 ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">No branches found.</div>
        ) : (
          branches?.map(branch => (
            <Card key={branch.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <Link href={`/branches/${branch.id}`}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{branch.name}</CardTitle>
                    <p className="text-sm font-mono text-muted-foreground mt-1">{branch.code}</p>
                  </div>
                  <Badge variant={branch.status === 'active' ? 'default' : 'secondary'}>
                    {branch.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {branch.city} {branch.address && `- ${branch.address}`}
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div className="flex flex-col items-center justify-center p-2 bg-muted/50 rounded-md">
                    <Users className="h-4 w-4 text-primary mb-1" />
                    <span className="text-xl font-bold">{branch.totalCustomers || 0}</span>
                    <span className="text-xs text-muted-foreground">Customers</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 bg-muted/50 rounded-md">
                    <UserSquare2 className="h-4 w-4 text-secondary mb-1" />
                    <span className="text-xl font-bold">{branch.totalCollectors || 0}</span>
                    <span className="text-xs text-muted-foreground">Collectors</span>
                  </div>
                </div>
              </CardContent>
            </Link>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
