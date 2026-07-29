import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt, getStoredUser } from "@/lib/api";
import { safeArray } from "@/lib/utils";
import Header from "@/components/Header";
import { Plus, CheckCircle2, Search, Target, Users, Landmark, FileImage } from "lucide-react";

type Scheme = { id: string; name: string; installmentAmount: string };
type Customer = { id: string; name: string; phone: string };
type Token = { membershipId: string; schemeId: string; customerId: string; tokenId: string; tokenNumber: string; status: string };

type TokenSplit = {
  tokenId: string;
  tokenNumber: string;
  amount: string;
  selected: boolean;
};

export default function CollectionsV2Page() {
  const qc = useQueryClient();
  const user = getStoredUser();
  
  const [selectedScheme, setSelectedScheme] = useState<Scheme | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "bank">("cash");
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");
  
  // Splitting mode
  const [splitMode, setSplitMode] = useState<"auto" | "manual">("auto");
  const [lumpSum, setLumpSum] = useState("");
  const [tokenSplits, setTokenSplits] = useState<TokenSplit[]>([]);
  
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch Schemes
  const { data: schemesRaw } = useQuery<Scheme[]>({
    queryKey: ["v2-schemes"],
    queryFn: () => api.get("/v2/collector/schemes"),
  });
  const schemes = safeArray(schemesRaw) as Scheme[];

  // Search Customers (Name, Phone, or Token number)
  const { data: searchResultsRaw } = useQuery<Customer[]>({
    queryKey: ["v2-customer-search", customerSearch],
    queryFn: () => api.get(`/v2/collector/customers/search?query=${encodeURIComponent(customerSearch)}`),
    enabled: customerSearch.length >= 1,
  });
  const searchResults = safeArray(searchResultsRaw) as Customer[];

  // Fetch Tokens when Customer selected
  const { data: tokensRaw, isLoading: loadingTokens } = useQuery<Token[]>({
    queryKey: ["v2-tokens", selectedCustomer?.id, selectedScheme?.id],
    queryFn: () => api.get(`/v2/collector/tokens?customerId=${selectedCustomer?.id}${selectedScheme?.id ? `&schemeId=${selectedScheme.id}` : ''}`),
    enabled: !!selectedCustomer,
  });
  const tokens = safeArray(tokensRaw) as Token[];

  // Initialize splits when tokens load and auto-select scheme if not set
  useEffect(() => {
    if (tokens.length > 0) {
      if (!selectedScheme && schemes.length > 0) {
        const matchedScheme = schemes.find(s => s.id === tokens[0].schemeId);
        if (matchedScheme) setSelectedScheme(matchedScheme);
      }
      setTokenSplits(
        tokens.map(t => ({
          tokenId: t.tokenId,
          tokenNumber: t.tokenNumber,
          amount: "",
          selected: true
        }))
      );
    } else {
      setTokenSplits([]);
    }
  }, [tokens, schemes, selectedScheme]);

  // Handle Auto Split
  useEffect(() => {
    if (splitMode === "auto" && tokenSplits.length > 0) {
      const sum = parseFloat(lumpSum) || 0;
      if (sum > 0) {
        const selectedCount = tokenSplits.filter(t => t.selected).length;
        if (selectedCount > 0) {
          const perToken = Math.floor((sum / selectedCount) * 100) / 100;
          let remaining = sum;
          const lastSelectedIndex = tokenSplits.map(p => p.selected).lastIndexOf(true);
          
          setTokenSplits(prev => prev.map((t, i) => {
            if (!t.selected) return { ...t, amount: "" };
            
            // Last selected token gets the remainder to avoid rounding errors
            const isLastSelected = i === lastSelectedIndex;
            const amt = isLastSelected ? Math.max(0, Math.round(remaining * 100) / 100) : perToken;
            remaining -= amt;
            
            return { ...t, amount: String(amt) };
          }));
        }
      }
    }
  }, [lumpSum, splitMode]); // deliberate omission of tokenSplits to avoid infinite loop

  const submitMutation = useMutation({
    mutationFn: (data: any) => api.post("/v2/collector/payments", data),
    onSuccess: () => {
      setSuccessMsg("Payment recorded successfully!");
      setLumpSum("");
      setSelectedCustomer(null);
      setCustomerSearch("");
      setTokenSplits([]);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return alert("Select a customer");
    if (!selectedScheme) return alert("Select a scheme");
    
    const allocations = tokenSplits
      .filter(t => t.selected && parseFloat(t.amount) > 0)
      .map(t => ({ tokenId: t.tokenId, amount: t.amount }));
      
    if (allocations.length === 0) return alert("No payment amounts allocated.");
    
    submitMutation.mutate({
      customerId: selectedCustomer.id,
      paymentMode,
      screenshotUrl: paymentMode === "upi" ? screenshotUrl : undefined,
      allocations,
      collectorId: user?.id
    });
  };

  const totalAllocated = tokenSplits.reduce((acc, t) => acc + (t.selected ? (parseFloat(t.amount) || 0) : 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <Header title="Collect Payment" />
      
      {successMsg && (
        <div className="bg-green-100 text-green-800 p-4 m-4 rounded-lg flex items-center gap-2 border border-green-200 shadow-sm animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <div className="p-4 space-y-6">
        {/* 1. Scheme Selection */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-500" />
            1. Select Scheme (Bissi)
          </h2>
          <select 
            className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedScheme?.id || ""}
            onChange={(e) => setSelectedScheme(schemes.find(s => s.id === e.target.value) || null)}
          >
            <option value="">-- Choose Scheme --</option>
            {schemes.map(s => (
              <option key={s.id} value={s.id}>{s.name} (₹{s.installmentAmount}/mo)</option>
            ))}
          </select>
        </div>

        {/* 2. Customer Search */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            2. Select Customer
          </h2>
          {!selectedCustomer ? (
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by token number, name or phone..."
                className="w-full pl-10 p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
              />
              {searchResults.length > 0 && customerSearch.length >= 1 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {searchResults.map(c => (
                    <div 
                      key={c.id} 
                      className="p-3 border-b hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                      onClick={() => setSelectedCustomer(c)}
                    >
                      <div>
                        <div className="font-medium text-gray-800">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.phone}</div>
                      </div>
                      <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-2 py-1 rounded">Select</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <div>
                <div className="font-semibold text-blue-900">{selectedCustomer.name}</div>
                <div className="text-sm text-blue-700">{selectedCustomer.phone}</div>
              </div>
              <button 
                onClick={() => { setSelectedCustomer(null); setTokenSplits([]); }}
                className="text-xs bg-white text-blue-600 px-3 py-1 rounded shadow-sm border"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* 3. Token Splitting */}
        {selectedCustomer && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-blue-500" />
              3. Payment Allocation
            </h2>
            
            {loadingTokens ? (
              <div className="text-center py-4 text-gray-500 text-sm">Loading tokens...</div>
            ) : tokens.length === 0 ? (
              <div className="text-center py-4 text-red-500 text-sm bg-red-50 rounded-lg">No active tokens found for this customer in this scheme.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex p-1 bg-gray-100 rounded-lg">
                  <button 
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md ${splitMode === "auto" ? "bg-white shadow text-blue-600" : "text-gray-600"}`}
                    onClick={() => setSplitMode("auto")}
                  >
                    Auto Split
                  </button>
                  <button 
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md ${splitMode === "manual" ? "bg-white shadow text-blue-600" : "text-gray-600"}`}
                    onClick={() => setSplitMode("manual")}
                  >
                    Manual Split
                  </button>
                </div>

                {splitMode === "auto" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Enter Total Amount to Split</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-gray-500 font-medium">₹</span>
                      <input 
                        type="number" 
                        value={lumpSum}
                        onChange={e => setLumpSum(e.target.value)}
                        className="w-full pl-8 p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none text-lg font-semibold"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2 mt-4">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tokens ({tokens.length})</label>
                  {tokenSplits.map((t, idx) => (
                    <div key={t.tokenId} className={`flex items-center gap-3 p-3 rounded-lg border ${t.selected ? 'bg-blue-50/30 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                      <input 
                        type="checkbox" 
                        checked={t.selected}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setTokenSplits(prev => prev.map((item, i) => i === idx ? { ...item, selected: val, amount: val ? item.amount : "" } : item));
                        }}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div className="flex-1 font-medium text-gray-700">Token #{t.tokenNumber}</div>
                      <div className="relative w-32">
                        <span className="absolute left-3 top-2 text-gray-500 text-sm">₹</span>
                        <input 
                          type="number"
                          disabled={splitMode === "auto" || !t.selected}
                          value={t.amount}
                          onChange={(e) => {
                            setTokenSplits(prev => prev.map((item, i) => i === idx ? { ...item, amount: e.target.value } : item));
                          }}
                          className={`w-full pl-7 p-2 border rounded-md text-sm outline-none ${t.selected ? 'bg-white border-blue-300 focus:ring-2 focus:ring-blue-500' : 'bg-gray-100 border-gray-200 text-gray-400'}`}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                  <span className="font-medium text-gray-600">Total Allocated:</span>
                  <span className="font-bold text-lg text-green-600">{fmt.currency(totalAllocated)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Payment Mode & Submit */}
        {selectedCustomer && selectedScheme && tokens.length > 0 && totalAllocated > 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">4. Payment Mode</h2>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {["cash", "upi", "bank"].map(mode => (
                <button
                  key={mode}
                  onClick={() => setPaymentMode(mode as any)}
                  className={`py-2 rounded-lg text-sm font-medium border capitalize ${paymentMode === mode ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-gray-600 border-gray-200"}`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {paymentMode === "upi" && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <FileImage className="w-3 h-3" /> UPI Screenshot (Optional)
                </label>
                <input 
                  type="file" 
                  accept="image/*"
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  onChange={() => {
                    // Just a mock for UI, real upload would go to Supabase storage
                    setScreenshotUrl("uploaded-screenshot-url");
                  }}
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg shadow-lg disabled:opacity-70 transition-colors flex items-center justify-center gap-2"
            >
              {submitMutation.isPending ? "Processing..." : `Record Payment of ${fmt.currency(totalAllocated)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
