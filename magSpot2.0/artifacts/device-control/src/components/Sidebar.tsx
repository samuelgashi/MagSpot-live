import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Group, Device } from "@workspace/api-client-react";
import { Plus, Layers, Smartphone, RefreshCw, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CreateGroupModal } from "./CreateGroupModal";
import { ACTIVITY_LIST, ACTIVITY_META, getSimulatedActivity } from "./PlatformLogos";
import { useLang } from "../lib/lang";
import { ArtistActivityModal, ActivityModalKind, ActivityParams } from "./ArtistActivityModal";
import { FocusedDevice } from "./DeviceGrid";
import { ResourceUsage } from "./ResourceUsage";
import { loadSavedScheduleResult } from "@/lib/scheduleResults";
import { getDevicePlanIndicator, getPlanIndicatorStyle } from "@/lib/devicePlanIndicator";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const ACCENT = "#00d4e8";
const ACCENT_RGB = "0,212,232";
const ORIGIN_ACCENT = "#a855f7";
const ORIGIN_ACCENT_RGB = "168,85,247";
const DRAG_THRESHOLD = 5;
const DOUBLE_CLICK_WINDOW_MS = 240;

interface SidebarProps {
  groups: Group[];
  sortedDevices: Device[];
  selectedGroupId: number | null;
  onSelectGroup: (id: number | null) => void;
  selectedDeviceIds: number[];
  onToggleDevice: (id: number) => void;
  onSetSelection: (ids: number[]) => void;
  onClearSelection: () => void;
  onAddToGroup: (groupId: number) => void;
  smallScreenEnabled: boolean;
  onSmallScreenChange: (v: boolean) => void;
  syncControlEnabled: boolean;
  onSyncControlChange: (v: boolean) => void;
  focusedDeviceId: number | null;
  onOpenFocusedDevice: (focusedDevice: FocusedDevice) => void;
}

