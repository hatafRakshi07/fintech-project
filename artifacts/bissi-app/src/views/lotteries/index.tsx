'use client';

import React, { useState } from "react";
import { Link, useLocation } from "@/lib/router-adapter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trophy,
  Gift,
  Plus,
  Search,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  Phone,
  Sparkles,
  ArrowUpRight,
  Eye,
  Check,
  AlertCircle,
  Building2,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";

interface LotteryGift {
  id: string;
  sessionId: string;
  tokenNumber: string;
  tokenId?: string;
  customerId?: string;
  customerName: string;
  mobileNumber: string;
  bissiName: string;
  giftName: string;
  giftCategory?: string;
  giftValue?: number;
  status: "Pending" | "Collected";
  collectionDate?: string;
  collectedBy?: string;
  remarks?: string;
  createdAt: string;
}

interface LotterySession {
  id: string;
  bissiName: string;
  lotteryDate: string;
  lotteryMonth: string;
  notes: string;
  totalGifts: number;
  collectedGifts: number;
  pendingGifts: number;
  gifts?: LotteryGift[];
}

interface DashboardStats {
  totalSessions: number;
  totalGiftsDistributed: number;
  collectedGifts: number;
  pendingGifts: number;
  todayCollectedGifts: number;
}

export default function LotteriesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [bissiFilter, setBissiFilter] = useState("ALL");

  const [selectedSession, setSelectedSession] = useState<LotterySession | null>(null);

  // Modals state
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [isAddGiftOpen, setIsAddGiftOpen] = useState(false);
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [selectedGiftForCollect, setSelectedGiftForCollect] = useState<LotteryGift | null>(null);
  const [viewGiftDetails, setViewGiftDetails] = useState<LotteryGift | null>(null);

  // New Session Form
  const [newSessionForm, setNewSessionForm] = useState({
    bissiName: "Sanwariya Seth",
    lotteryDate: new Date().toISOString().slice(0, 10),
    lotteryMonth: "July 2026",
    notes: "",
  });

  // New Gift Form
  const [newGiftForm, setNewGiftForm] = useState({
    tokenNumber: "",
    customerName: "",
    mobileNumber: "",
    bissiName: "",
    giftName: "",
    giftCategory: "Electronics",
    giftValue: "",
    status: "Pending",
    collectionDate: "",
    collectedBy: "Admin",
    remarks: "",
  });

  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [detectedInfo, setDetectedInfo] = useState<{ found: boolean; customerName?: string; mobileNumber?: string; bissiName?: string } | null>(null);

  // Collect Gift Form
  const [collectForm, setCollectForm] = useState({
    collectionDate: new Date().toISOString().slice(0, 10),
    collectedBy: "Admin",
    remarks: "",
  });

  // Fetch Dashboard Stats
  const { data: statsData } = useQuery<{ success: boolean; stats: DashboardStats }>({
    queryKey: ["lottery-dashboard"],
    queryFn: () => customFetch<{ success: boolean; stats: DashboardStats }>("/lottery/dashboard"),
  });

  // Fetch Lottery Sessions
  const { data: sessionsData, isLoading: isSessionsLoading } = useQuery<{ success: boolean; sessions: LotterySession[] }>({
    queryKey: ["lottery-sessions", searchTerm, bissiFilter],
    queryFn: () => {
      const queryParams = new URLSearchParams();
      if (searchTerm) queryParams.set("search", searchTerm);
      if (bissiFilter !== "ALL") queryParams.set("bissi", bissiFilter);

      return customFetch<{ success: boolean; sessions: LotterySession[] }>(`/lottery/sessions?${queryParams.toString()}`);
    },
  });

  // Fetch Selected Session Details (with gifts)
  const { data: sessionDetailData, isLoading: isDetailLoading } = useQuery<{ success: boolean; session: LotterySession }>({
    queryKey: ["lottery-session-detail", selectedSession?.id],
    queryFn: () => customFetch<{ success: boolean; session: LotterySession }>(`/lottery/sessions/${selectedSession?.id}`),
    enabled: Boolean(selectedSession?.id),
  });

  const activeSessionGifts = sessionDetailData?.session?.gifts || [];

  // Mutation: Create Session
  const createSessionMutation = useMutation({
    mutationFn: (payload: typeof newSessionForm) =>
      customFetch<any>("/lottery/sessions", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      toast({ title: "Lottery Session Created", description: `Session created for ${data?.session?.bissiName || 'Bissi'}!` });
      queryClient.invalidateQueries({ queryKey: ["lottery-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["lottery-sessions"] });
      if (data?.session) setSelectedSession(data.session);
      setIsCreateSessionOpen(false);
      setNewSessionForm({
        bissiName: "Sanwariya Seth",
        lotteryDate: new Date().toISOString().slice(0, 10),
        lotteryMonth: "July 2026",
        notes: "",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Mutation: Add Gift Entry
  const addGiftMutation = useMutation({
    mutationFn: (payload: typeof newGiftForm) => {
      if (!selectedSession?.id) throw new Error("No lottery session selected");
      return customFetch<any>(`/lottery/sessions/${selectedSession.id}/gifts`, {
        method: "POST",
        body: JSON.stringify({ ...payload, bissiName: payload.bissiName || selectedSession.bissiName }),
      });
    },
    onSuccess: () => {
      toast({ title: "Gift Winning Added!", description: "Gift entry recorded for token winner." });
      queryClient.invalidateQueries({ queryKey: ["lottery-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["lottery-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["lottery-session-detail", selectedSession?.id] });
      setIsAddGiftOpen(false);
      setNewGiftForm({
        tokenNumber: "",
        customerName: "",
        mobileNumber: "",
        bissiName: "",
        giftName: "",
        giftCategory: "Electronics",
        giftValue: "",
        status: "Pending",
        collectionDate: "",
        collectedBy: "Admin",
        remarks: "",
      });
      setDetectedInfo(null);
    },
    onError: (err: any) => {
      toast({ title: "Gift Entry Error", description: err.message, variant: "destructive" });
    },
  });

  // Mutation: Mark Gift Collected
  const collectGiftMutation = useMutation({
    mutationFn: ({ giftId, payload }: { giftId: string; payload: typeof collectForm }) =>
      customFetch<any>(`/lottery/gifts/${giftId}/collect`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast({ title: "Gift Marked as Collected!", description: "Status updated to Collected permanently." });
      queryClient.invalidateQueries({ queryKey: ["lottery-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["lottery-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["lottery-session-detail", selectedSession?.id] });
      setIsCollectModalOpen(false);
      setSelectedGiftForCollect(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Auto-detect Token Handler
  const handleTokenNumberChange = async (tokenVal: string) => {
    setNewGiftForm((prev) => ({ ...prev, tokenNumber: tokenVal }));
    if (!tokenVal || tokenVal.trim().length === 0) {
      setDetectedInfo(null);
      return;
    }

    setIsAutoDetecting(true);
    try {
      const data = await customFetch<any>(`/lottery/detect-token?tokenNumber=${encodeURIComponent(tokenVal)}&bissiName=${encodeURIComponent(selectedSession?.bissiName || "")}`);
      if (data?.found) {
        setDetectedInfo(data);
        setNewGiftForm((prev) => ({
          ...prev,
          customerName: data.customerName || prev.customerName,
          mobileNumber: data.mobileNumber || prev.mobileNumber,
          bissiName: data.bissiName || selectedSession?.bissiName || prev.bissiName,
        }));
      } else {
        setDetectedInfo({ found: false });
      }
    } catch {
      setDetectedInfo({ found: false });
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const stats = statsData?.stats || {
    totalSessions: 0,
    totalGiftsDistributed: 0,
    collectedGifts: 0,
    pendingGifts: 0,
    todayCollectedGifts: 0,
  };

  const sessions = sessionsData?.sessions || [];

  // Filter gift entries by status / search
  const filteredGifts = activeSessionGifts.filter((g) => {
    if (statusFilter !== "ALL" && g.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        g.customerName.toLowerCase().includes(term) ||
        g.tokenNumber.toLowerCase().includes(term) ||
        g.giftName.toLowerCase().includes(term) ||
        g.mobileNumber.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 rounded-2xl border border-amber-500/20 text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Lottery Management <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-medium">Bissi Winning Gifts</span>
              </h1>
              <p className="text-sm text-slate-300">
                Manually record lottery gift wins per Bissi opening, auto-detect customer details by Token Number, and track collection status.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
            onClick={() => setLocation("/daily-diary/reports")}
          >
            <FileText className="h-4 w-4 mr-2 text-blue-400" />
            Lottery Reports
          </Button>

          <Dialog open={isCreateSessionOpen} onOpenChange={setIsCreateSessionOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-950/40">
                <Plus className="h-4 w-4 mr-2" />
                Create Lottery Session
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Create New Lottery Session
                </DialogTitle>
                <DialogDescription>
                  Setup a lottery opening session for a specific Bissi scheme and date.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Bissi Name <span className="text-red-500">*</span></Label>
                  <Select
                    value={newSessionForm.bissiName}
                    onValueChange={(val) => setNewSessionForm({ ...newSessionForm, bissiName: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Bissi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sanwariya Seth">Sanwariya Seth</SelectItem>
                      <SelectItem value="Pyare Mohan">Pyare Mohan</SelectItem>
                      <SelectItem value="Hare Ka Sahara">Hare Ka Sahara</SelectItem>
                      <SelectItem value="Shree Krishna Associate">Shree Krishna Associate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Lottery Date <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={newSessionForm.lotteryDate}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, lotteryDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Lottery Month / Number</Label>
                  <Input
                    placeholder="e.g. July 2026 or 15 Date Bissi"
                    value={newSessionForm.lotteryMonth}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, lotteryMonth: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Input
                    placeholder="Remarks or location details"
                    value={newSessionForm.notes}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateSessionOpen(false)}>Cancel</Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold"
                  onClick={() => createSessionMutation.mutate(newSessionForm)}
                  disabled={createSessionMutation.isPending}
                >
                  {createSessionMutation.isPending ? "Creating..." : "Save Session"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dashboard KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-4">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Sessions</span>
            <span className="text-2xl font-bold text-white block mt-1">{stats.totalSessions}</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-4">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Gifts</span>
            <span className="text-2xl font-bold text-amber-400 block mt-1">{stats.totalGiftsDistributed}</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-4">
            <span className="text-xs text-emerald-400 uppercase font-semibold">Collected Gifts</span>
            <span className="text-2xl font-bold text-emerald-400 block mt-1">{stats.collectedGifts}</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-4">
            <span className="text-xs text-amber-400 uppercase font-semibold">Pending Gifts</span>
            <span className="text-2xl font-bold text-amber-400 block mt-1">{stats.pendingGifts}</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-4">
            <span className="text-xs text-blue-400 uppercase font-semibold">Collected Today</span>
            <span className="text-2xl font-bold text-blue-400 block mt-1">{stats.todayCollectedGifts}</span>
          </CardContent>
        </Card>
      </div>

      {/* Main View Split: Left = Sessions Directory, Right = Selected Session Gift Entries */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Lottery Sessions Directory */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-400" />
              Lottery Sessions
            </h2>
            <span className="text-xs text-slate-400">{sessions.length} Sessions</span>
          </div>

          <div className="space-y-3">
            {isSessionsLoading ? (
              <div className="p-6 text-center text-slate-400 text-sm">Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-400 text-sm">
                No lottery sessions created yet. Click "+ Create Lottery Session" to start.
              </div>
            ) : (
              sessions.map((s) => {
                const isSelected = selectedSession?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSession(s)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                      isSelected
                        ? "bg-slate-800 border-amber-500/50 shadow-lg ring-1 ring-amber-500/30"
                        : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-white text-base">{s.bissiName}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Date: <strong className="text-slate-200">{s.lotteryDate}</strong> {s.lotteryMonth ? `(${s.lotteryMonth})` : ""}
                        </p>
                      </div>
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
                        {s.totalGifts} Gifts
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs pt-1 border-t border-slate-800">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Collected: {s.collectedGifts}
                      </span>
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Pending: {s.pendingGifts}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Session Gift Entries Table */}
        <div className="lg:col-span-8 space-y-4">
          {!selectedSession ? (
            <div className="p-12 bg-slate-900/50 border border-slate-800 rounded-2xl text-center text-slate-400 space-y-2">
              <Gift className="h-10 w-10 mx-auto text-amber-500/60" />
              <p className="text-base font-semibold text-white">Select a Lottery Session</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Click any lottery session on the left to view, search, and manage its winning gift entries.
              </p>
            </div>
          ) : (
            <Card className="bg-slate-900 border-slate-800 shadow-xl">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 gap-4 pb-4">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Gift className="h-5 w-5 text-amber-400" />
                    {selectedSession.bissiName} — {selectedSession.lotteryDate}
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs mt-0.5">
                    Winning Gift Sheet ({activeSessionGifts.length} Gifts Logged)
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Dialog open={isAddGiftOpen} onOpenChange={setIsAddGiftOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs">
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Gift Entry
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Gift className="h-5 w-5 text-amber-500" />
                          Add Winning Gift Entry
                        </DialogTitle>
                        <DialogDescription>
                          Enter Token Number. Customer details will auto-detect from Bissi database.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label>Token Number <span className="text-red-500">*</span></Label>
                          <Input
                            placeholder="e.g. 45 or 18"
                            value={newGiftForm.tokenNumber}
                            onChange={(e) => handleTokenNumberChange(e.target.value)}
                          />
                          {isAutoDetecting && (
                            <span className="text-xs text-amber-400 animate-pulse block">Detecting token customer details...</span>
                          )}
                          {detectedInfo && detectedInfo.found && (
                            <div className="bg-emerald-950/60 border border-emerald-500/30 p-2.5 rounded-lg text-xs space-y-0.5">
                              <span className="text-emerald-300 font-bold block">✓ Customer Detected:</span>
                              <span className="text-slate-200 block">{detectedInfo.customerName} ({detectedInfo.mobileNumber})</span>
                              {detectedInfo.bissiName && (
                                <span className="text-slate-400 block text-[11px]">Bissi: {detectedInfo.bissiName}</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>Customer Name <span className="text-red-500">*</span></Label>
                          <Input
                            placeholder="Auto-detected or enter name"
                            value={newGiftForm.customerName}
                            onChange={(e) => setNewGiftForm({ ...newGiftForm, customerName: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Mobile Number</Label>
                          <Input
                            placeholder="Customer contact number"
                            value={newGiftForm.mobileNumber}
                            onChange={(e) => setNewGiftForm({ ...newGiftForm, mobileNumber: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Gift Name <span className="text-red-500">*</span></Label>
                          <Input
                            placeholder="e.g. AC, Washing Machine, Mixer Grinder, Gold Coin"
                            value={newGiftForm.giftName}
                            onChange={(e) => setNewGiftForm({ ...newGiftForm, giftName: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Category (Optional)</Label>
                            <Input
                              placeholder="e.g. Electronics"
                              value={newGiftForm.giftCategory}
                              onChange={(e) => setNewGiftForm({ ...newGiftForm, giftCategory: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Value (₹) (Optional)</Label>
                            <Input
                              type="number"
                              placeholder="e.g. 25000"
                              value={newGiftForm.giftValue}
                              onChange={(e) => setNewGiftForm({ ...newGiftForm, giftValue: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select
                            value={newGiftForm.status}
                            onValueChange={(val) => setNewGiftForm({ ...newGiftForm, status: val })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pending">Pending (Default)</SelectItem>
                              <SelectItem value="Collected">Collected</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddGiftOpen(false)}>Cancel</Button>
                        <Button
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                          onClick={() => addGiftMutation.mutate(newGiftForm)}
                          disabled={addGiftMutation.isPending}
                        >
                          {addGiftMutation.isPending ? "Saving..." : "Save Gift Entry"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>

              {/* Filters Bar Inside Session */}
              <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search Token, Customer, Gift..."
                    className="pl-8 bg-slate-900 border-slate-800 text-slate-200 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Filter Status:</span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[130px] bg-slate-900 border-slate-800 text-slate-200 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Collected">Collected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <CardContent className="p-0">
                {isDetailLoading ? (
                  <div className="p-8 text-center text-slate-400 text-sm">Loading gift entries...</div>
                ) : filteredGifts.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    No winning gift entries logged for this session yet. Click "+ Add Gift Entry" to add.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Token #</th>
                          <th className="px-4 py-3">Customer Name</th>
                          <th className="px-4 py-3">Gift Won</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {filteredGifts.map((g) => (
                          <tr key={g.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3.5 font-black text-amber-400">
                              #{g.tokenNumber}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-semibold text-white block">{g.customerName}</span>
                              <span className="text-xs text-slate-400 block">{g.mobileNumber}</span>
                            </td>
                            <td className="px-4 py-3.5 font-bold text-slate-100">
                              {g.giftName}
                            </td>
                            <td className="px-4 py-3.5">
                              {g.status === "Collected" ? (
                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-2.5 py-0.5">
                                  ✓ Collected {g.collectionDate ? `(${g.collectionDate})` : ""}
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs px-2.5 py-0.5">
                                  Pending Collection
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              {g.status === "Pending" ? (
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3 py-1 h-8"
                                  onClick={() => {
                                    setSelectedGiftForCollect(g);
                                    setCollectForm({
                                      collectionDate: new Date().toISOString().slice(0, 10),
                                      collectedBy: "Admin",
                                      remarks: "",
                                    });
                                    setIsCollectModalOpen(true);
                                  }}
                                >
                                  Mark Collected
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800 text-xs px-2.5 py-1 h-8"
                                  onClick={() => setViewGiftDetails(g)}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  View
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal: Mark Collected */}
      <Dialog open={isCollectModalOpen} onOpenChange={setIsCollectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Mark Gift as Collected — Token #{selectedGiftForCollect?.tokenNumber}
            </DialogTitle>
            <DialogDescription>
              Confirm receipt of <strong>{selectedGiftForCollect?.giftName}</strong> by {selectedGiftForCollect?.customerName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Collection Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={collectForm.collectionDate}
                onChange={(e) => setCollectForm({ ...collectForm, collectionDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Collected By / Handed Over By</Label>
              <Input
                placeholder="Staff / Admin name"
                value={collectForm.collectedBy}
                onChange={(e) => setCollectForm({ ...collectForm, collectedBy: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Remarks / Receiver Notes</Label>
              <Input
                placeholder="Receiver name or ID proof reference"
                value={collectForm.remarks}
                onChange={(e) => setCollectForm({ ...collectForm, remarks: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCollectModalOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              onClick={() => {
                if (selectedGiftForCollect) {
                  collectGiftMutation.mutate({
                    giftId: selectedGiftForCollect.id,
                    payload: collectForm,
                  });
                }
              }}
              disabled={collectGiftMutation.isPending}
            >
              {collectGiftMutation.isPending ? "Saving..." : "Confirm Collection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: View Collected Gift Details */}
      <Dialog open={Boolean(viewGiftDetails)} onOpenChange={() => setViewGiftDetails(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Gift Collection Record
            </DialogTitle>
          </DialogHeader>

          {viewGiftDetails && (
            <div className="space-y-3 py-2 text-sm">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-amber-400 font-bold text-lg block">Token #{viewGiftDetails.tokenNumber}</span>
                <span className="text-white font-bold text-base block">{viewGiftDetails.customerName}</span>
                <span className="text-slate-400 text-xs block">Mobile: {viewGiftDetails.mobileNumber}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block">Gift Won</span>
                  <span className="font-bold text-white">{viewGiftDetails.giftName}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block">Status</span>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[11px]">
                    Collected
                  </Badge>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 text-xs text-slate-300">
                <p>Collection Date: <strong className="text-white">{viewGiftDetails.collectionDate}</strong></p>
                <p>Handed Over By: <strong className="text-white">{viewGiftDetails.collectedBy || "Admin"}</strong></p>
                {viewGiftDetails.remarks && <p>Remarks: <strong className="text-slate-200">{viewGiftDetails.remarks}</strong></p>}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewGiftDetails(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
