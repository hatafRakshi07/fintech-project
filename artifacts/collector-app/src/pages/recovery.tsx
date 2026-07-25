import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt, getStoredUser, ApiError } from "@/lib/api";
import { safeArray } from "@/lib/utils";
import Header from "@/components/Header";
import { AlertTriangle, Clock, CheckCircle2, Phone, ChevronDown, ChevronUp, X } from "lucide-react";

type RecoveryTask = {
  id: number;
  customerId: number;
  status: string;
  priority: string;
  dueDate?: string | null;
  overdueAmount?: string | null;
  notes?: string | null;
  nextFollowUpDate?: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  collectorName?: string | null;
  branchId: number;
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30",
  in_progress: "bg-sky-500/15 text-sky-500 dark:text-sky-400 border border-sky-500/30",
  resolved: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30",
  escalated: "bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30",
  written_off: "bg-muted text-muted-foreground border border-border",
};

const PRIORITY_CLASSES: Record<string, string> = {
  low: "bg-muted text-muted-foreground border border-border",
  medium: "bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30",
  high: "bg-orange-500/15 text-orange-500 dark:text-orange-400 border border-orange-500/30",
  critical: "bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30",
};

type CallLogForm = {
  outcome: string;
  notes: string;
  nextAction: string;
};

export default function RecoveryPage() {
  const user = getStoredUser();
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [callModal, setCallModal] = useState<RecoveryTask | null>(null);
  const [callForm, setCallForm] = useState<CallLogForm>({ outcome: "no_answer", notes: "", nextAction: "" });
  const [statusFilter, setStatusFilter] = useState("pending,in_progress");

  const { data: rawTasks, isLoading } = useQuery<RecoveryTask[]>({
    queryKey: ["recovery-tasks", user?.branchId, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (user?.branchId) params.set("branchId", String(user.branchId));
      if (statusFilter !== "all") params.set("status", statusFilter.split(",")[0]);
      return api.get(`/recovery/tasks?${params}`);
    },
    refetchInterval: 60_000,
  });
  const tasks = safeArray<RecoveryTask>(rawTasks);

  const patchMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      api.patch(`/recovery/tasks/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recovery-tasks"] }),
  });

  const callMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: object }) =>
      api.post(`/recovery/tasks/${taskId}/calls`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recovery-tasks"] });
      setCallModal(null);
    },
  });

  function handleCall(e: React.FormEvent, task: RecoveryTask) {
    e.preventDefault();
    callMutation.mutate({
      taskId: task.id,
      data: { ...callForm, customerId: task.customerId },
    });
  }

  // Filter tasks shown based on statusFilter
  const filteredTasks = statusFilter === "all"
    ? tasks
    : tasks.filter(t => statusFilter.split(",").includes(t.status));

  return (
    <>
      <Header title="Recovery Operations" />

      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          {[
            { value: "pending,in_progress", label: "Active" },
            { value: "pending", label: "Pending" },
            { value: "in_progress", label: "In Progress" },
            { value: "escalated", label: "Escalated" },
            { value: "all", label: "All Tasks" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                statusFilter === f.value
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "bg-card text-muted-foreground border border-border hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-2xl border border-border p-4 h-20 animate-pulse" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-2xl">
            <CheckCircle2 size={40} className="mx-auto mb-2 opacity-30 text-amber-500" />
            <p className="text-sm font-medium">No recovery tasks found</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTasks.map((task) => (
              <div key={task.id} className="bg-card rounded-2xl border border-border hover:border-amber-500/30 transition-all overflow-hidden shadow-sm">
                {/* Task header */}
                <button
                  onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
                  className="w-full p-4 text-left flex items-start gap-3.5"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle size={17} className="text-amber-500 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-foreground text-sm">{task.customerName ?? "Unknown"}</p>
                      <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase tracking-wider ${PRIORITY_CLASSES[task.priority] ?? "bg-muted text-muted-foreground"}`}>
                        {task.priority}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{task.customerMobile}</p>
                    {task.overdueAmount && (
                      <p className="text-sm font-black text-rose-500 dark:text-rose-400 mt-1">
                        Overdue: {fmt.currency(task.overdueAmount)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${STATUS_CLASSES[task.status] ?? "bg-muted text-muted-foreground"}`}>
                      {task.status.replace("_", " ")}
                    </span>
                    {expandedId === task.id ? (
                      <ChevronUp size={16} className="text-muted-foreground" />
                    ) : (
                      <ChevronDown size={16} className="text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded actions */}
                {expandedId === task.id && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 bg-muted/20">
                    {task.notes && (
                      <p className="text-xs text-foreground bg-muted/40 border border-border rounded-xl p-3 font-medium">
                        {task.notes}
                      </p>
                    )}
                    {task.dueDate && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <Clock size={13} className="text-amber-500" />
                        Due Date: {fmt.date(task.dueDate)}
                      </div>
                    )}
                    {task.nextFollowUpDate && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-500 dark:text-amber-400 font-bold">
                        <Clock size={13} />
                        Next Follow up: {fmt.date(task.nextFollowUpDate)}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setCallModal(task)}
                        className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Phone size={14} />
                        Log Call
                      </button>
                      {task.status !== "resolved" && (
                        <button
                          onClick={() => patchMutation.mutate({ id: task.id, data: { status: "in_progress" } })}
                          disabled={patchMutation.isPending}
                          className="flex-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 dark:text-sky-400 border border-sky-500/30 rounded-xl py-2.5 text-xs font-bold transition-all disabled:opacity-50"
                        >
                          In Progress
                        </button>
                      )}
                      {task.status !== "resolved" && (
                        <button
                          onClick={() => patchMutation.mutate({ id: task.id, data: { status: "resolved" } })}
                          disabled={patchMutation.isPending}
                          className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30 rounded-xl py-2.5 text-xs font-bold transition-all disabled:opacity-50"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Call Modal */}
      {callModal && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setCallModal(null)} />
          <div className="relative bg-card border-t border-border rounded-t-3xl w-full p-6 pb-safe text-foreground shadow-2xl z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Phone size={18} className="text-amber-500" /> Log Customer Call
              </h2>
              <button
                onClick={() => setCallModal(null)}
                className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-xs font-bold text-amber-500 dark:text-amber-400 mb-4">{callModal.customerName}</p>

            <form onSubmit={(e) => handleCall(e, callModal)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Call Outcome
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["no_answer", "called_back", "promised"].map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setCallForm((f) => ({ ...f, outcome: o }))}
                      className={`py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                        callForm.outcome === o
                          ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                          : "bg-muted/50 text-muted-foreground border border-border hover:text-foreground"
                      }`}
                    >
                      {o.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Notes
                </label>
                <textarea
                  value={callForm.notes}
                  onChange={(e) => setCallForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="What was discussed during the call..."
                  className="w-full bg-muted/40 border border-border text-foreground rounded-xl p-3 text-sm focus:outline-none focus:border-amber-500 resize-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Next Action
                </label>
                <input
                  type="text"
                  value={callForm.nextAction}
                  onChange={(e) => setCallForm((f) => ({ ...f, nextAction: e.target.value }))}
                  placeholder="e.g. Call again on Friday at 4 PM"
                  className="w-full h-11 bg-muted/40 border border-border text-foreground rounded-xl px-4 text-sm font-medium focus:outline-none focus:border-amber-500"
                />
              </div>

              {callMutation.error && (
                <p className="text-xs text-rose-500 font-bold bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                  {callMutation.error instanceof ApiError
                    ? callMutation.error.message
                    : "Failed to log call"}
                </p>
              )}

              <button
                type="submit"
                disabled={callMutation.isPending}
                className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 mt-2"
              >
                {callMutation.isPending ? (
                  <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Save Call Log"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
