import React, { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ImportPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const token = localStorage.getItem("auth_token") || "";
      
      // We can't use customFetch easily for multipart without configuring it,
      // so we use standard fetch for this specific endpoint.
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
      const res = await fetch(`${baseUrl}/v2/migration/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });
      
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Upload failed");
      }
      return json.data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Migration complete",
        description: `Processed ${data.totalProcessed} rows. ${data.successCount} successful.`,
      });
    },
    onError: (e: any) => toast({ title: "Migration failed", description: e.message, variant: "destructive" }),
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Excel Data Migration</h1>
        <p className="text-muted-foreground">Upload your legacy Excel workbooks to migrate customers into the active Bissi scheme.</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Supported Formats</AlertTitle>
        <AlertDescription>
          Upload standard .xlsx or .csv files. The system expects columns containing Customer Name and Mobile.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6">
          <div
            className="border-2 border-dashed border-indigo-200 rounded-lg p-12 text-center cursor-pointer hover:border-indigo-400 bg-indigo-50/30 transition-colors"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileSpreadsheet className="h-12 w-12 mx-auto text-indigo-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">{selectedFile ? selectedFile.name : "Drop your Excel file here"}</h3>
            <p className="text-muted-foreground mb-4">{selectedFile ? "Ready to migrate" : "or click to browse"}</p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <Upload className="mr-2 h-4 w-4" />Browse File
              </Button>
              {selectedFile && (
                <Button 
                  onClick={(e) => { e.stopPropagation(); uploadMutation.mutate(selectedFile); }}
                  disabled={uploadMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {uploadMutation.isPending ? "Processing..." : "Start Migration"}
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }}
            />
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-xl font-bold mt-8">Migration Results</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Rows</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{result.totalProcessed}</div></CardContent>
            </Card>
            <Card className="border-green-500 bg-green-50/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-green-600" />Successful</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-green-700">{result.successCount}</div></CardContent>
            </Card>
            <Card className={result.errorCount > 0 ? "border-red-500 bg-red-50/50" : ""}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-1"><XCircle className="h-4 w-4 text-red-600" />Failed</CardTitle></CardHeader>
              <CardContent><div className={`text-2xl font-bold ${result.errorCount > 0 ? "text-red-700" : ""}`}>{result.errorCount}</div></CardContent>
            </Card>
          </div>

          {result.errors && result.errors.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base text-red-600">Error Log</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Error Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.map((err: string, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm text-slate-700">{err}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {result.logs && result.logs.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base text-slate-700">Success Log</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto space-y-1 bg-slate-50 p-4 rounded-md border">
                  {result.logs.map((line: string, i: number) => (
                    <div key={i} className="text-xs text-slate-600 font-mono border-b border-slate-100 pb-1">{line}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
