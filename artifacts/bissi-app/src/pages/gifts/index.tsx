import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Gift, Package, Users, BarChart2, Plus, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const statusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  reserved: "outline",
  distributed: "secondary",
  returned: "outline",
  damaged: "destructive",
  pending: "outline",
  given: "default",
};

type GiftCategory = { id: number; name: string; description?: string; branchId: number };
type GiftItem = { id: number; categoryId: number; name: string; description?: string; estimatedValue?: string; quantityTotal: number; quantityAvailable: number; quantityDistributed: number; status: string; categoryName?: string };
type GiftDistribution = { id: number; giftId: number; customerId: number; distributionDate: string; status: string; notes?: string; giftName?: string; customerName?: string; quantity: number };
type GiftSummary = { totalItems: number; totalDistributed: number; pendingDistribution: number; totalCategories: number };

export default function GiftsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("inventory");
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isDistributeOpen, setIsDistributeOpen] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);

  // Form state
  const [newItem, setNewItem] = useState({ categoryId: "", name: "", description: "", estimatedValue: "", quantityTotal: "1", branchId: "1" });
  const [newDist, setNewDist] = useState({ giftId: "", customerId: "", distributionDate: new Date().toISOString().split("T")[0], notes: "", branchId: "1", quantity: "1" });

  const { data: summary } = useQuery<GiftSummary>({ queryKey: ["gifts", "summary"], queryFn: () => api.get("/gifts/summary") });
  const { data: categories = [] } = useQuery<GiftCategory[]>({ queryKey: ["gifts", "categories"], queryFn: () => api.get("/gifts/categories") });
  const { data: inventory = [], isLoading: loadingInventory } = useQuery<GiftItem[]>({ queryKey: ["gifts", "inventory"], queryFn: () => api.get("/gifts/inventory") });
  const { data: distributions = [], isLoading: loadingDist } = useQuery<GiftDistribution[]>({ queryKey: ["gifts", "distributions"], queryFn: () => api.get("/gifts/distributions") });

  const createItem = useMutation({
    mutationFn: (data: typeof newItem) => api.post("/gifts/inventory", { ...data, categoryId: parseInt(data.categoryId), quantityTotal: parseInt(data.quantityTotal), branchId: parseInt(data.branchId) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["gifts"] }); setIsAddItemOpen(false); toast({ title: "Gift item added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createDist = useMutation({
    mutationFn: (data: typeof newDist) => api.post("/gifts/distributions", { ...data, giftId: parseInt(data.giftId), customerId: parseInt(data.customerId), quantity: parseInt(data.quantity), branchId: parseInt(data.branchId) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["gifts"] }); setIsDistributeOpen(false); toast({ title: "Gift distributed successfully" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, returnNotes }: { id: number; status: string; returnNotes?: string }) =>
      api.patch(`/gifts/distributions/${id}/status`, { status, returnNotes }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["gifts"] }); toast({ title: "Status updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gift Management</h1>
          <p className="text-muted-foreground">Manage gift inventory, distribution, and tracking</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDistributeOpen} onOpenChange={setIsDistributeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Gift className="mr-2 h-4 w-4" />Distribute Gift</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Distribute Gift to Customer</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Gift Item</Label>
                  <Select value={newDist.giftId} onValueChange={(v) => setNewDist({ ...newDist, giftId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select gift" /></SelectTrigger>
                    <SelectContent>{inventory.filter(i => i.quantityAvailable > 0).map(i => <SelectItem key={i.id} value={String(i.id)}>{i.name} ({i.quantityAvailable} available)</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Customer ID</Label>
                  <Input type="number" placeholder="Customer ID" value={newDist.customerId} onChange={e => setNewDist({ ...newDist, customerId: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Quantity</Label>
                    <Input type="number" min="1" value={newDist.quantity} onChange={e => setNewDist({ ...newDist, quantity: e.target.value })} />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={newDist.distributionDate} onChange={e => setNewDist({ ...newDist, distributionDate: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input placeholder="Optional notes" value={newDist.notes} onChange={e => setNewDist({ ...newDist, notes: e.target.value })} />
                </div>
                <Button className="w-full" onClick={() => createDist.mutate(newDist)} disabled={createDist.isPending}>
                  {createDist.isPending ? "Distributing..." : "Confirm Distribution"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Gift Item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Gift to Inventory</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Category</Label>
                  <Select value={newItem.categoryId} onValueChange={v => setNewItem({ ...newItem, categoryId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Gift Name</Label>
                  <Input placeholder="e.g. Gold Necklace 5g" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input placeholder="Optional description" value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Estimated Value (₹)</Label>
                    <Input type="number" placeholder="5000" value={newItem.estimatedValue} onChange={e => setNewItem({ ...newItem, estimatedValue: e.target.value })} />
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input type="number" min="1" value={newItem.quantityTotal} onChange={e => setNewItem({ ...newItem, quantityTotal: e.target.value })} />
                  </div>
                </div>
                <Button className="w-full" onClick={() => createItem.mutate(newItem)} disabled={createItem.isPending}>
                  {createItem.isPending ? "Adding..." : "Add to Inventory"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.totalItems ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Distributed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.totalDistributed ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Distribution</CardTitle>
            <Gift className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.pendingDistribution ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.totalCategories ?? 0}</div></CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="distributions">Distributions</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Distributed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingInventory ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading inventory...</TableCell></TableRow>
                  ) : inventory.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No gift items. Add your first item.</TableCell></TableRow>
                  ) : inventory.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.categoryName ?? "—"}</TableCell>
                      <TableCell>{item.estimatedValue ? formatCurrency(parseFloat(item.estimatedValue)) : "—"}</TableCell>
                      <TableCell>{item.quantityTotal}</TableCell>
                      <TableCell>
                        <span className={item.quantityAvailable === 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                          {item.quantityAvailable}
                        </span>
                      </TableCell>
                      <TableCell>{item.quantityDistributed}</TableCell>
                      <TableCell><Badge variant={statusColor[item.status] ?? "outline"}>{item.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distributions" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gift</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingDist ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : distributions.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No distributions recorded.</TableCell></TableRow>
                  ) : distributions.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.giftName ?? `Gift #${d.giftId}`}</TableCell>
                      <TableCell>{d.customerName ?? `Customer #${d.customerId}`}</TableCell>
                      <TableCell>{d.distributionDate}</TableCell>
                      <TableCell>{d.quantity}</TableCell>
                      <TableCell><Badge variant={statusColor[d.status] ?? "outline"}>{d.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {d.status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: d.id, status: "given" })}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />Given
                            </Button>
                          )}
                          {d.status === "given" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: d.id, status: "returned" })}>
                              <RotateCcw className="h-3 w-3 mr-1" />Return
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <GiftCategoriesTab categories={categories} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GiftCategoriesTab({ categories }: { categories: GiftCategory[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () => api.post("/gifts/categories", { name, description, branchId: 1 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["gifts", "categories"] }); setIsOpen(false); setName(""); setDescription(""); toast({ title: "Category added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gift Categories</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Gift Category</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Category Name</Label>
                <Input placeholder="e.g. Gold Jewellery" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>Description</Label>
                <Input placeholder="Optional description" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending || !name.trim()}>
                {create.isPending ? "Adding..." : "Add Category"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No categories yet.</TableCell></TableRow>
            ) : categories.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.description ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
