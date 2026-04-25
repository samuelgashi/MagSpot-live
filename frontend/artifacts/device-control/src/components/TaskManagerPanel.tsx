import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, CheckCircle2, ChevronLeft, ChevronRight, Clock, ListTodo, Loader2, RefreshCw, Search, StopCircle, Trash2, X, XCircle } from "lucide-react";
import { clearMagSpotTasks, getMagSpotTask, getMagSpotTasks, MagSpotTask, stopAllMagSpotTasks, stopMagSpotTask } from "@/lib/magspotApi";
import { useToast } from "@/hooks/use-toast";

const ACCENT = "#00d4e8";
const ACCENT_RGB = "0,212,232";
const PAGE_SIZE = 300;

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
  const [page, setPage] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalTasks / PAGE_SIZE));

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((item) => {
      const status = item.status?.toUpperCase() || "";
      const matchesStatus = statusFilter === "ALL" || status === statusFilter;
      const matchesSearch =
        !q ||
        item.task_id.toLowerCase().includes(q) ||
        (item.task_type || "").toLowerCase().includes(q) ||
        item.device_id.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [searchQuery, statusFilter, tasks]);

  const loadTasks = async (p: number) => {
    setLoadingAll(true);
    try {
      const result = await getMagSpotTasks(p, PAGE_SIZE);
      setTasks(result.tasks || []);
      setTotalTasks(result.total ?? result.tasks?.length ?? 0);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to load tasks", variant: "destructive" });
    } finally {
      setLoadingAll(false);
    }
  };

  useEffect(() => {
    loadTasks(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || loadingAll) return;
    setPage(p);
    loadTasks(p);
  };

  const loadTask = async (id = taskId) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const result = await getMagSpotTask(trimmed);
      setTask(result);
      setTaskId(result.task_id);
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
      await loadTasks(page);
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
      await loadTasks(page);
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
      setTotalTasks(0);
      setPage(1);
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to clear tasks", variant: "destructive" });
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.58)", backdropFilter: "blur(5px)" }}
    >
      <div
        className="w-full sm:max-w-6xl h-[92vh] sm:h-[86vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(10,13,22,0.98)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 28px 90px rgba(0,0,0,0.72)",
        }}
      >
        {/* ── HEADER ── */}
        <div
          className="h-14 flex items-center justify-between px-4 sm:px-5 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `rgba(${ACCENT_RGB},0.12)`, border: `1px solid rgba(${ACCENT_RGB},0.28)` }}
            >
              <ListTodo className="w-4 h-4" style={{ color: ACCENT }} />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Task Manager</div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.36)" }}>
                {loadingAll ? "Loading tasks…" : `${totalTasks} total task(s)`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PanelButton
              onClick={() => { setPage(1); loadTasks(1); }}
              disabled={loadingAll}
              icon={loadingAll ? Loader2 : RefreshCw}
              label="Refresh"
            />
            <PanelButton onClick={stopAll} icon={StopCircle} label="Stop All" danger />
            <PanelButton onClick={clearAll} icon={Trash2} label="Clear All" dangerOutline />
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.58)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── BODY: LEFT + RIGHT ── */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

          {/* ── LEFT: Task List ── */}
          <div
            className="lg:w-[360px] lg:flex-none flex flex-col min-h-0 shrink-0"
            style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}
          >
            {/* Filters */}
            <div className="px-3 pt-3 pb-2 shrink-0 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="h-8 flex-1 rounded-lg px-2 text-xs outline-none"
                  style={inputStyle}
                >
                  {["ALL", "RUNNING", "COMPLETED", "FAILED", "QUEUED", "BUSY", "STOPPED"].map((s) => (
                    <option key={s} value={s} style={{ background: "#0b0f1a", color: "white" }}>
                      {s}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] font-mono shrink-0" style={{ color: "rgba(255,255,255,0.32)" }}>
                  {filteredTasks.length}
                </span>
              </div>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by ID / type / device…"
                className="h-8 w-full rounded-lg px-3 text-xs outline-none text-white placeholder-white/25"
                style={inputStyle}
              />
            </div>

            {/* List */}
            <div className="flex-1 min-h-0 overflow-auto px-2 pb-1 space-y-1">
              {loadingAll ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
                </div>
              ) : filteredTasks.length === 0 ? (
                <EmptyState text="No tasks found." />
              ) : (
                filteredTasks.map((item) => (
                  <button
                    key={item.task_id}
                    onClick={() => loadTask(item.task_id)}
                    className="w-full rounded-xl p-2.5 text-left flex items-center gap-2.5 transition-all hover:bg-white/10"
                    style={{
                      background:
                        task?.task_id === item.task_id
                          ? `rgba(${ACCENT_RGB},0.09)`
                          : "rgba(255,255,255,0.03)",
                      border:
                        task?.task_id === item.task_id
                          ? `1px solid rgba(${ACCENT_RGB},0.28)`
                          : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {statusIcon(item.status)}
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-mono truncate text-white">{item.task_id}</div>
                      <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.38)" }}>
                        {item.device_id}
                        {item.created_at ? ` · ${new Date(item.created_at).toLocaleString()}` : ""}
                      </div>
                    </div>
                    <StatusBadge status={item.status} />
                  </button>
                ))
              )}
            </div>

            {/* Pagination */}
            <div
              className="shrink-0 flex items-center justify-between px-3 py-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
            >
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loadingAll}
                className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-white/10"
                style={{ color: ACCENT }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.46)" }}>
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || loadingAll}
                className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-white/10"
                style={{ color: ACCENT }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── RIGHT: Search + Logs ── */}
          <div className="flex-1 min-h-0 flex flex-col gap-3 p-3 overflow-hidden">

            {/* Search by ID */}
            <div
              className="shrink-0 rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <Search className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                <span className="text-xs font-semibold text-white">Search Task by ID</span>
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); loadTask(); }}
                className="flex gap-2"
              >
                <input
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  placeholder="Enter task ID…"
                  className="h-8 flex-1 rounded-lg px-3 text-xs outline-none text-white placeholder-white/25"
                  style={inputStyle}
                />
                <button
                  disabled={loading || !taskId.trim()}
                  className="h-8 w-9 rounded-lg flex items-center justify-center disabled:opacity-40"
                  style={{
                    background: `rgba(${ACCENT_RGB},0.14)`,
                    border: `1px solid rgba(${ACCENT_RGB},0.32)`,
                    color: ACCENT,
                  }}
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                </button>
              </form>
            </div>

            {/* Task detail + logs */}
            <div
              className="flex-1 min-h-0 rounded-xl p-3 flex flex-col overflow-hidden"
              style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {!task ? (
                <EmptyState text="Select a task from the list or search by ID to view details." />
              ) : (
                <div className="flex flex-col h-full min-h-0 gap-3">
                  {/* Task header row */}
                  <div className="flex items-start justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {statusIcon(task.status)}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">Task {task.task_id}</div>
                        <div className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
                          {task.device_id}
                        </div>
                      </div>
                    </div>
                    {["RUNNING", "IN_PROGRESS", "PENDING", "QUEUED", "BUSY"].includes(
                      task.status.toUpperCase()
                    ) && (
                      <PanelButton onClick={stopTask} icon={StopCircle} label="Stop" dangerOutline compact />
                    )}
                  </div>

                  {/* Progress */}
                  {task.progress !== undefined && (
                    <div className="shrink-0">
                      <div
                        className="flex justify-between text-[10px] mb-1"
                        style={{ color: "rgba(255,255,255,0.45)" }}
                      >
                        <span>Progress</span>
                        <span>{task.progress}%</span>
                      </div>
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.08)" }}
                      >
                        <div
                          className="h-full transition-all"
                          style={{ width: `${task.progress}%`, background: ACCENT }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Logs */}
                  <pre
                    className="flex-1 min-h-0 overflow-auto rounded-lg p-2.5 text-[9px] font-mono leading-relaxed whitespace-pre-wrap"
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.65)",
                      wordBreak: "break-all",
                      overflowWrap: "anywhere",
                      maxWidth: "100%",
                    }}
                  >
                    {task.logs || "No logs available."}
                  </pre>

                  {/* Meta info */}
                  <div className="grid grid-cols-3 gap-2 shrink-0 text-[10px] font-mono">
                    <Info label="Status" value={task.status} />
                    <Info label="Type" value={task.task_type || "command"} />
                    <Info
                      label="Created"
                      value={task.created_at ? new Date(task.created_at).toLocaleString() : "Unknown"}
                    />
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

