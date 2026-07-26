import React, { forwardRef } from "react";
import { SkaAppLogo } from "./SkaAppLogo";

export interface ReceiptData {
  receiptNo: string;
  date: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: string;
  totalAmount: number;
  items: Array<{
    type: string;
    amount: number;
    description: string;
  }>;
  notes?: string;
  collectorName?: string;
}

interface Props {
  data: ReceiptData;
}

export const PrintableReceipt = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  return (
    <div ref={ref} className="bg-white p-8 font-sans w-[800px] mx-auto text-black print:w-full print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
        <div className="flex items-center gap-4">
          <SkaAppLogo size={64} className="grayscale text-black" />
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider">Shree Krishna Assoc.</h1>
            <p className="text-sm">Financial Membership & Bissi Management</p>
            <p className="text-sm text-gray-600">123 Main Bazaar, City Center, 400001</p>
            <p className="text-sm text-gray-600">Phone: +91 98765 43210</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold uppercase border border-black p-2 mb-2 inline-block">Office Copy</h2>
          <div className="text-sm space-y-1">
            <p><span className="font-semibold">Receipt No:</span> {data.receiptNo}</p>
            <p><span className="font-semibold">Date:</span> {new Date(data.date).toLocaleDateString()}</p>
            <p><span className="font-semibold">Time:</span> {new Date(data.date).toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Customer Info */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="border border-gray-300 p-4 rounded">
          <h3 className="font-bold text-gray-700 uppercase text-xs mb-2">Received From</h3>
          <p className="font-semibold text-lg">{data.customerName}</p>
          <p className="text-sm">Phone: {data.customerPhone}</p>
        </div>
        <div className="border border-gray-300 p-4 rounded">
          <h3 className="font-bold text-gray-700 uppercase text-xs mb-2">Payment Details</h3>
          <p className="text-sm"><span className="font-semibold">Method:</span> {data.paymentMethod}</p>
          <p className="text-sm"><span className="font-semibold">Collector:</span> {data.collectorName || "Self / Counter"}</p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full mb-6 border-collapse">
        <thead>
          <tr className="bg-gray-100 border-y border-gray-300">
            <th className="py-2 px-4 text-left font-semibold text-sm">S.No</th>
            <th className="py-2 px-4 text-left font-semibold text-sm">Payment Type</th>
            <th className="py-2 px-4 text-left font-semibold text-sm">Description</th>
            <th className="py-2 px-4 text-right font-semibold text-sm">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => (
            <tr key={index} className="border-b border-gray-200">
              <td className="py-3 px-4 text-sm">{index + 1}</td>
              <td className="py-3 px-4 text-sm font-medium">{item.type.replace('_', ' ')}</td>
              <td className="py-3 px-4 text-sm text-gray-600">{item.description}</td>
              <td className="py-3 px-4 text-right font-semibold">₹{item.amount.toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-b-2 border-gray-300 bg-gray-50">
            <td colSpan={3} className="py-4 px-4 text-right font-bold text-lg">Total Amount:</td>
            <td className="py-4 px-4 text-right font-bold text-xl">₹{data.totalAmount.toLocaleString('en-IN')}</td>
          </tr>
        </tfoot>
      </table>

      {/* Footer / Notes */}
      <div className="flex justify-between items-end mt-12">
        <div className="max-w-md">
          {data.notes && (
            <div className="mb-8">
              <p className="text-xs font-bold text-gray-500 uppercase">Remarks:</p>
              <p className="text-sm">{data.notes}</p>
            </div>
          )}
          <p className="text-xs text-gray-400">
            * This is a computer generated receipt and does not require a physical signature.
            <br />* Payments made by cheque are subject to realization.
          </p>
        </div>
        
        <div className="text-center">
          <div className="border-t border-black w-48 pt-2 mt-12">
            <p className="text-sm font-semibold uppercase">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
});

PrintableReceipt.displayName = "PrintableReceipt";
