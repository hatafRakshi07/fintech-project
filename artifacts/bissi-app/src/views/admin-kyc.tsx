import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { ShieldCheck, CheckCircle2, XCircle, Eye, Search, ExternalLink, Clock, AlertTriangle } from "lucide-react";
import { KycStatusBadge } from "@/components/kyc/KycStatusBadge";
import { useToast } from "@/hooks/use-toast";

export default function AdminKycManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKyc, setSelectedKyc] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-kyc-pending"],
    queryFn: async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch("/api/kyc/pending", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch pending KYC list");
      return res.json();
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: number; status: string; reason?: string }) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch(`/api/kyc/${id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status, rejectionReason: reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Review submission failed");
      }
      return res.json();
    },
    onSuccess: (resData, variables) => {
      toast({
        title: `KYC Application ${variables.status === "approved" ? "Approved" : "Rejected"}`,
        description: `Successfully updated KYC status.`,
      });
      setSelectedKyc(null);
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-kyc-pending"] });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Action Failed",
        description: err.message || "Failed to update KYC status",
      });
    },
  });

  const list = data?.data || [];

  const filtered = list.filter((item: any) => {
    const kyc = item.kyc;
    const term = searchTerm.toLowerCase();
    return (
      item.userName?.toLowerCase().includes(term) ||
      kyc.userRole?.toLowerCase().includes(term) ||
      kyc.aadhaarNumber?.toLowerCase().includes(term) ||
      kyc.panNumber?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" /> KYC Verification Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review and verify identity documents submitted by Customers, Collectors, and Agents.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg">KYC Applications ({filtered.length})</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, role, Aadhaar..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center animate-pulse">Loading KYC requests...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border border-dashed rounded-xl">
              <ShieldCheck className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="font-semibold">No KYC applications found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Aadhaar</TableHead>
                  <TableHead>PAN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted On</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item: any) => {
                  const kyc = item.kyc;
                  return (
                    <TableRow key={kyc.id}>
                      <TableCell>
                        <div className="font-semibold">{item.userName || `User #${kyc.userId}`}</div>
                        <div className="text-xs text-muted-foreground">{item.userPhone || item.userEmail || ""}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize font-mono">
                          {kyc.userRole}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{kyc.aadhaarNumber || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{kyc.panNumber || "—"}</TableCell>
                      <TableCell>
                        <KycStatusBadge status={kyc.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(kyc.submittedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => setSelectedKyc(item)}
                        >
                          <Eye className="w-3.5 h-3.5" /> Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      {selectedKyc && (
        <Dialog open={!!selectedKyc} onOpenChange={() => setSelectedKyc(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> Review KYC Application
              </DialogTitle>
              <DialogDescription>
                Applicant: <span className="font-semibold text-foreground">{selectedKyc.userName}</span> ({selectedKyc.kyc?.userRole})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/40 p-4 rounded-xl border">
                <div>
                  <span className="text-muted-foreground block text-xs">Aadhaar Number</span>
                  <span className="font-mono font-medium">{selectedKyc.kyc?.aadhaarNumber || "Not Provided"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">PAN Card</span>
                  <span className="font-mono font-medium">{selectedKyc.kyc?.panNumber || "Not Provided"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Bank Name</span>
                  <span className="font-medium">{selectedKyc.kyc?.bankName || "Not Provided"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Account / IFSC</span>
                  <span className="font-mono text-xs">{selectedKyc.kyc?.bankAccountNo} ({selectedKyc.kyc?.bankIfsc})</span>
                </div>
              </div>

              {/* Document Attachments */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Submitted Attachments</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Aadhaar Front", url: selectedKyc.kyc?.aadhaarFrontUrl },
                    { label: "Aadhaar Back", url: selectedKyc.kyc?.aadhaarBackUrl },
                    { label: "PAN Card", url: selectedKyc.kyc?.panCardUrl },
                    { label: "Selfie", url: selectedKyc.kyc?.selfieUrl },
                  ].map((doc, idx) => (
                    <div key={idx} className="border rounded-lg p-2.5 text-center bg-background space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">{doc.label}</p>
                      {doc.url ? (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          <ExternalLink className="w-3 h-3" /> View Doc
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No File</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rejection reason input */}
              <div className="space-y-2">
                <Label htmlFor="rejReason" className="text-xs text-muted-foreground">Rejection Reason (If rejecting)</Label>
                <Input
                  id="rejReason"
                  placeholder="e.g. Document image is blurry or details mismatched"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="destructive"
                className="gap-1.5"
                disabled={reviewMutation.isPending}
                onClick={() =>
                  reviewMutation.mutate({
                    id: selectedKyc.kyc.id,
                    status: "rejected",
                    reason: rejectionReason,
                  })
                }
              >
                <XCircle className="w-4 h-4" /> Reject KYC
              </Button>
              <Button
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={reviewMutation.isPending}
                onClick={() =>
                  reviewMutation.mutate({
                    id: selectedKyc.kyc.id,
                    status: "approved",
                  })
                }
              >
                <CheckCircle2 className="w-4 h-4" /> Approve KYC
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
