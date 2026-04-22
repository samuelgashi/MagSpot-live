import React, { useEffect, useRef, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { DeviceFocusModal, DeviceGrid, FocusedDevice } from "../components/DeviceGrid";
import { IconRail } from "../components/IconRail";
import { NetworkScanModal } from "../components/NetworkScanModal";
import { AdbCommandModal } from "../components/AdbCommandModal";
import { FullAutomationModal } from "../components/FullAutomationModal";
import { DeviceRegistryPanel } from "../components/DeviceRegistryPanel";
import { ScheduleResultsPanel } from "../components/ScheduleResultsPanel";
import { TaskManagerPanel } from "../components/TaskManagerPanel";
import { SchedulePlanScope } from "@/lib/scheduleResults";
import {
  useListDevices,
  useListGroups,
  useUpdateDevice,
  getListDevicesQueryKey,
  getListGroupsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, Zap, Wifi, WifiOff, Globe, Keyboard, Monitor, Tag, Hash } from "lucide-react";
import { useLang } from "../lib/lang";
import { BROWSER_KEYCODE_MAP, isPrintableKey } from "@/lib/androidKeycodes";
import { postMagSpotSyncCommand } from "@/lib/magspotApi";
import { safeLoadRecords } from "../components/DeviceRegistryPanel";

const SCALE_WHEEL_THRESHOLD = 90;

export function Dashboard({ onLogout }: { onLogout?: () => void } = {}) {
  const { t } = useLang();
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [columns, setColumns] = useState(8);
  const [smallScreenEnabled, setSmallScreenEnabled] = useState(false);
  const [syncControlEnabled, setSyncControlEnabled] = useState(false);
  const [streamEnabled, setStreamEnabled] = useState(false);
  const [searchByMode, setSearchByMode] = useState<"name" | "ip">("name");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePanel, setActivePanel] = useState<"network" | "adb" | "devices" | "schedule" | "tasks" | null>(null);
  const [showFullAutomation, setShowFullAutomation] = useState(false);
  const [schedulePlanScope, setSchedulePlanScope] = useState<SchedulePlanScope | null>(null);
  const [focusedDevice, setFocusedDevice] = useState<FocusedDevice | null>(null);
  const scaleWheelDeltaRef = useRef(0);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  // Slider directly controls columns (5–30); CSS grid handles responsive card sizing
  const effectiveCols = columns;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: rawDevices = [], isLoading } = useListDevices();
  const { data: groups = [] } = useListGroups();

  const updateDevice = useUpdateDevice();

  const sortedDevices = [...rawDevices].sort((a, b) => a.id - b.id);

  const selectedGroup = selectedGroupId !== null ? groups.find((g) => g.id === selectedGroupId) : null;

  const filteredDevices = sortedDevices.filter((device) => {
    let matchesGroup: boolean;
    if (selectedGroupId === null) {
      matchesGroup = true;
    } else if (selectedGroup?.deviceBackendIds && selectedGroup.deviceBackendIds.length > 0) {
      matchesGroup =
        device.groupId === selectedGroupId ||
        selectedGroup.deviceBackendIds.includes(device.backendId as string);
    } else {
      matchesGroup = device.groupId === selectedGroupId;
    }
    const ipHost = device.ip.split(':')[0];
    const lastOctet = ipHost.split('.').pop() ?? '';
    const registryModel = safeLoadRecords()[String(device.id)]?.deviceModel?.trim() ?? "";
    const matchesSearch = !searchQuery || (() => {
      const q = searchQuery.toLowerCase();
      if (searchByMode === "ip") {
        return device.ip.includes(searchQuery) || lastOctet === searchQuery;
      }
      return (
        registryModel.toLowerCase().includes(q) ||
        (device.model?.toLowerCase().includes(q) ?? false) ||
        lastOctet === searchQuery
      );
    })();
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "online" ? device.status === "online" : device.status !== "online");
    return matchesGroup && matchesSearch && matchesStatus;
  });

  const toggleDevice = (deviceId: number) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]
    );
  };

  const clearSelection = () => setSelectedDeviceIds([]);

  const setSelection = (ids: number[]) => {
    setSelectedDeviceIds(ids);
  };

  // Dashboard-level keyboard capture: active when devices are selected and
  // no focused window is open (focused window has its own keyboard handler).
  const keyboardCaptureActive = !focusedDevice && selectedDeviceIds.length > 0;

  useEffect(() => {
    if (!keyboardCaptureActive) return;
    const targets = filteredDevices.filter((d) => selectedDeviceIds.includes(d.id));
    if (targets.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return;
      if (event.key === "Escape") return;
      const keycode = BROWSER_KEYCODE_MAP.get(event.code);
      if (keycode === undefined) return;
      event.preventDefault();
      if (event.repeat) return; // send first press only to avoid flooding
      if (isPrintableKey(event)) {
        postMagSpotSyncCommand(targets, "shell", ["input", "text", event.key]).catch(() => {});
      } else {
        postMagSpotSyncCommand(targets, "shell", ["input", "keyevent", String(keycode)]).catch(() => {});
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [keyboardCaptureActive, filteredDevices, selectedDeviceIds]);

  const closeFocusedDevice = () => {
    const focusedId = focusedDevice?.device.id;
    if (focusedId !== undefined) {
      setSelectedDeviceIds((current) => current.filter((id) => id !== focusedId));
    }
    setFocusedDevice(null);
  };

  const addToGroup = async (groupId: number, deviceId?: number) => {
    const ids = deviceId !== undefined
      ? [...new Set([deviceId, ...selectedDeviceIds])]
      : selectedDeviceIds;
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map((id) => updateDevice.mutateAsync({ id, data: { groupId } })));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() }),
      ]);
      toast({ title: t.moved(ids.length) });
    } catch {
      toast({ title: t.errorMoving, variant: "destructive" });
    }
  };

  const handleTogglePanel = (panel: "network" | "adb" | "devices" | "schedule" | "tasks") => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const applyScaleWheelDelta = (deltaX: number) => {
    scaleWheelDeltaRef.current += deltaX;
    if (Math.abs(scaleWheelDeltaRef.current) < SCALE_WHEEL_THRESHOLD) return;
    const direction = scaleWheelDeltaRef.current > 0 ? 1 : -1;
    scaleWheelDeltaRef.current = 0;
    setColumns((current) => {
      return Math.max(5, Math.min(30, current + direction));
    });
  };

  useEffect(() => {
    const element = gridScrollRef.current;
    if (!element) return;

    const handleNativeWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      event.stopPropagation();
      applyScaleWheelDelta(event.deltaX);
    };

    element.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleNativeWheel);
  }, []);

  const handleScaleWheel = (event: React.WheelEvent<HTMLElement>) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    event.stopPropagation();
    applyScaleWheelDelta(event.deltaX);
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden">
      {/* Modals */}
      {activePanel === "network" && (
        <NetworkScanModal onClose={() => setActivePanel(null)} />
      )}
      {activePanel === "adb" && (
        <AdbCommandModal
          selectedCount={selectedDeviceIds.length}
          selectedDevices={sortedDevices.filter((device) => selectedDeviceIds.includes(device.id))}
          onClose={() => setActivePanel(null)}
        />
      )}
      {activePanel === "tasks" && (
        <TaskManagerPanel onClose={() => setActivePanel(null)} />
      )}
      {activePanel === "devices" && (
        <DeviceRegistryPanel
          devices={sortedDevices}
          onClose={() => setActivePanel(null)}
        />
      )}
      {activePanel === "schedule" && (
        <ScheduleResultsPanel
          devices={sortedDevices}
          onClose={() => setActivePanel(null)}
          onCreatePlan={(scope) => {
            setSchedulePlanScope(scope);
            setActivePanel(null);
            setShowFullAutomation(true);
          }}
        />
      )}
      {showFullAutomation && (
        <FullAutomationModal
          onClose={() => {
            setShowFullAutomation(false);
            setSchedulePlanScope(null);
          }}
          devices={schedulePlanScope ? sortedDevices.filter((device) => schedulePlanScope.deviceIds.includes(device.id)) : sortedDevices}
          initialDateKeys={schedulePlanScope?.dateKeys}
          scopedSave={!!schedulePlanScope}
          initialScheduleResult={schedulePlanScope?.baselineResult}
          deviceNumberById={Object.fromEntries(sortedDevices.map((device, index) => [device.id, index + 1]))}
        />
      )}
      {focusedDevice && (
        <DeviceFocusModal
          device={focusedDevice.device}
          displayNum={focusedDevice.displayNum}
          onClose={closeFocusedDevice}
          controlDevices={syncControlEnabled && selectedDeviceIds.length > 0 ? filteredDevices.filter(d => selectedDeviceIds.includes(d.id)) : [focusedDevice.device]}
          syncControlEnabled={syncControlEnabled}
          streamEnabled={streamEnabled}
        />
      )}

      {/* Left icon rail */}
      <IconRail
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        activePanel={activePanel}
        onTogglePanel={handleTogglePanel}
        onLogout={onLogout}
      />

      {/* Collapsible sidebar */}
      <div
        className="shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
        style={{ width: sidebarCollapsed ? 0 : 300 }}
      >
        <Sidebar
          groups={groups}
          sortedDevices={sortedDevices}
          selectedGroupId={selectedGroupId}
          onSelectGroup={(id) => {
            setSelectedGroupId(id);
            if (id !== null) {
              const onlineInGroup = sortedDevices.filter(
                (d) => d.groupId === id && d.status === "online"
              );
              setSelectedDeviceIds(onlineInGroup.map((d) => d.id));
            } else {
              setSelectedDeviceIds([]);
            }
          }}
          selectedDeviceIds={selectedDeviceIds}
          onToggleDevice={toggleDevice}
          onSetSelection={setSelection}
          onClearSelection={clearSelection}
          onAddToGroup={addToGroup}
          smallScreenEnabled={smallScreenEnabled}
          onSmallScreenChange={setSmallScreenEnabled}
          syncControlEnabled={syncControlEnabled}
          onSyncControlChange={setSyncControlEnabled}
          focusedDeviceId={focusedDevice?.device.id ?? null}
          onOpenFocusedDevice={setFocusedDevice}
        />
      </div>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div
          className="h-14 flex items-center px-5 gap-4 shrink-0"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-1.5 shrink-0">
            {(["name", "ip"] as const).map((mode) => {
              const active = searchByMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setSearchByMode(mode)}
                  className="h-7 px-2 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all"
                  style={{
                    background: active ? "rgba(0,212,232,0.15)" : "rgba(255,255,255,0.05)",
                    border: active ? "1px solid rgba(0,212,232,0.35)" : "1px solid rgba(255,255,255,0.07)",
                    color: active ? "#00d4e8" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {mode === "name" ? <Tag className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
                  {mode === "name" ? "Name" : "IP"}
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: "rgba(255,255,255,0.3)" }}
            />
            <input
              type="search"
              placeholder={searchByMode === "ip" ? "Search by IP / host…" : t.searchDevice}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-sm rounded-lg outline-none text-white placeholder-white/30"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                fontFamily: "var(--app-font-sans)",
              }}
            />
          </div>

          {/* Online/Offline filter */}
          <div className="flex items-center gap-1 shrink-0">
            {(["all", "online", "offline"] as const).map((filter) => {
              const Icon = filter === "online" ? Wifi : filter === "offline" ? WifiOff : Globe;
              const label = filter === "all" ? "All" : filter === "online" ? "Online" : "Offline";
              const active = statusFilter === filter;
              return (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className="h-7 px-2.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all"
                  style={{
                    background: active ? "rgba(0,212,232,0.15)" : "rgba(255,255,255,0.05)",
                    border: active ? "1px solid rgba(0,212,232,0.35)" : "1px solid rgba(255,255,255,0.07)",
                    color: active ? "#00d4e8" : "rgba(255,255,255,0.4)",
                  }}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Real Time Display toggle */}
          <button
            onClick={() => setStreamEnabled((v) => !v)}
            className="h-8 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all hover:opacity-90 shrink-0"
            style={{
              background: streamEnabled ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.05)",
              border: streamEnabled ? "1px solid rgba(168,85,247,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: streamEnabled ? "#a855f7" : "rgba(255,255,255,0.4)",
            }}
          >
            <Monitor className="w-3.5 h-3.5" />
            Real Time Display
          </button>

          {/* Full Automation button */}
          <button
            onClick={() => {
              setSchedulePlanScope(null);
              setShowFullAutomation(true);
            }}
            className="h-8 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all hover:opacity-90 shrink-0"
            style={{
              background: "rgba(0,212,232,0.12)",
              border: "1px solid rgba(0,212,232,0.3)",
              color: "#00d4e8",
            }}
          >
            <Zap className="w-3.5 h-3.5" />
            Task Planner
          </button>

          <div className="flex-1" />

          {selectedDeviceIds.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span
                className="text-xs px-2 py-1 rounded-md font-medium"
                style={{
                  background: "rgba(0,212,232,0.12)",
                  color: "#00d4e8",
                  border: "1px solid rgba(0,212,232,0.25)",
                }}
              >
                {selectedDeviceIds.length} {t.selected}
              </span>
              {keyboardCaptureActive && (
                <span
                  title="Keyboard input active — keystrokes go to selected devices"
                  className="flex items-center gap-1 text-xs px-1.5 py-1 rounded-md font-medium"
                  style={{
                    background: "rgba(168,85,247,0.15)",
                    color: "#a855f7",
                    border: "1px solid rgba(168,85,247,0.3)",
                  }}
                >
                  <Keyboard className="w-3 h-3" />
                </span>
              )}
            </span>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
              {filteredDevices.length}
            </span>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={columns}
              onChange={(e) => setColumns(Number(e.target.value))}
              onWheel={handleScaleWheel}
              className="grid-slider w-24"
            />
            <span className="text-xs font-mono w-6 text-right" style={{ color: "rgba(255,255,255,0.3)" }}>
              {effectiveCols}
            </span>
          </div>
        </div>

        <div ref={gridScrollRef} className="flex-1 overflow-auto p-4" style={{ overscrollBehavior: "contain" }}>
          <DeviceGrid
            sortedDevices={sortedDevices}
            filteredDevices={filteredDevices}
            columns={effectiveCols}
            isLoading={isLoading}
            selectedDeviceIds={selectedDeviceIds}
            onToggleDevice={toggleDevice}
            groups={groups}
            onAddToGroup={addToGroup}
            onClearSelection={clearSelection}
            onSetSelection={setSelection}
            smallScreenEnabled={smallScreenEnabled}
            syncControlEnabled={syncControlEnabled}
            streamEnabled={streamEnabled}
            focusedDeviceId={focusedDevice?.device.id ?? null}
            onOpenFocusedDevice={setFocusedDevice}
          />
        </div>
      </main>
    </div>
  );
}
