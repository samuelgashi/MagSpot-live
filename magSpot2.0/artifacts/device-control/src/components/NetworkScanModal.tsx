import React, { useState } from "react";
import { X, Plus, Trash2, Wifi, RotateCcw } from "lucide-react";
import { useScanDevices, getListDevicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "../lib/lang";

const ACCENT = "#00d4e8";
const ACCENT_RGB = "0,212,232";

interface NetworkSegment {
  id: number;
  range: string;
  port: number;
}

interface NetworkScanModalProps {
  onClose: () => void;
}

export function NetworkScanModal({ onClose }: NetworkScanModalProps) {
  const { t } = useLang();
  const [segments, setSegments] = useState<NetworkSegment[]>([
    { id: 1, range: "192.168.1", port: 5555 },
  ]);
  const [newRange, setNewRange] = useState("192.168.1");
  const [newPort, setNewPort] = useState("5555");
  const [isScanning, setIsScanning] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const scanDevices = useScanDevices();

  const addSegment = () => {
    const r = newRange.trim();
    if (!r) return;
    const port = parseInt(newPort) || 5555;
    setSegments((prev) => [...prev, { id: Date.now(), range: r, port }]);
    setNewRange("192.168.1");
    setNewPort("5555");
  };

  const removeSegment = (id: number) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRestartAdb = async () => {
    setIsRestarting(true);
    try {
      const res = await fetch("/api/devices/restart-adb", { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "ADB server restarted successfully" });
    } catch {
      toast({ title: "Failed to restart ADB", variant: "destructive" });
    } finally {
      setIsRestarting(false);
    }
  };

  const handleScan = async () => {
    if (segments.length === 0) return;
    setIsScanning(true);
    try {
      let totalFound = 0;
      for (const seg of segments) {
        const result = await scanDevices.mutateAsync({ data: { ipRange: seg.range } });
        totalFound += result.length;
      }
      await queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
      toast({ title: t.scanComplete(totalFound) });
      onClose();
    } catch {
      toast({ title: t.scanFailed, variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[520px] rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: "rgba(10,14,24,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2.5">
            <Wifi className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="text-sm font-semibold text-white">{t.networkScanTitle}</span>
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
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Add segment */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              {t.addNetworkSegment}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1">
                <input
                  value={newRange}
                  onChange={(e) => setNewRange(e.target.value)}
                  placeholder="192.168.1"
                  className="flex-1 h-8 px-3 text-sm rounded-lg outline-none text-white placeholder-white/25"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    fontFamily: "var(--app-font-mono)",
                    fontSize: "12px",
                  }}
                />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>–</span>
                <span
                  className="h-8 px-3 flex items-center rounded-lg text-xs font-mono"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.3)",
                    minWidth: "90px",
                  }}
                >
                  {newRange}.1–.254
                </span>
              </div>
              <input
                value={newPort}
                onChange={(e) => setNewPort(e.target.value)}
                placeholder="5555"
                className="h-8 px-3 text-sm rounded-lg outline-none text-white placeholder-white/25 w-20"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontFamily: "var(--app-font-mono)",
                  fontSize: "12px",
                }}
              />
              <button
                onClick={addSegment}
                className="h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                style={{
                  background: `rgba(${ACCENT_RGB},0.12)`,
                  border: `1px solid rgba(${ACCENT_RGB},0.25)`,
                  color: ACCENT,
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
              {t.defaultPortNote}
            </p>
          </div>

          {/* Segment table */}
          {segments.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div
                className="grid text-[10px] font-semibold uppercase tracking-wider px-3 py-2"
                style={{
                  gridTemplateColumns: "40px 1fr 80px 80px",
                  background: "rgba(255,255,255,0.03)",
                  color: "rgba(255,255,255,0.3)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span>#</span>
                <span>{t.networkSegment}</span>
                <span>{t.port}</span>
                <span></span>
              </div>
              {segments.map((seg, i) => (
                <div
                  key={seg.id}
                  className="grid items-center px-3 py-2.5"
                  style={{
                    gridTemplateColumns: "40px 1fr 80px 80px",
                    borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                  }}
                >
                  <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>{i + 1}</span>
                  <span className="text-xs font-mono text-white">{seg.range}.1–{seg.range}.254</span>
                  <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>{seg.port}</span>
                  <div className="flex justify-end">
                    <button
                      onClick={() => removeSegment(seg.id)}
                      className="flex items-center gap-1 text-[11px] font-medium transition-all hover:opacity-80"
                      style={{ color: "#ef4444" }}
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-2.5 px-5 py-3.5 shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* Restart ADB */}
          <button
            onClick={handleRestartAdb}
            disabled={isRestarting}
            className="h-8 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
            style={{
              background: isRestarting ? "rgba(185,28,28,0.4)" : "rgba(185,28,28,0.75)",
              border: "1px solid rgba(239,68,68,0.35)",
              color: isRestarting ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.9)",
              cursor: isRestarting ? "not-allowed" : "pointer",
            }}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRestarting ? "animate-spin" : ""}`} />
            {isRestarting ? "Restarting…" : "Restart ADB"}
          </button>

          <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-lg text-xs font-medium transition-all hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleScan}
            disabled={isScanning || segments.length === 0}
            className="h-8 px-5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2"
            style={{
              background: isScanning || segments.length === 0 ? "rgba(255,255,255,0.08)" : `rgba(${ACCENT_RGB},0.15)`,
              border: `1px solid ${isScanning || segments.length === 0 ? "rgba(255,255,255,0.1)" : `rgba(${ACCENT_RGB},0.35)`}`,
              color: isScanning || segments.length === 0 ? "rgba(255,255,255,0.3)" : ACCENT,
              cursor: isScanning || segments.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            {isScanning ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                {t.scanning}
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5" />
                {t.scan}
              </>
            )}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