export function Sidebar({
  groups,
  sortedDevices,
  selectedGroupId,
  onSelectGroup,
  selectedDeviceIds,
  onToggleDevice,
  onSetSelection,
  onClearSelection,
  onAddToGroup,
  smallScreenEnabled,
  onSmallScreenChange,
  syncControlEnabled,
  onSyncControlChange,
  focusedDeviceId,
  onOpenFocusedDevice,
}: SidebarProps) {
  const { t } = useLang();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activityModal, setActivityModal] = useState<ActivityModalKind | null>(null);
  const [now, setNow] = useState(() => new Date());

  const handleActivityStart = (params: ActivityParams) => {
    console.log("[Activity]", params);
    // TODO: dispatch to devices via API
  };

  // ── Rubber-band drag state (refs → no re-renders during drag) ──
  const chipGridRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; device: Device; displayNum: number } | null>(null);
  const isDragActiveRef = useRef(false);
  const pendingChipClickRef = useRef<{ deviceId: number; timer: ReturnType<typeof window.setTimeout> } | null>(null);
  const onSetSelectionRef = useRef(onSetSelection);
  onSetSelectionRef.current = onSetSelection;
  const onClearSelectionRef = useRef(onClearSelection);
  onClearSelectionRef.current = onClearSelection;
  const selectedDeviceIdsRef = useRef(selectedDeviceIds);
  selectedDeviceIdsRef.current = selectedDeviceIds;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const cancelPendingChipClick = useCallback(() => {
    if (pendingChipClickRef.current) {
      window.clearTimeout(pendingChipClickRef.current.timer);
      pendingChipClickRef.current = null;
    }
  }, []);

  const clearChipHighlights = () => {
    chipGridRef.current
      ?.querySelectorAll<HTMLElement>("[data-chip-drag]")
      .forEach((el) => el.removeAttribute("data-chip-drag"));
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      if (!isDragActiveRef.current) {
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          isDragActiveRef.current = true;
          onClearSelectionRef.current();
          if (overlayRef.current) overlayRef.current.style.display = "block";
        } else {
          return;
        }
      }

      cancelPendingChipClick();

      const x1 = Math.min(dragStartRef.current.x, e.clientX);
      const y1 = Math.min(dragStartRef.current.y, e.clientY);
      const x2 = Math.max(dragStartRef.current.x, e.clientX);
      const y2 = Math.max(dragStartRef.current.y, e.clientY);

      if (overlayRef.current) {
        overlayRef.current.style.left = `${x1}px`;
        overlayRef.current.style.top = `${y1}px`;
        overlayRef.current.style.width = `${x2 - x1}px`;
        overlayRef.current.style.height = `${y2 - y1}px`;
      }

      chipGridRef.current?.querySelectorAll<HTMLElement>("[data-chip-id]").forEach((chip) => {
        const r = chip.getBoundingClientRect();
        const hits = r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1;
        if (hits) chip.setAttribute("data-chip-drag", "true");
        else chip.removeAttribute("data-chip-drag");
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!dragStartRef.current) return;

      clearChipHighlights();

      if (isDragActiveRef.current) {
        const x1 = Math.min(dragStartRef.current.x, e.clientX);
        const y1 = Math.min(dragStartRef.current.y, e.clientY);
        const x2 = Math.max(dragStartRef.current.x, e.clientX);
        const y2 = Math.max(dragStartRef.current.y, e.clientY);

        const ids: number[] = [];
        chipGridRef.current?.querySelectorAll<HTMLElement>("[data-chip-id]").forEach((chip) => {
          const r = chip.getBoundingClientRect();
          if (r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1) {
            ids.push(Number(chip.getAttribute("data-chip-id")));
          }
        });
        onSetSelectionRef.current(ids);
      } else {
        const clickTarget = dragStartRef.current;
        const current = selectedDeviceIdsRef.current;
        if (current.includes(clickTarget.device.id)) {
          onSetSelectionRef.current(current.filter((id) => id !== clickTarget.device.id));
        } else {
          onSetSelectionRef.current([...current, clickTarget.device.id]);
        }
      }

      dragStartRef.current = null;
      isDragActiveRef.current = false;
      if (overlayRef.current) {
        overlayRef.current.style.display = "none";
        overlayRef.current.style.width = "0";
        overlayRef.current.style.height = "0";
      }
    };

    const onBlur = () => {
      if (!dragStartRef.current) return;
      cancelPendingChipClick();
      clearChipHighlights();
      dragStartRef.current = null;
      isDragActiveRef.current = false;
      if (overlayRef.current) {
        overlayRef.current.style.display = "none";
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [cancelPendingChipClick, onOpenFocusedDevice]);

  const handleChipMouseDown = useCallback((e: React.MouseEvent, device: Device, displayNum: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, y: e.clientY, device, displayNum };
    isDragActiveRef.current = false;
  }, []);

  const getDeviceCountForGroup = (groupId: number | null) =>
    groupId === null ? sortedDevices.length : sortedDevices.filter((d) => d.groupId === groupId).length;

  const getDevicesForGroup = (groupId: number | null) =>
    groupId === null ? sortedDevices : sortedDevices.filter((d) => d.groupId === groupId);

  const getSelectedCountForGroup = (groupId: number | null) =>
    getDevicesForGroup(groupId).filter((device) => selectedDeviceIds.includes(device.id)).length;

  const renderSelectedCount = (count: number, isOpen: boolean) => (
    <span
      className="text-[11px] font-mono shrink-0"
      style={{
        minWidth: 30,
        textAlign: "right",
        color: count > 0
          ? isOpen ? "rgba(2,10,16,0.9)" : ACCENT
          : "rgba(255,255,255,0.25)",
        fontWeight: 800,
      }}
    >
      {count > 0 ? `(${count})` : ""}
    </span>
  );

  const renderGroupDevices = (groupId: number | null) => {
    const visibleDevices = getDevicesForGroup(groupId);
    const savedSchedule = loadSavedScheduleResult();

    if (visibleDevices.length === 0) {
      return (
        <div
          className="px-2 py-3 text-[10px] font-mono text-center"
          style={{ color: "rgba(255,255,255,0.22)" }}
        >
          {t.noDevicesInGroup.replace("\n", " ")}
        </div>
      );
    }

    return (
      <div className="grid gap-[3px] px-0.5 py-1.5" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
        {visibleDevices.map((device) => {
          const num = sortedDevices.indexOf(device) + 1;
          const isSelected = selectedDeviceIds.includes(device.id);
          const isFocusedOrigin = focusedDeviceId === device.id;
          const planIndicator = getPlanIndicatorStyle(getDevicePlanIndicator(device.id, savedSchedule, now));

          return (
            <button
              key={device.id}
              data-chip-id={device.id}
              onMouseDown={(e) => handleChipMouseDown(e, device, num)}
              onDoubleClick={() => onOpenFocusedDevice({ device, displayNum: num })}
              title={`${device.ip} — ${device.model || "Unknown"}`}
              className="chip-btn relative flex items-center justify-center select-none"
              style={{
                height: "25px",
                borderRadius: "3px",
                background: isFocusedOrigin
                  ? `rgba(${ORIGIN_ACCENT_RGB},0.22)`
                  : isSelected ? `rgba(${ACCENT_RGB},0.22)` : "rgba(255,255,255,0.075)",
                border: isFocusedOrigin
                  ? `1px solid rgba(${ORIGIN_ACCENT_RGB},0.72)`
                  : isSelected
                  ? `1px solid rgba(${ACCENT_RGB},0.6)`
                  : "1px solid rgba(255,255,255,0.09)",
                color: isFocusedOrigin ? ORIGIN_ACCENT : isSelected ? ACCENT : "rgba(255,255,255,0.78)",
                fontSize: "10px",
                fontFamily: "var(--app-font-mono)",
                fontWeight: 700,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <span
                className="absolute top-[3px] right-[3px] w-[4px] h-[4px] rounded-full pointer-events-none"
                style={{ backgroundColor: planIndicator.bg, boxShadow: `0 0 4px ${planIndicator.glow}` }}
              />
              {num.toString().padStart(2, "0")}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
    {createPortal(
      <div
        ref={overlayRef}
        style={{
          display: "none",
          position: "fixed",
          pointerEvents: "none",
          border: `1px solid rgba(${ACCENT_RGB},0.65)`,
          background: `rgba(${ACCENT_RGB},0.06)`,
          borderRadius: "3px",
          zIndex: 9999,
        }}
      />,
      document.body
    )}
    <aside className="glass-sidebar w-[300px] shrink-0 flex flex-col h-full z-10 overflow-y-auto">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-white/[0.06] shrink-0">
        <Layers className="w-4 h-4 mr-2.5" style={{ color: ACCENT }} />
        <span className="font-semibold text-white tracking-tight text-sm">Magspot 2.0</span>
      </div>

      {/* Controls: Small Screen + Sync Control */}
      <div
        className="px-4 py-3 shrink-0 space-y-2.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
              {t.smallScreen}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: smallScreenEnabled ? ACCENT : "rgba(255,255,255,0.3)" }}>
              {smallScreenEnabled ? t.enable : t.disable}
            </span>
            <Switch
              checked={smallScreenEnabled}
              onCheckedChange={onSmallScreenChange}
              className="scale-75 data-[state=checked]:bg-[#00d4e8]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
              {t.syncControl}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: syncControlEnabled ? ACCENT : "rgba(255,255,255,0.3)" }}>
              {syncControlEnabled ? t.enable : t.disable}
            </span>
            <Switch
              checked={syncControlEnabled}
              onCheckedChange={onSyncControlChange}
              className="scale-75 data-[state=checked]:bg-[#00d4e8]"
            />
          </div>
        </div>
      </div>

      <ResourceUsage />

      {/* Groups */}
      <div className="px-4 pt-3 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[16px] font-semibold tracking-tight" style={{ color: "rgba(255,255,255,0.78)" }}>
            Group Management
          </span>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="h-8 w-14 flex items-center justify-center rounded-md transition-all hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.035)" }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div ref={chipGridRef} className="space-y-2">
              <div>
                {(() => {
                  const selectedCount = getSelectedCountForGroup(null);
                  return (
                <button
                  onClick={() => onSelectGroup(null)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-all"
                  style={
                    selectedGroupId === null
                      ? { background: ACCENT, border: `1px solid ${ACCENT}`, color: "rgba(2,10,16,0.92)" }
                      : { background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.72)" }
                  }
                >
                  <span className="truncate">{t.allDevices}({getDeviceCountForGroup(null)})</span>
                  <span className="flex items-center gap-2 shrink-0">
                    {renderSelectedCount(selectedCount, selectedGroupId === null)}
                    <ChevronDown
                      className="w-4 h-4 shrink-0 transition-transform"
                      style={{ transform: selectedGroupId === null ? "rotate(180deg)" : "rotate(0deg)", opacity: 0.75 }}
                    />
                  </span>
                </button>
                  );
                })()}
                {selectedGroupId === null && renderGroupDevices(null)}
              </div>

              {groups.map((group) => {
                const isOpen = selectedGroupId === group.id;
                const selectedCount = getSelectedCountForGroup(group.id);
                return (
                  <div key={group.id}>
                    <button
                      onClick={() => onSelectGroup(group.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-all"
                      style={
                        isOpen
                          ? { background: group.color || ACCENT, border: `1px solid ${group.color || ACCENT}`, color: "rgba(2,10,16,0.92)" }
                          : { background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.72)" }
                      }
                    >
                      <span className="truncate">{group.name}({getDeviceCountForGroup(group.id)})</span>
                      <span className="flex items-center gap-2 shrink-0">
                        {renderSelectedCount(selectedCount, isOpen)}
                        <ChevronDown
                          className="w-4 h-4 shrink-0 transition-transform"
                          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", opacity: 0.75 }}
                        />
                      </span>
                    </button>
                    {isOpen && renderGroupDevices(group.id)}
                  </div>
                );
              })}
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent
            className="w-52"
            style={{ background: "rgba(15,18,28,0.96)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px" }}
          >
            {selectedDeviceIds.length > 0 ? (
              <>
                <div className="px-2 py-1.5 text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {t.devicesSelected(selectedDeviceIds.length)}
                </div>
                <ContextMenuSeparator />
                <ContextMenuSub>
                  <ContextMenuSubTrigger
                    className="text-sm cursor-pointer focus:bg-white/10 data-[state=open]:bg-white/10"
                    style={{ color: "rgba(255,255,255,0.72)" }}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {t.moveToGroup}
                    </span>
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent
                    className="w-44"
                    style={{ background: "rgba(15,18,28,0.96)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px" }}
                  >
                    {groups.length === 0 ? (
                      <div className="px-2 py-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>{t.noGroups}</div>
                    ) : (
                      groups.map((group) => (
                        <ContextMenuItem
                          key={group.id}
                          className="text-sm text-white/80 focus:bg-white/10 focus:text-white cursor-pointer"
                          onClick={() => onAddToGroup(group.id)}
                        >
                          <span className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: group.color || ACCENT }} />
                          {group.name}
                        </ContextMenuItem>
                      ))
                    )}
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-sm focus:bg-white/10 cursor-pointer"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                  onClick={onClearSelection}
                >
                  {t.clearSelection}
                </ContextMenuItem>
              </>
            ) : (
              <div className="px-2 py-2 text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                {t.selectDeviceForActions}
              </div>
            )}
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {/* ── ACTIVITIES PANEL ── */}
      <div
        className="shrink-0 px-3 pb-24"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="pt-2.5 pb-1.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            {t.activities}
          </span>
        </div>

        <div className="flex flex-col gap-[3px]">
          {ACTIVITY_LIST.map((activityType) => {
            const meta = ACTIVITY_META[activityType];
            const isGoogle = activityType === "google_search";
            const isArtist = activityType === "ytm_artist";
            const isAlbum = activityType === "ytm_album";
            const isSingle = activityType === "ytm_single";
            const isPlaylist = activityType === "ytm_playlist";
            const isLibrary = activityType === "ytm_library";
            const isShorts = activityType === "yt_shorts";
            const isTikTok = activityType === "tiktok";
            return (
              <button
                key={activityType}
                onClick={
                  isArtist
                    ? () => setActivityModal("artist")
                    : isGoogle
                      ? () => setActivityModal("google")
                      : isAlbum
                        ? () => setActivityModal("album")
                        : isSingle
                          ? () => setActivityModal("single")
                          : isPlaylist
                            ? () => setActivityModal("playlist")
                            : isLibrary
                              ? () => setActivityModal("library")
                              : isShorts
                                ? () => setActivityModal("shorts")
                                : isTikTok
                                  ? () => setActivityModal("tiktok")
                                  : undefined
                }
                className="flex items-center gap-3 px-2.5 py-1.5 rounded-lg w-full text-left transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLElement).style.borderColor = `rgba(${ACCENT_RGB},0.3)`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                }}
              >
                <span className="shrink-0 flex items-center justify-center w-5 h-5">
                  {meta.logo(18)}
                </span>
                <span
                  className="leading-none"
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.75)",
                    letterSpacing: "0.01em",
                  }}
                >
                  {meta.label}
                  {meta.sublabel && (
                    <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: "4px" }}>
                      {meta.sublabel}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <CreateGroupModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} existingGroups={groups} />
      {activityModal && (
        <ArtistActivityModal
          kind={activityModal}
          deviceIds={selectedDeviceIds}
          onClose={() => setActivityModal(null)}
          onStart={handleActivityStart}
        />
      )}
    </aside>
    </>
  );
}
