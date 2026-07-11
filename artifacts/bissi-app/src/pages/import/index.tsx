import React, { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Download, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useListBranches } from "@workspace/api-client-react";

type ValidationIssue = { row: number; field: string; message: string };
type ImportResult = {
  total: number; created: number; updated: number; skipped: number; failed: number;
  errors: Array<{ row: number; reason: string; data: unknown }>;
  log: string[];
};
type ParsedRow = Record<string, string>;

const REQUIRED_COLUMNS = ["name", "mobile"];
const OPTIONAL_COLUMNS = ["email", "address", "city", "aadhaar", "pan", "alternateMobile", "nomineeName", "nomineeRelation", "referenceName", "recoveryNotes", "status"];
const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["Name", "Full Name", "Customer Name", "नाम"],
  mobile: ["Mobile", "Phone", "Mobile No", "Mobile Number", "मोबाइल"],
  email: ["Email", "Email ID", "ईमेल"],
  address: ["Address", "पता"],
  city: ["City", "शहर"],
  aadhaar: ["Aadhaar", "Aadhaar No", "Aadhaar Number", "आधार"],
  pan: ["PAN", "PAN No", "PAN Card"],
  alternateMobile: ["Alternate Mobile", "Alt Phone", "Alt Mobile", "Alternate Phone", "दूसरा मोबाइल"],
  nomineeName: ["Nominee", "Nominee Name", "नॉमिनी"],
  nomineeRelation: ["Nominee Relation", "Relation", "रिश्ता"],
  referenceName: ["Reference", "Reference Name", "Referred By", "रेफरेंस"],
  recoveryNotes: ["Recovery Notes", "Notes", "Remarks", "नोट्स"],
  status: ["Status", "स्थिति"],
};

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/"/g, ""));
    const row: ParsedRow = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

function normalizeRow(raw: ParsedRow): ParsedRow {
  const normalized: ParsedRow = {};
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    const match = [canonical, ...aliases].find(alias =>
      Object.keys(raw).some(k => k.toLowerCase() === alias.toLowerCase())
    );
    if (match) {
      const key = Object.keys(raw).find(k => k.toLowerCase() === match.toLowerCase());
      if (key) normalized[canonical] = raw[key];
    }
  }
  // Copy unmapped columns as-is
  for (const [k, v] of Object.entries(raw)) {
    if (!Object.keys(normalized).length || !Object.values(COLUMN_ALIASES).flat().some(a => a.toLowerCase() === k.toLowerCase())) {
      normalized[k] = v;
    }
  }
  return normalized;
}

