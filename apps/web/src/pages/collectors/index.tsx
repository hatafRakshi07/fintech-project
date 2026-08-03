import React, { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { safeArray } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Users, Gift, Plus, CheckCircle2, Clock, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

type Customer = { id: string; name: string; mobile: string; address?: string; referenceNumber?: string; status: string; };

const GIFT_TYPES = [
  "Lucky Winner Cash", "Invertor", "AC", "Fridge", "Washing Machine",
  "Geyser", "Room Cooler", "Juicer Mixer", "Gas Stove", "Blanket",
  "Casserole", "Kettle", "Silver Coin", "Silver Ring", "Dinner Set",
  "Fan", "Grinder", "Other (type below)",
];

const COMMITTEE_NAMES: Record<string, { uuid: string; label: string }> = {
  "BISSI-1": { uuid: "11111111-1111-1111-1111-111111111111", label: "Hare Ka Sahara (20th)" },
  "BISSI-2": { uuid: "22222222-2222-2222-2222-222222222222", label: "Shree Krishna (Lottery)" },
  "BISSI-3": { uuid: "33333333-3333-3333-3333-333333333333", label: "Pyare Mohan (15th)" },
  "BISSI-4": { uuid: "a3d68b9c-63df-4884-a5ad-eb8a17e3be31", label: "Sawariya Seth (5th)" },
};

export default function CollectorsPage() {
  const [tab, setTab] = useState("members");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Collector Panel</h1>
        <p className="text-muted-foreground">Member directory, gift claims, and gift records.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="members"><Users className="h-4 w-4 mr-1" />Members</TabsTrigger>
          <TabsTrigger value="gift-claim"><Gift className="h-4 w-4 mr-1" />Gift Claim Entry</TabsTrigger>
          <TabsTrigger value="gift-records"><CheckCircle2 className="h-4 w-4 mr-1" />All Gift Records</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-4"><MembersTab /></TabsContent>
        <TabsContent value="gift-claim" className="mt-4"><GiftClaimTab /></TabsContent>
        <TabsContent value="gift-records" className="mt-4"><AllGiftsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Members Directory ─────────────────────────────────────────────────────────
function MembersTab() {
  const [search, setSearch] = useState("");
  const { data: rawCustomers, isLoading } = useQuery<any>({
    queryKey: ["collector-members", search],
    queryFn: () => api.get(`/customers?search=${encodeURIComponent(search)}&limit=100`),
    staleTime: 30_000,
  });
  const customers = safeArray<Customer>(rawCustomers);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or mobile..." className="pl-9"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Reference No.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading members...</TableCell></TableRow>
              ) : customers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{search ? "No results found." : "Search a member above."}</TableCell></TableRow>
              ) : customers.map((c: Customer) => (
                <TableRow key={c.id} className="hover:bg-muted/50">
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/collectors/${c.id}`}>
                      <span className="hover:underline text-primary cursor-pointer">{c.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{c.mobile || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{(c as any).referenceNumber || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{c.status || "Active"}</Badge></TableCell>
                  <TableCell>
                    <Link href={`/collectors/${c.id}`}>
                      <Button size="sm" variant="ghost" className="text-xs">View →</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Gift Claim Entry ──────────────────────────────────────────────────────────
function GiftClaimTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customGift, setCustomGift] = useState("");
  const [form, setForm] = useState({
    giftType: "", tokenNumber: "", committeeCode: "BISSI-1",
    distributionDate: new Date().toISOString().slice(0, 10), notes: "",
  });

  const { data: searchData } = useQuery<any>({
    queryKey: ["gift-cust-search", search],
    queryFn: () => api.get(`/customers?search=${encodeURIComponent(search)}&limit=20`),
    enabled: search.length >= 2,
  });
  const results = safeArray<Customer>(searchData);

  // Customer gift history
  const { data: historyData, isLoading: histLoading } = useQuery<any>({
    queryKey: ["cust-gift-hist", selectedCustomer?.id],
    queryFn: () => api.get(`/customers/${selectedCustomer!.id}/history`),
    enabled: !!selectedCustomer,
  });
  const custGifts = safeArray<any>(historyData?.gifts);

  const recordGift = useMutation({
    mutationFn: () => {
      const finalGift = form.giftType === "Other (type below)" ? customGift : form.giftType;
      return api.post("/gifts/claim", {
        customerUuid: selectedCustomer!.id,
        customerName: selectedCustomer!.name,
        giftName: finalGift,
        tokenNumber: form.tokenNumber ? Number(form.tokenNumber) : null,
        committeeUuid: COMMITTEE_NAMES[form.committeeCode].uuid,
        distributionDate: form.distributionDate,
        notes: form.notes,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cust-gift-hist", selectedCustomer?.id] });
      qc.invalidateQueries({ queryKey: ["gifts-all"] });
      setIsDialogOpen(false);
      setForm({ giftType: "", tokenNumber: "", committeeCode: "BISSI-1", distributionDate: new Date().toISOString().slice(0, 10), notes: "" });
      setCustomGift("");
      toast({ title: "Gift claim recorded!", description: `Gift recorded for ${selectedCustomer!.name}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const finalGiftName = form.giftType === "Other (type below)" ? customGift : form.giftType;

  return (
    <div className="space-y-6">
      {/* Step 1: Find customer */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Step 1 — Find Customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Type customer name, mobile, or token number..."
            value={search}
            onChange={e => { setSearch(e.target.value); if (!e.target.value) setSelectedCustomer(null); }} />
          {search.length >= 2 && results.length > 0 && !selectedCustomer && (
            <div className="border rounded-lg divide-y bg-background max-h-60 overflow-y-auto shadow-md">
              {results.map((c: Customer) => (
                <div key={c.id}
                  className="p-3 hover:bg-muted cursor-pointer flex items-center justify-between"
                  onClick={() => { setSelectedCustomer(c); setSearch(c.name); }}>
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.mobile}</p>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs">Select</Button>
                </div>
              ))}
            </div>
          )}
          {selectedCustomer && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 rounded-lg flex items-center justify-between">
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">{selectedCustomer.name}</p>
                <p className="text-xs text-muted-foreground">{selectedCustomer.mobile}</p>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setSelectedCustomer(null); setSearch(""); }}>Change</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Record gift */}
      {selectedCustomer && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Step 2 — Record Gift Claim for {selectedCustomer.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Gift / Item Received <span className="text-red-500">*</span></Label>
                <Select value={form.giftType} onValueChange={v => setForm({ ...form, giftType: v })}>
                  <SelectTrigger><SelectValue placeholder="Select gift..." /></SelectTrigger>
                  <SelectContent>
                    {GIFT_TYPES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.giftType === "Other (type below)" && (
                  <Input className="mt-2" placeholder="Enter gift name..." value={customGift}
                    onChange={e => setCustomGift(e.target.value)} />
                )}
              </div>
              <div>
                <Label>Bissi Scheme</Label>
                <Select value={form.committeeCode} onValueChange={v => setForm({ ...form, committeeCode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMMITTEE_NAMES).map(([code, info]) => (
                      <SelectItem key={code} value={code}>{info.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Token Number</Label>
                <Input type="number" placeholder="e.g. 42" value={form.tokenNumber}
                  onChange={e => setForm({ ...form, tokenNumber: e.target.value })} />
              </div>
              <div>
                <Label>Date of Claim</Label>
                <Input type="date" value={form.distributionDate}
                  onChange={e => setForm({ ...form, distributionDate: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Remarks / Notes (optional)</Label>
                <Input value={form.notes} placeholder="Any special notes..."
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <Button
              onClick={() => recordGift.mutate()}
              disabled={recordGift.isPending || !finalGiftName}
              className="w-full sm:w-auto"
            >
              {recordGift.isPending ? "Saving..." : `Record Gift Claim for ${selectedCustomer.name}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Customer gift history */}
      {selectedCustomer && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />Gift History — {selectedCustomer.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {histLoading ? (
              <div className="text-center py-6 text-muted-foreground">Loading...</div>
            ) : custGifts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">No gift records found for this customer.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gift / Item</TableHead>
                    <TableHead>Committee</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {custGifts.map((g: any) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.giftName || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{g.committeeName || "—"}</TableCell>
                      <TableCell>#{g.tokenNumber || "—"}</TableCell>
                      <TableCell className="text-sm">{g.date?.slice(0, 10) || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="text-xs">{g.status || "given"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── All Gift Records ──────────────────────────────────────────────────────────
function AllGiftsTab() {
  const [search, setSearch] = useState("");
  const [committeeFilter, setCommitteeFilter] = useState("all");

  const { data: giftsData, isLoading } = useQuery<any>({
    queryKey: ["gifts-all", search, committeeFilter],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "300", offset: "0" });
      if (search) p.set("search", search);
      if (committeeFilter !== "all") p.set("committeeId", COMMITTEE_NAMES[committeeFilter]?.uuid);
      return api.get(`/gifts/bissi-winners?${p}`);
    },
    staleTime: 60_000,
  });

  const gifts = safeArray<any>(giftsData?.winners ?? giftsData?.data ?? []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name or gift..." className="pl-9"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={committeeFilter} onValueChange={setCommitteeFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schemes</SelectItem>
            {Object.entries(COMMITTEE_NAMES).map(([code, info]) => (
              <SelectItem key={code} value={code}>{info.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">{gifts.length} gift records found</div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading gift records...</div>
          ) : gifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No gift records found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Gift / Item</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Committee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gifts.map((g: any) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.winnerName || g.customer_name || "—"}</TableCell>
                    <TableCell>{g.giftName || g.gift_name || g.rewardDescription || "—"}</TableCell>
                    <TableCell className="font-mono">#{g.tokenNumber || g.token_number || g.winnerToken || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{g.committeeName || g.committee || "—"}</TableCell>
                    <TableCell className="text-sm">{(g.drawDate || g.distribution_date || "")?.slice(0, 10) || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={g.status === "given" ? "default" : "secondary"} className="text-xs">
                        {g.status || "given"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
