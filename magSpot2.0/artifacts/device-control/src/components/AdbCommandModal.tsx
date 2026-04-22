import React, { useState, useRef, useEffect } from "react";
import { X, Plus, Terminal, Play, RefreshCw } from "lucide-react";
import { useLang } from "../lib/lang";
import { Device } from "@workspace/api-client-react";
import { executeMagSpotAdbCommand } from "@/lib/magspotApi";

const ACCENT = "#00d4e8";
const ACCENT_RGB = "0,212,232";

const STORAGE_KEY = "magspot_adb_saved_commands_v2";

interface SavedCommand {
  id: string;
  name: string;
  command: string;
}

function loadSaved(): SavedCommand[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSaved(cmds: SavedCommand[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cmds));
}

interface AdbCommandModalProps {
  selectedCount: number;
  selectedDevices: Device[];
  onClose: () => void;
}

interface LogEntry {
  id: number;
  text: string;
  type: "cmd" | "out" | "err";
}

interface ContextMenu {
  x: number;
  y: number;
  id: string;
}

export function AdbCommandModal({ selectedCount, selectedDevices, onClose }: AdbCommandModalProps) {
  const { t } = useLang();
  const [command, setCommand] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [savedCommands, setSavedCommands] = useState<SavedCommand[]>(loadSaved);

  // Add overlay
  const [showAddSaved, setShowAddSaved] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCmd, setAddCmd] = useState("");

  // Edit overlay
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCmd, setEditCmd] = useState("");

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  const appendLog = (text: string, type: LogEntry["type"]) => {
    setLog((prev) => [...prev, { id: ++logIdRef.current, text, type }]);
  };

  const executeCommand = async (cmd: string) => {
    const c = cmd.trim();
    if (!c) return;
    if (selectedCount === 0) {
      appendLog(t.noDeviceSelected, "err");
      return;
    }
    try {
      const { normalized, results } = await executeMagSpotAdbCommand(selectedDevices, c);
      appendLog(`$ adb -s <device> ${normalized.display}`, "cmd");
      results.forEach((result) => {
        const prefix = `[${result.deviceId}]`;
        if (result.success) {
          appendLog(`${prefix} ${result.output || "OK"}`, "out");
        } else {
          appendLog(`${prefix} ${result.error || "Command failed"}`, "err");
        }
      });
      appendLog(t.cmdSent(selectedCount, c), results.some((result) => !result.success) ? "err" : "out");
      setCommand("");
    } catch (error) {
      appendLog(error instanceof Error ? error.message : "Failed to send command", "err");
    }
  };

  // ── Add ──
  const openAdd = () => {
    setAddName("");
    setAddCmd("");
    setShowAddSaved(true);
  };
  const closeAdd = () => setShowAddSaved(false);
  const saveCommand = () => {
    const name = addName.trim();
    const cmd = addCmd.trim();
    if (!name || !cmd) return;
    const entry: SavedCommand = { id: Date.now().toString(), name, command: cmd };
    const updated = [...savedCommands, entry];
    setSavedCommands(updated);
    saveSaved(updated);
    setShowAddSaved(false);
  };

  // ── Delete ──
  const removeSavedCommand = (id: string) => {
    const updated = savedCommands.filter((c) => c.id !== id);
    setSavedCommands(updated);
    saveSaved(updated);
  };

  // ── Edit ──
  const openEdit = (id: string) => {
    const sc = savedCommands.find((c) => c.id === id);
    if (!sc) return;
    setEditId(id);
    setEditName(sc.name);
    setEditCmd(sc.command);
    setContextMenu(null);
  };
  const closeEdit = () => setEditId(null);
  const commitEdit = () => {
    const name = editName.trim();
    const cmd = editCmd.trim();
    if (!name || !cmd || !editId) return;
    const updated = savedCommands.map((c) =>
      c.id === editId ? { ...c, name, command: cmd } : c
    );
    setSavedCommands(updated);
    saveSaved(updated);
    setEditId(null);
  };

  // ── Context menu ──
  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, id });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[700px] rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: "rgba(10,14,24,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          maxHeight: "80vh",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="text-sm font-semibold text-white">{t.adbCommandTitle}</span>
            <span
              className="text-[11px] px-2 py-0.5 rounded font-mono"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
            >
              {t.devicesSelected(selectedCount)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg transition-all hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left: command input + log */}
          <div className="flex flex-col flex-1 overflow-hidden p-4 gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") executeCommand(command); }}
                placeholder="Enter ADB command…"
                className="flex-1 h-8 px-3 text-sm rounded-lg outline-none text-white placeholder-white/25"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontFamily: "var(--app-font-mono)",
                  fontSize: "12px",
                }}
              />
              <button
                onClick={() => executeCommand(command)}
                disabled={!command.trim()}
                className="h-8 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                style={{
                  background: command.trim() ? `rgba(${ACCENT_RGB},0.15)` : "rgba(255,255,255,0.05)",
                  border: `1px solid ${command.trim() ? `rgba(${ACCENT_RGB},0.35)` : "rgba(255,255,255,0.08)"}`,
                  color: command.trim() ? ACCENT : "rgba(255,255,255,0.25)",
                  cursor: command.trim() ? "pointer" : "not-allowed",
                }}
              >
                <Play className="w-3.5 h-3.5" />
                {t.run}
              </button>
            </div>

            <div
              ref={logRef}
              className="flex-1 overflow-y-auto p-3 rounded-xl font-mono text-[11px] leading-relaxed"
              style={{
                background: "rgba(0,0,0,0.45)",
                border: "1px solid rgba(255,255,255,0.06)",
                minHeight: "200px",
              }}
            >
              {log.length === 0 ? (
                <span style={{ color: "rgba(255,255,255,0.18)" }}>Ready. Enter a command to execute…</span>
              ) : (
                log.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      color:
                        entry.type === "cmd" ? ACCENT
                        : entry.type === "err" ? "#ef4444"
                        : "rgba(255,255,255,0.7)",
                    }}
                  >
                    {entry.text}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setLog([])}
                  className="text-[11px] transition-all hover:opacity-80"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  {t.clearLog}
                </button>
                <button
                  onClick={async () => {
                    setLog((prev) => [...prev, { id: Date.now(), text: "$ Restarting ADB server…", type: "cmd" }]);
                    try {
                      const res = await fetch("/api/devices/restart-adb", { method: "POST" });
                      const json = await res.json();
                      setLog((prev) => [
                        ...prev,
                        { id: Date.now() + 1, text: json.output || "ADB restarted.", type: "out" },
                        ...(json.error ? [{ id: Date.now() + 2, text: json.error, type: "err" as const }] : []),
                      ]);
                    } catch (e: unknown) {
                      setLog((prev) => [...prev, { id: Date.now() + 1, text: String(e), type: "err" }]);
                    }
                  }}
                  className="text-[11px] flex items-center gap-1 transition-all hover:opacity-80"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  <RefreshCw className="w-3 h-3" />
                  Restart ADB
                </button>
              </div>
              <a
                href="https://developer.android.com/tools/adb"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] flex items-center gap-1 transition-all hover:opacity-80"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                ⊙ ADB Reference
              </a>
            </div>
          </div>

          {/* Right: saved commands */}
          <div
            className="w-[220px] shrink-0 flex flex-col overflow-hidden relative"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}
          >
            {/* Saved header */}
            <div
              className="flex items-center justify-between px-3 py-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                {t.saved}
              </span>
              <button
                onClick={openAdd}
                className="w-5 h-5 flex items-center justify-center rounded transition-all hover:bg-white/10"
                style={{ color: ACCENT }}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Saved list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1.5">
              {savedCommands.length === 0 ? (
                <span className="text-[10px] mt-2 px-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {t.noSavedCommands}
                </span>
              ) : (
                savedCommands.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => executeCommand(sc.command)}
                    onContextMenu={(e) => handleContextMenu(e, sc.id)}
                    title={sc.command}
                    className="w-full text-left px-2.5 py-2 rounded-lg transition-all select-none"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div className="text-[11px] font-semibold text-white truncate">{sc.name}</div>
                    <div
                      className="text-[10px] font-mono truncate mt-0.5"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                      {sc.command}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Add overlay */}
            {showAddSaved && (
              <CommandOverlay
                title="Add"
                name={addName}
                cmd={addCmd}
                onChangeName={setAddName}
                onChangeCmd={setAddCmd}
                onSave={saveCommand}
                onClose={closeAdd}
                onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) saveCommand(); }}
              />
            )}

            {/* Edit overlay */}
            {editId && (
              <CommandOverlay
                title="Edit"
                name={editName}
                cmd={editCmd}
                onChangeName={setEditName}
                onChangeCmd={setEditCmd}
                onSave={commitEdit}
                onClose={closeEdit}
                onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) commitEdit(); }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Context menu (portal-style, fixed position) */}
      {contextMenu && (
        <div
          ref={ctxRef}
          className="fixed z-[200] rounded-xl overflow-hidden"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            background: "rgba(14,18,30,0.98)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
            minWidth: "140px",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <CtxItem
            label="Edit"
            icon="✎"
            onClick={() => openEdit(contextMenu.id)}
          />
          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "0 8px" }} />
          <CtxItem
            label="Delete"
            icon="✕"
            danger
            onClick={() => {
              removeSavedCommand(contextMenu.id);
              setContextMenu(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

function CtxItem({
  label,
  icon,
  danger,
  onClick,
}: {
  label: string;
  icon: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium transition-all"
      style={{
        color: danger ? "#f87171" : "rgba(255,255,255,0.8)",
        background: "transparent",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = danger
          ? "rgba(239,68,68,0.12)"
          : "rgba(255,255,255,0.07)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ fontSize: "13px", lineHeight: 1 }}>{icon}</span>
      {label}
    </button>
  );
}

function CommandOverlay({
  title,
  name,
  cmd,
  onChangeName,
  onChangeCmd,
  onSave,
  onClose,
  onKeyDown,
}: {
  title: string;
  name: string;
  cmd: string;
  onChangeName: (v: string) => void;
  onChangeCmd: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const ACCENT = "#00d4e8";
  const ACCENT_RGB = "0,212,232";
  const valid = name.trim() && cmd.trim();

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: "rgba(10,14,24,0.98)", zIndex: 10 }}
    >
      <div
        className="flex items-center justify-between px-3 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <span className="text-xs font-semibold text-white">{title}</span>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded transition-all hover:bg-white/10"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-3 px-3 py-3 flex-1">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            ADB Name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Please enter the ADB name"
            className="w-full h-8 px-3 rounded-lg text-xs outline-none text-white placeholder-white/20"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          />
        </div>

        <div className="flex-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            ADB command
          </label>
          <textarea
            value={cmd}
            onChange={(e) => onChangeCmd(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Please enter the ADB command"
            className="w-full px-3 py-2 rounded-lg text-xs outline-none text-white placeholder-white/20 resize-none"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontFamily: "var(--app-font-mono)",
              height: "80px",
            }}
          />
        </div>
      </div>

      <div
        className="flex items-center justify-between px-3 py-2.5 shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <a
          href="https://developer.android.com/tools/adb"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] transition-all hover:opacity-80"
          style={{ color: ACCENT }}
        >
          ADB command tutorial
        </a>
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={!valid}
            className="h-7 px-3 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: valid ? `rgba(${ACCENT_RGB},0.8)` : "rgba(255,255,255,0.08)",
              color: valid ? "white" : "rgba(255,255,255,0.3)",
              cursor: valid ? "pointer" : "not-allowed",
            }}
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="h-7 px-3 rounded-lg text-xs font-medium transition-all hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
