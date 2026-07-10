import React, { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetBranch,
  useUpdateBranch,
  useListCustomers,
  useListCollectors,
  getGetBranchQueryKey,
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Building2, Users, UserSquare2, MapPin, Phone, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

const editSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  city: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().optional(),
  managerName: z.string().optional(),
});

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function BranchDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [collectorSearch, setCollectorSearch] = useState("");

  const { data: branch, isLoading } = useGetBranch(id);
  const { data: customers } = useListCustomers({ branchId: id, limit: 50 });
  const { data: collectors } = useListCollectors({ branchId: id });
  const updateBranch = useUpdateBranch();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    values: {
      name: branch?.name ?? "",
      code: branch?.code ?? "",
      city: branch?.city ?? "",
      address: branch?.address ?? "",
      phone: branch?.phone ?? "",
      managerName: branch?.managerName ?? "",
    },
  });

  const onSubmit = (values: z.infer<typeof editSchema>) => {
    updateBranch.mutate(
      { id, data: values },
      {
        onSuccess: () => {
          toast({ title: "Branch updated" });
          setIsEditOpen(false);
          queryClient.invalidateQueries({ queryKey: getGetBranchQueryKey(id) });
        },
        onError: () => toast({ title: "Update failed", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading branch…</div>;
  if (!branch) return <div className="p-8">Branch not found.</div>;

  const filteredCustomers = (customers?.data ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.mobile.includes(customerSearch) ||
      c.referenceNumber.toLowerCase().includes(customerSearch.toLowerCase())
  );
  const filteredCollectors = (collectors ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(collectorSearch.toLowerCase()) ||
      c.mobile.includes(collectorSearch)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/branches">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{branch.name}</h1>
              <Badge variant="outline" className="font-mono">{branch.code}</Badge>
              <Badge variant={branch.status === "active" ? "default" : "secondary"}>{branch.status}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              {branch.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{branch.city}</span>}
              {branch.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{branch.phone}</span>}
              {branch.managerName && <span>Manager: {branch.managerName}</span>}
            </div>
          </div>
        </div>
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Branch</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem><FormLabel>Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="managerName" render={({ field }) => (
                    <FormItem><FormLabel>Manager</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={updateBranch.isPending}>
                    {updateBranch.isPending ? "Saving…" : "Save Changes"}
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
          <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Customers</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0"><div className="text-2xl font-bold">{branch.totalCustomers ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><UserSquare2 className="h-3 w-3" /> Collectors</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0"><div className="text-2xl font-bold">{branch.totalCollectors ?? 0}</div></CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Customers ({customers?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="collectors">Collectors ({collectors?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-4">
          <Card>
            <CardHeader className="p-4 border-b">
              <div className="relative max-w-sm">
                <Input placeholder="Search customers…" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Ref #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead className="text-right">Total Paid</TableHead>
                    <TableHead className="text-center pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No customers found</TableCell></TableRow>
                  ) : filteredCustomers.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/50">
                      <TableCell className="pl-4 font-mono text-xs">{c.referenceNumber}</TableCell>
                      <TableCell>
                        <Link href={`/customers/${c.id}`}>
                          <span className="font-medium hover:underline cursor-pointer text-primary">{c.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell>{c.mobile}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.totalPaid ?? 0)}</TableCell>
                      <TableCell className="text-center pr-4">
                        <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collectors" className="mt-4">
          <Card>
            <CardHeader className="p-4 border-b">
              <div className="relative max-w-sm">
                <Input placeholder="Search collectors…" value={collectorSearch} onChange={(e) => setCollectorSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead className="text-right">Collections</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center pr-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollectors.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No collectors found</TableCell></TableRow>
                  ) : filteredCollectors.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/50">
                      <TableCell className="pl-4">
                        <Link href={`/collectors/${c.id}`}>
                          <span className="font-medium hover:underline cursor-pointer text-primary">{c.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell>{c.mobile}</TableCell>
                      <TableCell className="text-right">{c.totalCollections ?? 0}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.totalAmount ?? 0)}</TableCell>
                      <TableCell className="text-center pr-4">
                        <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
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