function PanelButton({
  onClick,
  icon: Icon,
  label,
  disabled,
  danger,
  dangerOutline,
  compact,
}: {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  dangerOutline?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`h-8 ${compact ? "px-2.5" : "px-3"} rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 hover:opacity-90`}
      style={{
        background: danger
          ? "rgba(239,68,68,0.18)"
          : dangerOutline
          ? "rgba(239,68,68,0.08)"
          : `rgba(${ACCENT_RGB},0.12)`,
        border:
          danger || dangerOutline
            ? "1px solid rgba(239,68,68,0.36)"
            : `1px solid rgba(${ACCENT_RGB},0.3)`,
        color: danger || dangerOutline ? "#f87171" : ACCENT,
      }}
    >
      <Icon className={`w-3.5 h-3.5 ${disabled ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="rounded-xl p-8 text-center text-xs"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px dashed rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.28)",
      }}
    >
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide shrink-0"
      style={{ background: `${color}22`, border: `1px solid ${color}55`, color }}
    >
      {status}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg p-2 min-w-0"
      style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="uppercase tracking-widest mb-1 text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>
        {label}
      </div>
      <div className="truncate text-[10px]" style={{ color: "rgba(255,255,255,0.68)" }}>
        {value}
      </div>
    </div>
  );
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
  if (["COMPLETED", "SUCCESS"].includes(upper))
    return <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color }} />;
  if (["FAILED", "ERROR"].includes(upper))
    return <XCircle className="w-4 h-4 shrink-0" style={{ color }} />;
  if (["STOPPED", "CANCELLED"].includes(upper))
    return <StopCircle className="w-4 h-4 shrink-0" style={{ color }} />;
  if (["RUNNING", "IN_PROGRESS", "PENDING", "BUSY"].includes(upper))
    return <Activity className="w-4 h-4 shrink-0 animate-pulse" style={{ color }} />;
  return <Clock className="w-4 h-4 shrink-0" style={{ color }} />;
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "white",
};
