import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, CheckCircle2, Clock3, Plus, Search, Trash2, X } from "lucide-react";
import { Device } from "@workspace/api-client-react";
import { useLang } from "@/lib/lang";
import { getTodayDateKey, useAppTimezone } from "@/lib/timezone";
import {
  deleteScheduleBlocks,
  deleteScheduleDayForDevices,
  loadSavedScheduleResult,
  saveScheduleResult,
  SavedScheduleBlock,
  ScheduleBlockRef,
  SchedulePlanScope,
} from "@/lib/scheduleResults";
import { ACTIVITY_META, ActivityType } from "./PlatformLogos";

const ACCENT = "#00d4e8";
const ACCENT_RGB = "0,212,232";

const ACT_LABEL: Record<string, string> = {
  google_search: "Google",
  ytm_artist: "Artist",
  ytm_album: "Album",
  ytm_single: "Single",
  ytm_playlist: "Playlist",
  ytm_library: "Library",
  yt_shorts: "Shorts",
  tiktok: "TikTok",
  sleep: "Sleep",
};

const ACT_COLORS: Record<string, string> = {
  google_search: "rgba(59,130,246,.65)",
  ytm_artist: "rgba(100,5,5,.88)",
  ytm_album: "rgba(220,38,38,.72)",
  ytm_single: "rgba(252,110,110,.68)",
  ytm_playlist: "rgba(22,163,74,.75)",
  ytm_library: "rgba(134,239,172,.62)",
  yt_shorts: "rgba(240,240,240,.55)",
  tiktok: "rgba(12,12,12,.92)",
  sleep: "rgba(120,100,220,.72)",
};

const LOGO_ACTS = new Set(["google_search", "yt_shorts", "tiktok"]);

function formatDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatTime(value: number) {
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDuration(startH: number, endH: number) {
  const totalMinutes = Math.max(0, Math.round((endH - startH) * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function blocksForDay(blocks: SavedScheduleBlock[], dayIndex: number) {
  const start = dayIndex * 24;
  const end = start + 24;
  return blocks
    .filter((block) => block.absEnd > start && block.absStart < end)
    .map((block) => ({
      act: block.act,
      startH: Math.max(block.absStart, start) - start,
      endH: Math.min(block.absEnd, end) - start,
    }))
    .sort((a, b) => a.startH - b.startH);
}

function TimelineLabel({ act, width }: { act: string; width: number }) {
  const label = ACT_LABEL[act] ?? act;
  if (LOGO_ACTS.has(act) && act in ACTIVITY_META) {
    return (
      <span className="flex items-center justify-center w-full h-full px-0.5">
        {ACTIVITY_META[act as ActivityType].logo(width > 2 ? 14 : 10)}
      </span>
    );
  }
  if (act === "sleep") {
    return (
      <span className="text-[9px] font-bold leading-none truncate px-0.5" aria-label={label}>
        {width > 4 ? "Sleep" : "💤"}
      </span>
    );
  }
  return (
    <span
      className="font-bold truncate text-center leading-none px-0.5"
      style={{ fontSize: width > 4 ? 9 : 8, color: "rgba(255,255,255,0.86)", maxWidth: "100%" }}
    >
      {width > 4 ? label : width > 2.2 ? label.slice(0, 3) : label.slice(0, 1)}
    </span>
  );
}

function blockKey(deviceId: number, dayIndex: number, block: { act: string; startH: number; endH: number }) {
  return `${deviceId}:${dayIndex}:${block.act}:${block.startH.toFixed(2)}:${block.endH.toFixed(2)}`;
}

function parseBlockKey(key: string): ScheduleBlockRef {
  const [deviceId, dayIndex, act, startH, endH] = key.split(":");
  return {
    deviceId: Number(deviceId),
    dayIndex: Number(dayIndex),
    act,
    startH: Number(startH),
    endH: Number(endH),
  };
}

function TimelineRow({
  blocks,
  deviceId,
  dayIndex,
  editMode,
  selectedBlockKeys,
  onToggleBlock,
}: {
  blocks: ReturnType<typeof blocksForDay>;
  deviceId: number;
  dayIndex: number;
  editMode: boolean;
  selectedBlockKeys: Set<string>;
  onToggleBlock: (key: string) => void;
}) {
  const [selectedBlock, setSelectedBlock] = useState<{
    act: string;
    startH: number;
    endH: number;
    x: number;
    y: number;
  } | null>(null);

  return (
    <>
      <div className="relative h-8 rounded-md overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        {[6, 12, 18].map((hour) => (
          <div key={hour} className="absolute top-0 bottom-0" style={{ left: `${(hour / 24) * 100}%`, borderLeft: "1px solid rgba(255,255,255,0.08)" }} />
        ))}
        {blocks.map((block, index) => {
          const left = (block.startH / 24) * 100;
          const width = ((block.endH - block.startH) / 24) * 100;
          const duration = formatDuration(block.startH, block.endH);
          const timeRange = `${formatTime(block.startH)}–${formatTime(block.endH)}`;
          const key = blockKey(deviceId, dayIndex, block);
          const selected = selectedBlockKeys.has(key);
          return (
            <button
              key={`${block.act}-${index}`}
              title={`${duration} · ${ACT_LABEL[block.act] ?? block.act} · ${timeRange}`}
              onClick={(event) => {
                event.stopPropagation();
                if (editMode) onToggleBlock(key);
                else setSelectedBlock({ act: block.act, startH: block.startH, endH: block.endH, x: event.clientX, y: event.clientY });
              }}
              className="absolute top-0 bottom-0 flex items-center justify-center overflow-hidden cursor-pointer"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: ACT_COLORS[block.act] ?? `rgba(${ACCENT_RGB},0.45)`,
                borderRight: "1px solid rgba(0,0,0,0.18)",
                outline: selected ? `2px solid ${ACCENT}` : "none",
                outlineOffset: -2,
                opacity: editMode && !selected ? 0.78 : 1,
              }}
            >
              <TimelineLabel act={block.act} width={width} />
            </button>
          );
        })}
      </div>
      {selectedBlock && createPortal(
        <>
          <div className="fixed inset-0 z-[10010]" onClick={() => setSelectedBlock(null)} />
          <div
            className="fixed z-[10011] rounded-lg px-3 py-2 text-xs font-semibold"
            style={{
              left: Math.min(selectedBlock.x + 10, window.innerWidth - 260),
              top: Math.min(selectedBlock.y + 10, window.innerHeight - 72),
              background: "rgba(14,17,28,0.98)",
              border: "1px solid rgba(255,255,255,0.16)",
              boxShadow: "0 16px 44px rgba(0,0,0,0.55)",
              color: "rgba(255,255,255,0.88)",
            }}
          >
            <span style={{ color: ACCENT }}>{formatDuration(selectedBlock.startH, selectedBlock.endH)}</span>
            <span> · {ACT_LABEL[selectedBlock.act] ?? selectedBlock.act} · </span>
            <span style={{ color: "rgba(255,255,255,0.58)" }}>{formatTime(selectedBlock.startH)}–{formatTime(selectedBlock.endH)}</span>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

export function ScheduleResultsPanel({
  devices,
  onClose,
  onCreatePlan,
}: {
  devices: Device[];
  onClose: () => void;
  onCreatePlan: (scope: SchedulePlanScope) => void;
}) {
  const { t } = useLang();
  const { timeZone } = useAppTimezone();
  const [result, setResult] = useState(() => loadSavedScheduleResult());
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<number>>(() => new Set());
  const [selectedBlockKeys, setSelectedBlockKeys] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<{
    message: string;
    confirmLabel?: string;
    onConfirm?: () => void;
  } | null>(null);
  const sortedDevices = useMemo(() => [...devices].sort((a, b) => a.id - b.id), [devices]);
  const deviceIndexById = useMemo(() => new Map(sortedDevices.map((device, index) => [device.id, index + 1])), [sortedDevices]);
  const savedDevices = useMemo(() => {
    if (!result) return [];
    return result.devices.filter((device) => {
      if (!query.trim()) return true;
      const haystack = `${device.deviceNumber} ${device.currentIp}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [query, result]);
  const activeDate = result?.dates[activeDayIndex];
  const selectedDevices = selectedDeviceIds.size > 0 ? Array.from(selectedDeviceIds) : savedDevices.map((device) => device.deviceId);
  const persistResult = (nextResult: NonNullable<typeof result>) => {
    setResult(nextResult);
    saveScheduleResult(nextResult);
  };
  const toggleDeviceSelection = (deviceId: number) => {
    setSelectedDeviceIds((current) => {
      const next = new Set(current);
      next.has(deviceId) ? next.delete(deviceId) : next.add(deviceId);
      return next;
    });
  };
  const toggleBlockSelection = (key: string) => {
    setSelectedBlockKeys((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const deleteSelectedBlocks = () => {
    if (!result || selectedBlockKeys.size === 0) return;
    const blockRefs = Array.from(selectedBlockKeys).map(parseBlockKey);
    setDialog({
      message: t.scheduleConfirmDeleteBlocks(selectedBlockKeys.size),
      confirmLabel: t.deleteAction,
      onConfirm: () => {
        persistResult(deleteScheduleBlocks(result, blockRefs));
        setSelectedBlockKeys(new Set());
      },
    });
  };
  const deleteDayForSelectedDevices = () => {
    if (!result || !activeDate || selectedDevices.length === 0) return;
    const deviceIds = selectedDevices;
    const dayIndex = activeDayIndex;
    setDialog({
      message: t.scheduleConfirmDeleteDaySelection(formatDateLabel(activeDate), deviceIds.length),
      confirmLabel: t.deleteAction,
      onConfirm: () => {
        persistResult(deleteScheduleDayForDevices(result, dayIndex, deviceIds));
        setSelectedBlockKeys(new Set());
      },
    });
  };
  const deleteDayForAllDevices = () => {
    if (!result || !activeDate) return;
    const allDeviceIds = result.devices.map((device) => device.deviceId);
    const dayIndex = activeDayIndex;
    setDialog({
      message: t.scheduleConfirmDeleteDayAll(formatDateLabel(activeDate)),
      confirmLabel: t.deleteAction,
      onConfirm: () => {
        persistResult(deleteScheduleDayForDevices(result, dayIndex, allDeviceIds));
        setSelectedDeviceIds(new Set());
        setSelectedBlockKeys(new Set());
      },
    });
  };
  const createPlanForSelection = () => {
    if (!activeDate) return;
    if (activeDate < getTodayDateKey(timeZone)) {
      setDialog({ message: t.schedulePastCreateBlocked });
      return;
    }
    onCreatePlan({
      deviceIds: selectedDevices,
      dateKeys: [activeDate],
      baselineResult: result,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,0.58)", backdropFilter: "blur(5px)" }}>
      <div
        className="w-full max-w-7xl h-[88vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(10,13,22,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 28px 90px rgba(0,0,0,0.7)",
        }}
      >
        <div className="h-16 shrink-0 flex items-center justify-between px-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `rgba(${ACCENT_RGB},0.12)`, border: `1px solid rgba(${ACCENT_RGB},0.28)` }}>
              <CalendarDays className="w-4 h-4" style={{ color: ACCENT }} />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{t.scheduleResults}</div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>{t.scheduleResultsSubtitle}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10" style={{ color: "rgba(255,255,255,0.58)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {!result ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <CalendarDays className="w-7 h-7" style={{ color: "rgba(255,255,255,0.16)" }} />
            </div>
            <div>
              <div className="text-sm font-semibold text-white/55">{t.noSavedSchedule}</div>
              <div className="text-xs mt-1 max-w-md" style={{ color: "rgba(255,255,255,0.28)" }}>{t.noSavedScheduleHint}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="shrink-0 p-4 flex flex-wrap items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex gap-1 overflow-x-auto max-w-full">
                {result.dates.map((date, index) => {
                  const active = index === activeDayIndex;
                  return (
                    <button
                      key={date}
                      onClick={() => setActiveDayIndex(index)}
                      className="h-9 px-3 rounded-lg text-xs font-semibold shrink-0"
                      style={{
                        color: active ? ACCENT : "rgba(255,255,255,0.42)",
                        background: active ? `rgba(${ACCENT_RGB},0.14)` : "rgba(255,255,255,0.035)",
                        border: `1px solid ${active ? `rgba(${ACCENT_RGB},0.34)` : "rgba(255,255,255,0.07)"}`,
                      }}
                    >
                      {formatDateLabel(date)}
                    </button>
                  );
                })}
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setEditMode((current) => !current)}
                className="h-9 px-3 rounded-lg text-xs font-semibold"
                style={{
                  color: editMode ? ACCENT : "rgba(255,255,255,0.45)",
                  background: editMode ? `rgba(${ACCENT_RGB},0.14)` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${editMode ? `rgba(${ACCENT_RGB},0.35)` : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {editMode ? t.scheduleEditActive : t.scheduleEdit}
              </button>
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.28)" }} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.searchDevice}
                  className="w-full h-9 pl-8 pr-3 rounded-lg text-xs outline-none text-white placeholder-white/25"
                  style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
              </div>
            </div>

            <div className="shrink-0 px-4 py-2 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}>
              <span className="text-[11px] font-mono flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {savedDevices.length} {t.devices}</span>
              <span className="text-[11px] font-mono flex items-center gap-1"><Clock3 className="w-3 h-3" /> {activeDate ? formatDateLabel(activeDate) : ""}</span>
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.22)" }}>{t.schedulePickupHint}</span>
            </div>
            {editMode && (
              <div className="shrink-0 px-4 py-2 flex flex-wrap items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)" }}>
                <button onClick={deleteSelectedBlocks} disabled={selectedBlockKeys.size === 0} className="h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-35" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.26)", color: "#f87171" }}>
                  <Trash2 className="w-3 h-3" /> {t.scheduleDeleteBlocks(selectedBlockKeys.size)}
                </button>
                <button onClick={deleteDayForSelectedDevices} className="h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.22)", color: "#fca5a5" }}>
                  <Trash2 className="w-3 h-3" /> {t.scheduleDeleteDaySelection(selectedDevices.length)}
                </button>
                <button onClick={deleteDayForAllDevices} className="h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#fecaca" }}>
                  <Trash2 className="w-3 h-3" /> {t.scheduleDeleteDayAll}
                </button>
                <button onClick={createPlanForSelection} className="h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5" style={{ background: `rgba(${ACCENT_RGB},0.12)`, border: `1px solid rgba(${ACCENT_RGB},0.3)`, color: ACCENT }}>
                  <Plus className="w-3 h-3" /> {t.scheduleCreatePlanSelection}
                </button>
                <button onClick={() => { setSelectedDeviceIds(new Set()); setSelectedBlockKeys(new Set()); }} className="h-8 px-3 rounded-lg text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.42)" }}>
                  {t.scheduleClearSelection}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-auto">
              <div className="min-w-[980px]">
                <div className="sticky top-0 z-10 grid items-center h-10 px-4" style={{ gridTemplateColumns: "80px 140px 1fr", background: "rgba(10,13,22,0.99)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/25">#</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/25">IP</div>
                  <div className="relative h-full">
                    {[0, 6, 12, 18, 24].map((hour) => (
                      <span key={hour} className="absolute top-1/2 -translate-y-1/2 text-[10px] font-mono text-white/25" style={{ left: `${(hour / 24) * 100}%` }}>
                        {String(hour).padStart(2, "0")}:00
                      </span>
                    ))}
                  </div>
                </div>
                {savedDevices.map((device, index) => {
                  const deviceNumber = deviceIndexById.get(device.deviceId) ?? device.deviceNumber;
                  const blocks = blocksForDay(device.blocks, activeDayIndex);
                  return (
                    <div key={device.deviceId} className="grid items-center min-h-[48px] px-4" style={{ gridTemplateColumns: "80px 140px 1fr", borderBottom: "1px solid rgba(255,255,255,0.045)", background: index % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent" }}>
                      <div className="font-mono text-xs font-bold flex items-center gap-2" style={{ color: ACCENT }}>
                        {editMode && (
                          <input
                            type="checkbox"
                            checked={selectedDeviceIds.has(device.deviceId)}
                            onChange={() => toggleDeviceSelection(device.deviceId)}
                            style={{ accentColor: ACCENT }}
                          />
                        )}
                        {deviceNumber}
                      </div>
                      <div className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{device.currentIp}</div>
                      <TimelineRow
                        blocks={blocks}
                        deviceId={device.deviceId}
                        dayIndex={activeDayIndex}
                        editMode={editMode}
                        selectedBlockKeys={selectedBlockKeys}
                        onToggleBlock={toggleBlockSelection}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            {dialog && (
              <div className="fixed inset-0 z-[10020] flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,0.42)", backdropFilter: "blur(4px)" }}>
                <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "rgba(14,17,28,0.98)", border: "1px solid rgba(255,255,255,0.13)", boxShadow: "0 24px 70px rgba(0,0,0,0.68)" }}>
                  <div className="px-5 py-4 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}>
                    {dialog.message}
                  </div>
                  <div className="px-4 py-3 flex justify-end gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    {dialog.onConfirm && (
                      <button onClick={() => setDialog(null)} className="h-9 px-4 rounded-lg text-xs font-semibold" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.62)" }}>
                        {t.cancel}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const action = dialog.onConfirm;
                        setDialog(null);
                        action?.();
                      }}
                      className="h-9 px-4 rounded-lg text-xs font-bold"
                      style={{ background: dialog.onConfirm ? "rgba(239,68,68,0.14)" : `rgba(${ACCENT_RGB},0.14)`, border: dialog.onConfirm ? "1px solid rgba(239,68,68,0.32)" : `1px solid rgba(${ACCENT_RGB},0.32)`, color: dialog.onConfirm ? "#fca5a5" : ACCENT }}
                    >
                      {dialog.confirmLabel ?? t.ok}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}