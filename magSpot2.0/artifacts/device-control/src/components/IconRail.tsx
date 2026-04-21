import React, { useState } from "react";
import { CalendarDays, PanelLeftClose, PanelLeftOpen, Globe, Smartphone, Settings, ListTodo } from "lucide-react";
import { useLang, Lang } from "../lib/lang";
import { SettingsPanel } from "./SettingsPanel";

const ACCENT = "#00d4e8";
const ACCENT_RGB = "0,212,232";

interface IconRailProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  activePanel: "network" | "adb" | "devices" | "schedule" | "tasks" | null;
  onTogglePanel: (panel: "network" | "adb" | "devices" | "schedule" | "tasks") => void;
}

function CommandKeyIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 7H13V13H7V7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M7 7V5C7 3.895 6.105 3 5 3C3.895 3 3 3.895 3 5C3 6.105 3.895 7 5 7H7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M13 7V5C13 3.895 13.895 3 15 3C16.105 3 17 3.895 17 5C17 6.105 16.105 7 15 7H13Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M7 13V15C7 16.105 6.105 17 5 17C3.895 17 3 16.105 3 15C3 13.895 3.895 13 5 13H7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M13 13V15C13 16.105 13.895 17 15 17C16.105 17 17 16.105 17 15C17 13.895 16.105 13 15 13H13Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RailButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="w-full flex items-center justify-center transition-all relative group"
      style={{ height: "44px" }}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
          style={{ background: ACCENT }}
        />
      )}
      <Icon
        className="w-[18px] h-[18px] transition-colors"
        style={{ color: active ? ACCENT : "rgba(255,255,255,0.38)" }}
      />
      <span
        className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50"
        style={{
          background: "rgba(10,14,24,0.95)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.85)",
        }}
      >
        {label}
      </span>
    </button>
  );
}

export function IconRail({ sidebarCollapsed, onToggleSidebar, activePanel, onTogglePanel }: IconRailProps) {
  const { lang, setLang, t } = useLang();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const LangBtn = ({ code }: { code: Lang }) => (
    <button
      onClick={() => setLang(code)}
      className="text-[10px] font-bold leading-none transition-all"
      style={{
        color: lang === code ? ACCENT : "rgba(255,255,255,0.3)",
        background: lang === code ? `rgba(${ACCENT_RGB},0.12)` : "transparent",
        border: lang === code ? `1px solid rgba(${ACCENT_RGB},0.3)` : "1px solid transparent",
        borderRadius: "4px",
        padding: "3px 5px",
      }}
    >
      {code.toUpperCase()}
    </button>
  );

  return (
    <div
      className="shrink-0 flex flex-col items-center py-2 h-full z-20"
      style={{
        width: "48px",
        background: "rgba(255,255,255,0.025)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Language switcher */}
      <div className="flex flex-col items-center gap-0.5 py-2 w-full px-1.5">
        <LangBtn code="en" />
        <LangBtn code="de" />
      </div>

      <div className="w-6 my-1" style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />

      <RailButton
        icon={sidebarCollapsed ? PanelLeftOpen : PanelLeftClose}
        label={sidebarCollapsed ? t.openSidebar : t.collapseSidebar}
        onClick={onToggleSidebar}
      />

      <div className="w-6 my-1" style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />

      <RailButton
        icon={Globe}
        label={t.networkScan}
        active={activePanel === "network"}
        onClick={() => onTogglePanel("network")}
      />

      <RailButton
        icon={CommandKeyIcon}
        label={t.adbCommands}
        active={activePanel === "adb"}
        onClick={() => onTogglePanel("adb")}
      />

      <RailButton
        icon={Smartphone}
        label={t.devices}
        active={activePanel === "devices"}
        onClick={() => onTogglePanel("devices")}
      />

      <RailButton
        icon={CalendarDays}
        label={t.scheduleResults}
        active={activePanel === "schedule"}
        onClick={() => onTogglePanel("schedule")}
      />
      <RailButton
        icon={ListTodo}
        label="Tasks"
        active={activePanel === "tasks"}
        onClick={() => onTogglePanel("tasks")}
      />
      <div className="flex-1" />
      <div className="w-6 my-1" style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />
      <RailButton
        icon={Settings}
        label={t.settings}
        active={settingsOpen}
        onClick={() => setSettingsOpen(true)}
      />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
