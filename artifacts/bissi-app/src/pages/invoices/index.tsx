import React, { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Printer,
  Plus,
  Trash2,
  FileText,
  Download,
  IndianRupee,
  Building2,
  User,
  Hash,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ───────────────────────────────────────────────
interface LineItem {
  id: string;
  description: string;
  hsn: string;
  qty: number;
  unit: string;
  rate: number;
  gstRate: number; // e.g. 18 for 18%
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  // Seller
  sellerName: string;
  sellerAddress: string;
  sellerGstin: string;
  sellerState: string;
  sellerEmail: string;
  sellerPhone: string;
  // Buyer
  buyerName: string;
  buyerAddress: string;
  buyerGstin: string;
  buyerState: string;
  buyerPhone: string;
  // Items
  items: LineItem[];
  notes: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
}

// ── Helpers ─────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);

const units = ["Nos", "Hrs", "Days", "Months", "Ltr", "Kg", "Pcs", "Set"];
const GST_RATES = [0, 5, 12, 18, 28];

const numToWords = (num: number): string => {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let result = "Rupees " + (rupees === 0 ? "Zero" : convert(rupees));
  if (paise > 0) result += " and " + convert(paise) + " Paise";
  return result + " Only";
};

const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const todayISO = () => new Date().toISOString().slice(0, 10);

const defaultItem = (): LineItem => ({
  id: uid(), description: "", hsn: "", qty: 1, unit: "Nos", rate: 0, gstRate: 18,
});

const defaultInvoice = (): InvoiceData => ({
  invoiceNumber: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
  invoiceDate: todayISO(),
  dueDate: "",
  sellerName: "",
  sellerAddress: "",
  sellerGstin: "",
  sellerState: "Rajasthan",
  sellerEmail: "",
  sellerPhone: "",
  buyerName: "",
  buyerAddress: "",
  buyerGstin: "",
  buyerState: "Rajasthan",
  buyerPhone: "",
  items: [defaultItem()],
  notes: "",
  bankName: "",
  accountNo: "",
  ifsc: "",
});

// ── Calculation ──────────────────────────────────────────
function calcTotals(items: LineItem[], sellerState: string, buyerState: string) {
  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  const sameState = sellerState === buyerState;

  const rows = items.map((item) => {
    const taxable = item.qty * item.rate;
    const gstAmt = (taxable * item.gstRate) / 100;
    const cgst = sameState ? gstAmt / 2 : 0;
    const sgst = sameState ? gstAmt / 2 : 0;
    const igst = sameState ? 0 : gstAmt;
    const total = taxable + gstAmt;
    subtotal += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    return { ...item, taxable, cgst, sgst, igst, total };
  });

  const grandTotal = subtotal + totalCgst + totalSgst + totalIgst;
  return { rows, subtotal, totalCgst, totalSgst, totalIgst, grandTotal, sameState };
}

// ── Saved Invoices list ──────────────────────────────────
interface SavedInvoice {
  id: string;
  invoiceNumber: string;
  buyerName: string;
  invoiceDate: string;
  grandTotal: number;
  data: InvoiceData;
}

// ── Print View ───────────────────────────────────────────
function PrintView({ inv }: { inv: InvoiceData }) {
  const { rows, subtotal, totalCgst, totalSgst, totalIgst, grandTotal, sameState } = calcTotals(
    inv.items, inv.sellerState, inv.buyerState
  );

  return (
    <div id="invoice-print" className="bg-white text-black font-sans p-8 min-h-screen text-sm">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{inv.sellerName || "Your Business Name"}</h1>
          <p className="text-gray-600 text-xs whitespace-pre-line mt-1">{inv.sellerAddress}</p>
          {inv.sellerGstin && <p className="text-xs mt-1"><strong>GSTIN:</strong> {inv.sellerGstin}</p>}
          {inv.sellerPhone && <p className="text-xs"><strong>Phone:</strong> {inv.sellerPhone}</p>}
          {inv.sellerEmail && <p className="text-xs"><strong>Email:</strong> {inv.sellerEmail}</p>}
          <p className="text-xs"><strong>State:</strong> {inv.sellerState}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-700 mb-1">TAX INVOICE</div>
          <table className="text-xs text-right ml-auto">
            <tbody>
              <tr><td className="pr-2 text-gray-500">Invoice No.</td><td className="font-semibold">{inv.invoiceNumber}</td></tr>
              <tr><td className="pr-2 text-gray-500">Date</td><td className="font-semibold">{new Date(inv.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td></tr>
              {inv.dueDate && <tr><td className="pr-2 text-gray-500">Due Date</td><td className="font-semibold">{new Date(inv.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill To */}
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Bill To</p>
        <p className="font-bold text-gray-900">{inv.buyerName || "—"}</p>
        <p className="text-xs text-gray-600 whitespace-pre-line">{inv.buyerAddress}</p>
        {inv.buyerGstin && <p className="text-xs"><strong>GSTIN:</strong> {inv.buyerGstin}</p>}
        {inv.buyerPhone && <p className="text-xs"><strong>Phone:</strong> {inv.buyerPhone}</p>}
        <p className="text-xs"><strong>State:</strong> {inv.buyerState}</p>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse mb-4 text-xs">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="border border-gray-600 px-2 py-1 text-left w-6">#</th>
            <th className="border border-gray-600 px-2 py-1 text-left">Description</th>
            <th className="border border-gray-600 px-2 py-1 text-center">HSN</th>
            <th className="border border-gray-600 px-2 py-1 text-center">Qty</th>
            <th className="border border-gray-600 px-2 py-1 text-center">Unit</th>
            <th className="border border-gray-600 px-2 py-1 text-right">Rate (₹)</th>
            <th className="border border-gray-600 px-2 py-1 text-right">Taxable (₹)</th>
            <th className="border border-gray-600 px-2 py-1 text-center">GST%</th>
            {sameState ? (
              <>
                <th className="border border-gray-600 px-2 py-1 text-right">CGST (₹)</th>
                <th className="border border-gray-600 px-2 py-1 text-right">SGST (₹)</th>
              </>
            ) : (
              <th className="border border-gray-600 px-2 py-1 text-right">IGST (₹)</th>
            )}
            <th className="border border-gray-600 px-2 py-1 text-right">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="border border-gray-300 px-2 py-1 text-center">{i + 1}</td>
              <td className="border border-gray-300 px-2 py-1">{row.description}</td>
              <td className="border border-gray-300 px-2 py-1 text-center">{row.hsn || "—"}</td>
              <td className="border border-gray-300 px-2 py-1 text-center">{row.qty}</td>
              <td className="border border-gray-300 px-2 py-1 text-center">{row.unit}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{fmt(row.rate)}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{fmt(row.taxable)}</td>
              <td className="border border-gray-300 px-2 py-1 text-center">{row.gstRate}%</td>
              {sameState ? (
                <>
                  <td className="border border-gray-300 px-2 py-1 text-right">{fmt(row.cgst)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{fmt(row.sgst)}</td>
                </>
              ) : (
                <td className="border border-gray-300 px-2 py-1 text-right">{fmt(row.igst)}</td>
              )}
              <td className="border border-gray-300 px-2 py-1 text-right font-semibold">{fmt(row.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 font-semibold">
            <td colSpan={6} className="border border-gray-300 px-2 py-1 text-right">Subtotal</td>
            <td className="border border-gray-300 px-2 py-1 text-right">{fmt(subtotal)}</td>
            <td className="border border-gray-300 px-2 py-1"></td>
            {sameState ? (
              <>
                <td className="border border-gray-300 px-2 py-1 text-right">{fmt(totalCgst)}</td>
                <td className="border border-gray-300 px-2 py-1 text-right">{fmt(totalSgst)}</td>
              </>
            ) : (
              <td className="border border-gray-300 px-2 py-1 text-right">{fmt(totalIgst)}</td>
            )}
            <td className="border border-gray-300 px-2 py-1 text-right">{fmt(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Amount in words */}
      <div className="border border-gray-300 rounded p-2 mb-4 bg-gray-50">
        <span className="text-xs font-semibold text-gray-600">Amount in Words: </span>
        <span className="text-xs">{numToWords(grandTotal)}</span>
      </div>

      {/* Grand Total summary box */}
      <div className="flex justify-end mb-4">
        <div className="border-2 border-gray-800 rounded p-3 min-w-48 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-gray-600">Taxable Amount</span><span>{fmt(subtotal)}</span></div>
          {sameState ? (
            <>
              <div className="flex justify-between"><span className="text-gray-600">Total CGST</span><span>{fmt(totalCgst)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Total SGST</span><span>{fmt(totalSgst)}</span></div>
            </>
          ) : (
            <div className="flex justify-between"><span className="text-gray-600">Total IGST</span><span>{fmt(totalIgst)}</span></div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>Grand Total</span><span>₹{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Bank + Notes */}
      <div className="grid grid-cols-2 gap-4 text-xs border-t border-gray-300 pt-3">
        <div>
          {inv.bankName && (
            <div>
              <p className="font-bold text-gray-700 mb-1">Bank Details</p>
              <p><strong>Bank:</strong> {inv.bankName}</p>
              {inv.accountNo && <p><strong>A/C No.:</strong> {inv.accountNo}</p>}
              {inv.ifsc && <p><strong>IFSC:</strong> {inv.ifsc}</p>}
            </div>
          )}
          {inv.notes && (
            <div className="mt-2">
              <p className="font-bold text-gray-700 mb-1">Notes / Terms</p>
              <p className="whitespace-pre-line text-gray-600">{inv.notes}</p>
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-gray-700 mb-1">For {inv.sellerName}</p>
          <div className="mt-10 border-t border-gray-400 inline-block px-8">
            <p className="text-gray-500 text-[10px]">Authorised Signatory</p>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">This is a computer generated invoice</p>
        </div>
      </div>
    </div>
  );
}

// ── Invoice Form ─────────────────────────────────────────
function InvoiceForm({
  inv,
  onChange,
}: {
  inv: InvoiceData;
  onChange: (upd: Partial<InvoiceData>) => void;
}) {
  const { rows, subtotal, totalCgst, totalSgst, totalIgst, grandTotal, sameState } = calcTotals(
    inv.items, inv.sellerState, inv.buyerState
  );

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    onChange({
      items: inv.items.map((it) =>
        it.id === id ? { ...it, [field]: typeof value === "string" && ["qty", "rate", "gstRate"].includes(field) ? parseFloat(value as string) || 0 : value } : it
      ),
    });
  };

  const addItem = () => onChange({ items: [...inv.items, defaultItem()] });
  const removeItem = (id: string) => onChange({ items: inv.items.filter((it) => it.id !== id) });

  const field = (label: string, key: keyof InvoiceData, placeholder?: string, type = "text") => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={(inv[key] as string) ?? ""}
        onChange={(e) => onChange({ [key]: e.target.value })}
        className="h-8 text-sm"
      />
    </div>
  );

  const indianStates = [
    "Rajasthan","Delhi","Maharashtra","Gujarat","Uttar Pradesh","Karnataka",
    "Tamil Nadu","West Bengal","Telangana","Andhra Pradesh","Madhya Pradesh",
    "Haryana","Bihar","Punjab","Jharkhand","Assam","Kerala","Odisha","Others"
  ];

  return (
    <div className="space-y-6">
      {/* Invoice header */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Hash className="h-4 w-4" />Invoice Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {field("Invoice Number", "invoiceNumber", "INV-2024-0001")}
            {field("Invoice Date", "invoiceDate", "", "date")}
            {field("Due Date (optional)", "dueDate", "", "date")}
          </div>
        </CardContent>
      </Card>

      {/* Seller + Buyer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />Your Business (Seller)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {field("Business Name *", "sellerName", "Bissi Finance")}
            <div className="space-y-1">
              <Label className="text-xs">Address</Label>
              <textarea
                className="w-full border rounded-md p-2 text-sm h-20 resize-none bg-background"
                placeholder="Full address..."
                value={inv.sellerAddress}
                onChange={(e) => onChange({ sellerAddress: e.target.value })}
              />
            </div>
            {field("GSTIN (optional)", "sellerGstin", "27AAAPZ1234A1Z5")}
            <div className="space-y-1">
              <Label className="text-xs">State</Label>
              <Select value={inv.sellerState} onValueChange={(v) => onChange({ sellerState: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{indianStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {field("Phone", "sellerPhone", "+91 98765 43210")}
            {field("Email", "sellerEmail", "business@example.com")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />Customer (Bill To)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {field("Customer Name *", "buyerName", "Customer name")}
            <div className="space-y-1">
              <Label className="text-xs">Address</Label>
              <textarea
                className="w-full border rounded-md p-2 text-sm h-20 resize-none bg-background"
                placeholder="Customer address..."
                value={inv.buyerAddress}
                onChange={(e) => onChange({ buyerAddress: e.target.value })}
              />
            </div>
            {field("GSTIN (optional)", "buyerGstin", "Customer GSTIN if any")}
            <div className="space-y-1">
              <Label className="text-xs">State</Label>
              <Select value={inv.buyerState} onValueChange={(v) => onChange({ buyerState: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{indianStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {field("Phone", "buyerPhone", "+91 98765 43210")}
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Line Items</CardTitle>
            <Button size="sm" variant="outline" onClick={addItem}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile: card per item */}
          <div className="sm:hidden space-y-3 p-4">
            {inv.items.map((item, i) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Item #{i + 1}</span>
                  {inv.items.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Input placeholder="Description *" value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} className="h-8 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="HSN Code" value={item.hsn} onChange={(e) => updateItem(item.id, "hsn", e.target.value)} className="h-8 text-sm" />
                  <Select value={item.unit} onValueChange={(v) => updateItem(item.id, "unit", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-[10px]">Qty</Label><Input type="number" min={0} value={item.qty} onChange={(e) => updateItem(item.id, "qty", e.target.value)} className="h-8 text-sm" /></div>
                  <div><Label className="text-[10px]">Rate (₹)</Label><Input type="number" min={0} value={item.rate} onChange={(e) => updateItem(item.id, "rate", e.target.value)} className="h-8 text-sm" /></div>
                  <div>
                    <Label className="text-[10px]">GST %</Label>
                    <Select value={String(item.gstRate)} onValueChange={(v) => updateItem(item.id, "gstRate", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="text-right text-sm font-semibold text-primary">
                  Total: ₹{fmt(rows[i]?.total ?? 0)}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground w-20">HSN</th>
                  <th className="px-2 py-2 text-center font-medium text-muted-foreground w-14">Qty</th>
                  <th className="px-2 py-2 text-center font-medium text-muted-foreground w-20">Unit</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground w-24">Rate (₹)</th>
                  <th className="px-2 py-2 text-center font-medium text-muted-foreground w-20">GST%</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground w-24">Total (₹)</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((item, i) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-1.5">
                      <Input placeholder="Item description *" value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} className="h-7 text-xs border-0 bg-transparent shadow-none px-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input placeholder="HSN" value={item.hsn} onChange={(e) => updateItem(item.id, "hsn", e.target.value)} className="h-7 text-xs" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" min={0} value={item.qty} onChange={(e) => updateItem(item.id, "qty", e.target.value)} className="h-7 text-xs text-center" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Select value={item.unit} onValueChange={(v) => updateItem(item.id, "unit", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" min={0} value={item.rate} onChange={(e) => updateItem(item.id, "rate", e.target.value)} className="h-7 text-xs text-right" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Select value={String(item.gstRate)} onValueChange={(v) => updateItem(item.id, "gstRate", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold">{fmt(rows[i]?.total ?? 0)}</td>
                    <td className="px-2 py-1.5">
                      {inv.items.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => removeItem(item.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Totals + Tax summary */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 space-y-3">
          {/* Bank details */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Bank Details (optional)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {field("Bank Name", "bankName", "HDFC Bank")}
                {field("Account Number", "accountNo", "12345678901")}
                {field("IFSC Code", "ifsc", "HDFC0001234")}
              </div>
            </CardContent>
          </Card>
          {/* Notes */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Notes / Terms & Conditions</CardTitle></CardHeader>
            <CardContent>
              <textarea
                className="w-full border rounded-md p-2 text-sm h-20 resize-none bg-background"
                placeholder="Payment terms, notes, etc."
                value={inv.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
              />
            </CardContent>
          </Card>
        </div>

        {/* Tax Summary */}
        <Card className="sm:w-72 shrink-0">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><IndianRupee className="h-4 w-4" />Tax Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxable Amount</span>
              <span className="font-medium">₹{fmt(subtotal)}</span>
            </div>
            {sameState ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CGST</span>
                  <span className="font-medium">₹{fmt(totalCgst)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SGST</span>
                  <span className="font-medium">₹{fmt(totalSgst)}</span>
                </div>
                <Badge variant="outline" className="text-[10px] w-full justify-center">Intra-state (CGST + SGST)</Badge>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IGST</span>
                  <span className="font-medium">₹{fmt(totalIgst)}</span>
                </div>
                <Badge variant="outline" className="text-[10px] w-full justify-center">Inter-state (IGST)</Badge>
              </>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Grand Total</span>
              <span className="text-primary">₹{fmt(grandTotal)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground italic text-center pt-1">
              {numToWords(grandTotal)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────
export default function InvoicesPage() {
  const [inv, setInv] = useState<InvoiceData>(defaultInvoice);
  const [saved, setSaved] = useState<SavedInvoice[]>(() => {
    try { return JSON.parse(localStorage.getItem("bissi_invoices") ?? "[]"); } catch { return []; }
  });
  const [preview, setPreview] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const { toast } = useToast();

  const update = (upd: Partial<InvoiceData>) => setInv((prev) => ({ ...prev, ...upd }));

  const { grandTotal } = calcTotals(inv.items, inv.sellerState, inv.buyerState);

  const saveInvoice = () => {
    const entry: SavedInvoice = {
      id: loadedId ?? uid(),
      invoiceNumber: inv.invoiceNumber,
      buyerName: inv.buyerName,
      invoiceDate: inv.invoiceDate,
      grandTotal,
      data: inv,
    };
    const updated = loadedId
      ? saved.map((s) => (s.id === loadedId ? entry : s))
      : [entry, ...saved];
    setSaved(updated);
    setLoadedId(entry.id);
    localStorage.setItem("bissi_invoices", JSON.stringify(updated));
    toast({ title: "Invoice saved!" });
  };

  const loadInvoice = (s: SavedInvoice) => {
    setInv(s.data);
    setLoadedId(s.id);
    setPreview(false);
  };

  const deleteInvoice = (id: string) => {
    const updated = saved.filter((s) => s.id !== id);
    setSaved(updated);
    localStorage.setItem("bissi_invoices", JSON.stringify(updated));
    if (loadedId === id) { setInv(defaultInvoice()); setLoadedId(null); }
  };

  const newInvoice = () => { setInv(defaultInvoice()); setLoadedId(null); };

  const handlePrint = () => {
    setPreview(true);
    setTimeout(() => window.print(), 400);
  };

  return (
    <>
      {/* Print stylesheet — hides the editor, shows only the invoice */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #invoice-print { display: block !important; }
          #invoice-print { position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>

      {/* Hidden print preview (rendered off-screen until print) */}
      {preview && (
        <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
          <PrintView inv={inv} />
        </div>
      )}
      <div id="invoice-print" className="hidden"><PrintView inv={inv} /></div>

      <div className="space-y-4 sm:space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              GST Invoice Maker
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create GST-compliant invoices with CGST/SGST breakdown · Rajasthan
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={newInvoice}>
              <Plus className="h-4 w-4 mr-1" />New Invoice
            </Button>
            <Button variant="outline" size="sm" onClick={saveInvoice}>
              <Download className="h-4 w-4 mr-1" />Save
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-1" />Saved ({saved.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Saved Invoices</DialogTitle></DialogHeader>
                {saved.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No saved invoices yet.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {saved.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 border rounded-lg p-3 hover:bg-muted/50">
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadInvoice(s)}>
                          <p className="font-semibold text-sm truncate">{s.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{s.buyerName || "—"} · {new Date(s.invoiceDate).toLocaleDateString("en-IN")}</p>
                          <p className="text-xs font-medium text-primary">₹{fmt(s.grandTotal)}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => deleteInvoice(s.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />Print / Download PDF
            </Button>
          </div>
        </div>

        {/* Invoice Form */}
        <InvoiceForm inv={inv} onChange={update} />
      </div>
    </>
  );
}
