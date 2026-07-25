import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { safeArray } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Landmark, Plus, Wallet, QrCode, CreditCard, Building2, CheckCircle2, ShieldCheck } from "lucide-react";

type BankAccount = {
  id: number;
  accountName: string;
  accountNumber?: string | null;
  bankName?: string | null;
  ifscCode?: string | null;
  accountType: "bank" | "cash" | "upi" | "wallet";
  branchId?: number | null;
  isActive: boolean;
  notes?: string | null;
};

export default function BankAccountsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openModal, setOpenModal] = useState(false);
  const [editingAcc, setEditingAcc] = useState<BankAccount | null>(null);

  const [form, setForm] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
    ifscCode: "",
    accountType: "bank" as "bank" | "cash" | "upi" | "wallet",
    notes: "",
  });

  const { data: accountsData = [], isLoading } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => customFetch("/api/accounts"),
  });
  const accounts = safeArray<BankAccount>(accountsData);

  const saveMutation = useMutation({
    mutationFn: (data: object) =>
      editingAcc
        ? customFetch(`/api/accounts/${editingAcc.id}`, { method: "PUT", body: JSON.stringify(data) })
        : customFetch("/api/accounts", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      setOpenModal(false);
      setEditingAcc(null);
      resetForm();
      toast({
        title: editingAcc ? "Account Updated" : "Account Created",
        description: "Destination bank/cash account has been saved successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to save account",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      customFetch(`/api/accounts/${id}`, { method: "PUT", body: JSON.stringify({ isActive }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast({ title: "Account status updated" });
    },
  });

  function resetForm() {
    setForm({
      accountName: "",
      accountNumber: "",
      bankName: "",
      ifscCode: "",
      accountType: "bank",
      notes: "",
    });
  }

  function handleOpenCreate() {
    setEditingAcc(null);
    resetForm();
    setOpenModal(true);
  }

  function handleOpenEdit(acc: BankAccount) {
    setEditingAcc(acc);
    setForm({
      accountName: acc.accountName || "",
      accountNumber: acc.accountNumber || "",
      bankName: acc.bankName || "",
      ifscCode: acc.ifscCode || "",
      accountType: acc.accountType || "bank",
      notes: acc.notes || "",
    });
    setOpenModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.accountName.trim()) return;
    saveMutation.mutate(form);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Landmark className="text-amber-500" size={28} />
            Bank & Cash Accounts (बैंक व कैश खाते)
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Manage destination accounts where field & office collection funds are deposited.
          </p>
        </div>

        <Button onClick={handleOpenCreate} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold gap-2">
          <Plus size={18} /> Add New Account
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-32 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed border-2 text-center p-12">
          <Landmark size={48} className="mx-auto mb-3 text-amber-500 opacity-40" />
          <h3 className="text-lg font-bold text-foreground">No Destination Accounts Found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Add bank accounts, cash counters, or UPI QR accounts for collectors to select during collection.
          </p>
          <Button onClick={handleOpenCreate} className="mt-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
            Add First Account
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <Card
              key={acc.id}
              className={`border transition-all hover:border-amber-500/40 relative overflow-hidden ${
                acc.isActive ? "bg-card border-border" : "bg-muted/20 border-border opacity-60"
              }`}
            >
              <CardHeader className="pb-3 pt-5 px-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0">
                      {acc.accountType === "cash" && <Wallet size={20} />}
                      {acc.accountType === "upi" && <QrCode size={20} />}
                      {acc.accountType === "bank" && <Landmark size={20} />}
                      {acc.accountType === "wallet" && <CreditCard size={20} />}
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-foreground">{acc.accountName}</CardTitle>
                      <CardDescription className="text-xs capitalize font-medium">{acc.bankName || acc.accountType}</CardDescription>
                    </div>
                  </div>

                  <Badge
                    variant={acc.isActive ? "default" : "secondary"}
                    className={acc.isActive ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30" : ""}
                  >
                    {acc.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-2 px-5 pb-5 pt-1 text-xs">
                {acc.accountNumber && (
                  <div className="flex justify-between text-muted-foreground border-b border-border/50 pb-1.5">
                    <span>A/C No / UPI ID:</span>
                    <span className="font-mono font-bold text-foreground">{acc.accountNumber}</span>
                  </div>
                )}

                {acc.ifscCode && (
                  <div className="flex justify-between text-muted-foreground border-b border-border/50 pb-1.5">
                    <span>IFSC Code:</span>
                    <span className="font-mono font-bold text-foreground">{acc.ifscCode}</span>
                  </div>
                )}

                {acc.notes && <p className="text-muted-foreground italic pt-1">{acc.notes}</p>}

                <div className="flex gap-2 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(acc)}
                    className="flex-1 text-xs font-bold"
                  >
                    Edit Details
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ id: acc.id, isActive: !acc.isActive })}
                    className={`text-xs font-bold ${acc.isActive ? "text-rose-500 hover:text-rose-600" : "text-emerald-500 hover:text-emerald-600"}`}
                  >
                    {acc.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Account Dialog */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="text-amber-500" size={20} />
              {editingAcc ? "Edit Account" : "Add New Account"}
            </DialogTitle>
            <DialogDescription>
              Configure destination accounts where field and office collections are deposited.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs font-bold">Account Display Name *</Label>
              <Input
                value={form.accountName}
                onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                placeholder="e.g. HDFC Main Current A/C or Office Cash Counter"
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Account Type</Label>
                <select
                  value={form.accountType}
                  onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value as any }))}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring mt-1"
                >
                  <option value="bank">Bank Account</option>
                  <option value="cash">Cash Counter / Box</option>
                  <option value="upi">UPI QR Account</option>
                  <option value="wallet">Digital Wallet</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold">Bank Name (optional)</Label>
                <Input
                  value={form.bankName}
                  onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                  placeholder="e.g. HDFC Bank"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Account / UPI No.</Label>
                <Input
                  value={form.accountNumber}
                  onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                  placeholder="e.g. 50200012345678"
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold">IFSC Code (optional)</Label>
                <Input
                  value={form.ifscCode}
                  onChange={(e) => setForm((f) => ({ ...f, ifscCode: e.target.value }))}
                  placeholder="e.g. HDFC0001234"
                  className="mt-1 font-mono text-xs uppercase"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">Notes / Description</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Daily cash collection deposit account"
                className="mt-1"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
                {saveMutation.isPending ? "Saving…" : "Save Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
