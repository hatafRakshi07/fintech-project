import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt, getStoredUser, ApiError } from "@/lib/api";
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

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  escalated: "bg-red-100 text-red-700",
  written_off: "bg-gray-100 text-gray-500",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-500",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
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

  const { data: tasks = [], isLoading } = useQuery<RecoveryTask[]>({
    queryKey: ["recovery-tasks", user?.branchId, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (user?.branchId) params.set("branchId", String(user.branchId));
      if (statusFilter !== "all") params.set("status", statusFilter.split(",")[0]);
      return api.get(`/recovery/tasks?${params}`);
    },
    refetchInterval: 60_000,
  });

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
      <Header title="Recovery Tasks" />

      <div className="p-4 space-y-3">
        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {[
            { value: "pending,in_progress", label: "Active" },
            { value: "pending", label: "Pending" },
            { value: "in_progress", label: "In Progress" },
            { value: "escalated", label: "Escalated" },
            { value: "all", label: "All" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${statusFilter === f.value ? "bg-indigo-600 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-20 animate-pulse" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CheckCircle2 size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No recovery tasks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <div key={task.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Task header */}
                <button
                  onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
                  className="w-full p-4 text-left flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-gray-800 text-sm">{task.customerName ?? "Unknown"}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority] ?? "bg-gray-100 text-gray-500"}`}>
                        {task.priority}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{task.customerMobile}</p>
                    {task.overdueAmount && (
                      <p className="text-sm font-semibold text-red-600 mt-0.5">
                        Overdue: {fmt.currency(task.overdueAmount)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {task.status.replace("_", " ")}
                    </span>
                    {expandedId === task.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </div>
                </button>

                {/* Expanded actions */}
                {expandedId === task.id && (
                  <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-3">
                    {task.notes && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">{task.notes}</p>
                    )}
                    {task.dueDate && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock size={12} />
                        Due: {fmt.date(task.dueDate)}
                      </div>
                    )}
                    {task.nextFollowUpDate && (
                      <div className="flex items-center gap-1.5 text-xs text-indigo-500">
                        <Clock size={12} />
                        Follow up: {fmt.date(task.nextFollowUpDate)}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setCallModal(task)}
                        className="flex-1 bg-indigo-50 text-indigo-700 rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 active:bg-indigo-100">
                        <Phone size={14} />
                        Log Call
                      </button>
                      {task.status !== "resolved" && (
                        <button
                          onClick={() => patchMutation.mutate({ id: task.id, data: { status: "in_progress" } })}
                          disabled={patchMutation.isPending}
                          className="flex-1 bg-blue-50 text-blue-700 rounded-xl py-2.5 text-sm font-medium active:bg-blue-100 disabled:opacity-60">
                          In Progress
                        </button>
                      )}
                      {task.status !== "resolved" && (
                        <button
                          onClick={() => patchMutation.mutate({ id: task.id, data: { status: "resolved" } })}
                          disabled={patchMutation.isPending}
                          className="flex-1 bg-green-50 text-green-700 rounded-xl py-2.5 text-sm font-medium active:bg-green-100 disabled:opacity-60">
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
          <div className="absolute inset-0 bg-black/40" onClick={() => setCallModal(null)} />
          <div className="relative bg-white rounded-t-3xl w-full p-6 pb-safe">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">Log Call</h2>
              <button onClick={() => setCallModal(null)} className="p-1 text-gray-400">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-indigo-600 font-medium mb-4">{callModal.customerName}</p>

            <form onSubmit={(e) => handleCall(e, callModal)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Call Outcome</label>
                <div className="grid grid-cols-3 gap-2">
                  {["no_answer", "called_back", "promised"].map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setCallForm(f => ({ ...f, outcome: o }))}
                      className={`py-2 rounded-xl text-xs font-medium transition-colors
                        ${callForm.outcome === o ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                      {o.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={callForm.notes}
                  onChange={(e) => setCallForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="What was discussed..."
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Action</label>
                <input
                  type="text"
                  value={callForm.nextAction}
                  onChange={(e) => setCallForm(f => ({ ...f, nextAction: e.target.value }))}
                  placeholder="e.g. Call again on Friday"
                  className="w-full h-11 border border-gray-300 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {callMutation.error && (
                <p className="text-sm text-red-600">
                  {callMutation.error instanceof ApiError ? callMutation.error.message : "Failed to log call"}
                </p>
              )}

              <button
                type="submit"
                disabled={callMutation.isPending}
                className="w-full h-12 bg-indigo-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
                {callMutation.isPending ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : "Save Call Log"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