export default function ImportPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState("upload");
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [normalizedRows, setNormalizedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [branchId, setBranchId] = useState("1");
  const [validationResult, setValidationResult] = useState<{ valid: boolean; total: number; issues: ValidationIssue[] } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const { data: branches = [] } = useListBranches();

  const validate = useMutation({
    mutationFn: (rows: ParsedRow[]) => api.post<{ valid: boolean; total: number; issues: ValidationIssue[] }>("/import/customers/validate", { rows }),
    onSuccess: (data) => {
      setValidationResult(data);
      setTab("validate");
      if (data.valid) {
        toast({ title: "Validation passed", description: `${data.total} rows ready to import` });
      } else {
        toast({ title: `${data.issues.length} validation issues found`, variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: "Validation failed", description: e.message, variant: "destructive" }),
  });

  const importData = useMutation({
    mutationFn: (rows: ParsedRow[]) => api.post<ImportResult>("/import/customers", { rows, branchId: parseInt(branchId) }),
    onSuccess: (data) => {
      setImportResult(data);
      setTab("result");
      toast({
        title: "Import complete",
        description: `Created ${data.created}, Updated ${data.updated}, Failed ${data.failed}`,
      });
    },
    onError: (e: any) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();

    let rows: ParsedRow[] = [];
    if (file.name.endsWith(".csv") || file.type === "text/csv") {
      rows = parseCSV(text);
    } else if (file.name.endsWith(".tsv")) {
      const lines = text.trim().split("\n");
      if (lines.length >= 2) {
        const headers = lines[0].split("\t").map(h => h.trim());
        rows = lines.slice(1).filter(l => l.trim()).map(line => {
          const values = line.split("\t").map(v => v.trim());
          const row: ParsedRow = {};
          headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
          return row;
        });
      }
    } else {
      toast({ title: "Unsupported format", description: "Please use CSV or TSV. For XLSX, export from Excel as CSV first.", variant: "destructive" });
      return;
    }

    if (rows.length === 0) {
      toast({ title: "No data found", description: "The file appears to be empty or incorrectly formatted.", variant: "destructive" });
      return;
    }

    const normalized = rows.map(normalizeRow);
    setRawRows(rows);
    setNormalizedRows(normalized);
    setValidationResult(null);
    setImportResult(null);
    setTab("preview");
    toast({ title: `${rows.length} rows loaded`, description: `File: ${file.name}` });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const downloadTemplate = () => {
    const headers = ["name", "mobile", "email", "address", "city", "aadhaar", "pan", "alternateMobile", "nomineeName", "nomineeRelation"];
    const example = ["Rajesh Kumar", "9876543210", "rajesh@example.com", "123 Main St", "Mumbai", "123456789012", "ABCDE1234F", "9876543211", "Priya Kumar", "Wife"];
    const csv = [headers.join(","), example.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "customer_import_template.csv";
    a.click(); URL.revokeObjectURL(url);
  };

  const previewHeaders = normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Excel / CSV Import</h1>
        <p className="text-muted-foreground">Import customer data from Excel or CSV files</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upload">1. Upload</TabsTrigger>
          <TabsTrigger value="preview" disabled={rawRows.length === 0}>2. Preview</TabsTrigger>
          <TabsTrigger value="validate" disabled={!validationResult}>3. Validate</TabsTrigger>
          <TabsTrigger value="result" disabled={!importResult}>4. Result</TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="mt-4 space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Supported Formats</AlertTitle>
            <AlertDescription>
              CSV and TSV files are supported directly. For XLSX/XLS files, export from Excel as CSV first (File → Save As → CSV).
              Column headers are matched automatically — see the template for the expected format.
            </AlertDescription>
          </Alert>

          <Card>
            <CardContent className="pt-6">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Drop your CSV file here</h3>
                <p className="text-muted-foreground mb-4">or click to browse</p>
                <Button variant="outline" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  <Upload className="mr-2 h-4 w-4" />Browse Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv,.tsv,.txt"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Need a template? Download the sample CSV file.</p>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />Download Template
            </Button>
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-semibold">Preview — {fileName}</h2>
              <p className="text-sm text-muted-foreground">{normalizedRows.length} rows detected</p>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <Label>Default Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(branches as any[]).map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => validate.mutate(normalizedRows)} disabled={validate.isPending}>
                {validate.isPending ? "Validating..." : "Validate Data"}
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    {previewHeaders.map(h => (
                      <TableHead key={h}>
                        <div className="flex items-center gap-1">
                          {h}
                          {REQUIRED_COLUMNS.includes(h) && <Badge variant="destructive" className="text-[10px] px-1 py-0">req</Badge>}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {normalizedRows.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      {previewHeaders.map(h => (
                        <TableCell key={h}>{row[h] || <span className="text-muted-foreground">—</span>}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {normalizedRows.length > 10 && (
                    <TableRow>
                      <TableCell colSpan={previewHeaders.length + 1} className="text-center text-muted-foreground py-3">
                        ... and {normalizedRows.length - 10} more rows
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Validate Tab */}
        <TabsContent value="validate" className="mt-4 space-y-4">
          {validationResult && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className={validationResult.valid ? "border-green-500" : "border-orange-400"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      {validationResult.valid ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-orange-500" />}
                      Validation Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${validationResult.valid ? "text-green-600" : "text-orange-600"}`}>
                      {validationResult.valid ? "PASSED" : "WARNINGS"}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Rows</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{validationResult.total}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Issues Found</CardTitle></CardHeader>
                  <CardContent><div className={`text-2xl font-bold ${validationResult.issues.length > 0 ? "text-orange-600" : "text-green-600"}`}>{validationResult.issues.length}</div></CardContent>
                </Card>
              </div>

              {validationResult.issues.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Validation Issues</CardTitle></CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Field</TableHead>
                          <TableHead>Issue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationResult.issues.map((issue, i) => (
                          <TableRow key={i}>
                            <TableCell><Badge variant="outline">Row {issue.row}</Badge></TableCell>
                            <TableCell className="font-medium">{issue.field}</TableCell>
                            <TableCell className="text-muted-foreground">{issue.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTab("preview")}>Back to Preview</Button>
                <Button onClick={() => importData.mutate(normalizedRows)} disabled={importData.isPending}>
                  {importData.isPending ? "Importing..." : `Import ${validationResult.total} Rows`}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* Result Tab */}
        <TabsContent value="result" className="mt-4 space-y-4">
          {importResult && (
            <>
              <div className="grid gap-4 md:grid-cols-5">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{importResult.total}</div></CardContent>
                </Card>
                <Card className="border-green-500">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-green-500" />Created</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-green-600">{importResult.created}</div></CardContent>
                </Card>
                <Card className="border-blue-500">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Updated</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-blue-600">{importResult.updated}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Skipped</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{importResult.skipped}</div></CardContent>
                </Card>
                <Card className={importResult.failed > 0 ? "border-red-500" : ""}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-1"><XCircle className="h-4 w-4 text-destructive" />Failed</CardTitle></CardHeader>
                  <CardContent><div className={`text-2xl font-bold ${importResult.failed > 0 ? "text-destructive" : ""}`}>{importResult.failed}</div></CardContent>
                </Card>
              </div>

              {importResult.errors.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base text-destructive">Failed Rows</CardTitle></CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.errors.map((err, i) => (
                          <TableRow key={i}>
                            <TableCell><Badge variant="destructive">Row {err.row}</Badge></TableCell>
                            <TableCell className="text-muted-foreground">{err.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {importResult.log.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Import Log</CardTitle></CardHeader>
                  <CardContent>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {importResult.log.map((line, i) => (
                        <div key={i} className="text-xs text-muted-foreground font-mono">{line}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => { setTab("upload"); setRawRows([]); setNormalizedRows([]); setFileName(""); setValidationResult(null); setImportResult(null); }}>
                  Import Another File
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
