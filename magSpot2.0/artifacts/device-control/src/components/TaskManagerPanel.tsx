import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, AlertCircle, CheckCircle2, Clock, List, ListTodo, Loader2, Search, StopCircle, Trash2, X, XCircle } from "lucide-react";
import { clearMagSpotTasks, getMagSpotTask, getMagSpotTasks, MagSpotTask, stopAllMagSpotTasks, stopMagSpotTask } from "@/lib/magspotApi";
import { useToast } from "@/hooks/use-toast";

const ACCENT = "#00d4e8";
const ACCENT_RGB = "0,212,232";

type StatusFilter = "ALL" | "RUNNING" | "COMPLETED" | "FAILED" | "QUEUED" | "BUSY" | "STOPPED";

export function TaskManagerPanel({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [taskId, setTaskId] = useState("");
  const [task, setTask] = useState<MagSpotTask | null>(null);
  const [tasks, setTasks] = useState<MagSpotTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((item) => {
      const status = item.status?.toUpperCase() || "";
      const matchesStatus = statusFilter === "ALL" || status === statusFilter;
      const matchesSearch = !q || item.task_id.toLowerCase().includes(q) || (item.task_type || "").toLowerCase().includes(q) || item.device_id.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [searchQuery, statusFilter, tasks]);

  const refreshTasks = async () => {
    setLoadingAll(true);
    try {
      const result = await getMagSpotTasks();
      setTasks(result.tasks || []);
      toast({ title: `Found ${result.tasks?.length || 0} task(s)` });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to load tasks", variant: "destructive" });
    } finally {
      setLoadingAll(false);
    }
  };

  const loadTask = async (id = taskId) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const result = await getMagSpotTask(trimmed);
      setTask(result);
      setTaskId(result.task_id);
      toast({ title: `Task status: ${result.status}` });
    } catch (error) {
      setTask(null);
      toast({ title: error instanceof Error ? error.message : "Task not found", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const stopTask = async () => {
    if (!task) return;
    try {
      await stopMagSpotTask(task.task_id);
      await loadTask(task.task_id);
      await refreshTasks();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to stop task", variant: "destructive" });
    }
  };

  const stopAll = async () => {
    if (!window.confirm("Stop all running tasks?")) return;
    try {
      const result = await stopAllMagSpotTasks();
      toast({ title: result.message });
      setTask(null);
      await refreshTasks();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to stop tasks", variant: "destructive" });
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Clear all task records?")) return;
    try {
      const result = await clearMagSpotTasks();
      toast({ title: result.message });
      setTask(null);
      setTasks([]);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to clear tasks", variant: "destructive" });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.58)", backdropFilter: "blur(5px)" }}>
      <div className="w-full sm:max-w-6xl h-[92vh] sm:h-[82vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col" style={{ background: "rgba(10,13,22,0.98)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 28px 90px rgba(0,0,0,0.72)" }}>
        <div className="h-14 flex items-center justify-between px-4 sm:px-5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `rgba(${ACCENT_RGB},0.12)`, border: `1px solid rgba(${ACCENT_RGB},0.28)` }}>
              <ListTodo className="w-4 h-4" style={{ color: ACCENT }} />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Task Manager</div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.36)" }}>Monitor and control running backend tasks</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10" style={{ color: "rgba(255,255,255,0.58)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-5 space-y-4">
          <div className="flex flex-wrap gap-2 justify-end">
            <PanelButton onClick={refreshTasks} disabled={loadingAll} icon={loadingAll ? Loader2 : List} label={loadingAll ? "Loading..." : "Get All Tasks"} />
            <PanelButton onClick={stopAll} icon={StopCircle} label="Stop All Tasks" danger />
            <PanelButton onClick={clearAll} icon={Trash2} label="Clear All Tasks" dangerOutline />
          </div>

          <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <List className="w-4 h-4" style={{ color: ACCENT }} />
                <h3 className="text-sm font-semibold text-white">All Tasks ({filteredTasks.length})</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-8 rounded-lg px-2 text-xs outline-none" style={inputStyle}>
                  {["ALL", "RUNNING", "COMPLETED", "FAILED", "QUEUED", "BUSY", "STOPPED"].map((status) => (
                    <option key={status} value={status} style={{ background: "#0b0f1a", color: "white" }}>{status}</option>
                  ))}
                </select>
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search..." className="h-8 w-full sm:w-56 rounded-lg px-3 text-xs outline-none text-white placeholder-white/25" style={inputStyle} />
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {filteredTasks.length === 0 ? (
                <EmptyState text="No tasks loaded yet." />
              ) : (
                filteredTasks.map((item) => (
                  <button key={item.task_id} onClick={() => loadTask(item.task_id)} className="w-full rounded-xl p-3 text-left flex items-center gap-3 transition-all hover:bg-white/10" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    {statusIcon(item.status)}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono truncate text-white">{item.task_id}</div>
                      <div className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.42)" }}>{item.task_type || "command"} • {item.device_id} {item.created_at ? `• ${new Date(item.created_at).toLocaleString()}` : ""}</div>
                    </div>
                    <StatusBadge status={item.status} />
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4">
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-4 h-4" style={{ color: ACCENT }} />
                <h3 className="text-sm font-semibold text-white">Get Task Status</h3>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); loadTask(); }} className="flex gap-2">
                <input value={taskId} onChange={(event) => setTaskId(event.target.value)} placeholder="Enter task ID..." className="h-9 flex-1 rounded-lg px-3 text-sm outline-none text-white placeholder-white/25" style={inputStyle} />
                <button disabled={loading || !taskId.trim()} className="h-9 w-10 rounded-lg flex items-center justify-center disabled:opacity-40" style={{ background: `rgba(${ACCENT_RGB},0.14)`, border: `1px solid rgba(${ACCENT_RGB},0.32)`, color: ACCENT }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </form>
              <div className="mt-4 rounded-xl p-3 flex gap-3" style={{ background: `rgba(${ACCENT_RGB},0.06)`, border: `1px solid rgba(${ACCENT_RGB},0.14)` }}>
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: ACCENT }} />
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>Tasks are created when backend actions or ADB commands run. Use this panel to inspect, stop, or clear records.</p>
              </div>
            </div>

            <div className="rounded-2xl p-4 min-h-64" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {!task ? (
                <EmptyState text="Select or search a task to view details." />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {statusIcon(task.status)}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">Task {task.task_id}</div>
                        <div className="text-xs font-mono mt-1" style={{ color: "rgba(255,255,255,0.42)" }}>{task.device_id}</div>
                      </div>
                    </div>
                    {["RUNNING", "IN_PROGRESS", "PENDING", "QUEUED", "BUSY"].includes(task.status.toUpperCase()) && (
                      <PanelButton onClick={stopTask} icon={StopCircle} label="Stop" dangerOutline compact />
                    )}
                  </div>
                  {task.progress !== undefined && (
                    <div>
                      <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}><span>Progress</span><span>{task.progress}%</span></div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div className="h-full transition-all" style={{ width: `${task.progress}%`, background: ACCENT }} />
                      </div>
                    </div>
                  )}
                  <pre className="h-52 overflow-auto rounded-xl p-3 text-[11px] font-mono whitespace-pre-wrap" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.68)" }}>{task.logs || "No logs available."}</pre>
                  <div className="grid sm:grid-cols-3 gap-2 text-[11px] font-mono">
                    <Info label="Status" value={task.status} />
                    <Info label="Type" value={task.task_type || "command"} />
                    <Info label="Created" value={task.created_at ? new Date(task.created_at).toLocaleString() : "Unknown"} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PanelButton({ onClick, icon: Icon, label, disabled, danger, dangerOutline, compact }: { onClick: () => void; icon: React.ElementType; label: string; disabled?: boolean; danger?: boolean; dangerOutline?: boolean; compact?: boolean }) {
  return (
    <button title={label} onClick={onClick} disabled={disabled} className={`h-8 ${compact ? "px-3" : "px-3.5"} rounded-lg text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-40 hover:opacity-90`} style={{ background: danger ? "rgba(239,68,68,0.18)" : dangerOutline ? "rgba(239,68,68,0.08)" : `rgba(${ACCENT_RGB},0.12)`, border: danger || dangerOutline ? "1px solid rgba(239,68,68,0.36)" : `1px solid rgba(${ACCENT_RGB},0.3)`, color: danger || dangerOutline ? "#f87171" : ACCENT }}>
      <Icon className={`w-3.5 h-3.5 ${disabled ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl p-8 text-center text-xs" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.28)" }}>{text}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide" style={{ background: `${color}22`, border: `1px solid ${color}55`, color }}>{status}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg p-2 min-w-0" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}><div className="uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.25)" }}>{label}</div><div className="truncate" style={{ color: "rgba(255,255,255,0.68)" }}>{value}</div></div>;
}

function statusColor(status: string) {
  const upper = status.toUpperCase();
  if (["COMPLETED", "SUCCESS"].includes(upper)) return "#22c55e";
  if (["FAILED", "ERROR"].includes(upper)) return "#ef4444";
  if (["STOPPED", "CANCELLED"].includes(upper)) return "#f59e0b";
  if (upper === "BUSY") return "#a855f7";
  return ACCENT;
}

function statusIcon(status: string) {
  const color = statusColor(status);
  const upper = status.toUpperCase();
  if (["COMPLETED", "SUCCESS"].includes(upper)) return <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color }} />;
  if (["FAILED", "ERROR"].includes(upper)) return <XCircle className="w-5 h-5 shrink-0" style={{ color }} />;
  if (["STOPPED", "CANCELLED"].includes(upper)) return <StopCircle className="w-5 h-5 shrink-0" style={{ color }} />;
  if (["RUNNING", "IN_PROGRESS", "PENDING", "BUSY"].includes(upper)) return <Activity className="w-5 h-5 shrink-0 animate-pulse" style={{ color }} />;
  return <Clock className="w-5 h-5 shrink-0" style={{ color }} />;
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "white",
};