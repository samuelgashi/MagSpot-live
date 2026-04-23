import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Play, ChevronDown } from "lucide-react";
import { ACTIVITY_META, ActivityType } from "./PlatformLogos";

const ACCENT = "#00d4e8";
const ACCENT_RGB = "0,212,232";

interface ArtistActivityModalProps {
  kind?: ActivityModalKind;
  deviceIds: number[];
  onClose: () => void;
  onStart: (params: ActivityParams) => void;
}

export type ActivityModalKind = "artist" | "album" | "single" | "playlist" | "library" | "shorts" | "tiktok" | "google";

export interface ActivityParams {
  kind: ActivityModalKind;
  name: string;
  sheetUrl: string;
  maxItems: number;
  playMinutes: number;
  maxPlayMinutesPerItem: number;
  minPlayMinutesPerItem: number;
  deviceIds: number[];
  scrollsPerSite?: number;
  formData?: Record<string, unknown>;
}

export type ArtistParams = ActivityParams;

const KIND_TO_BACKEND_KEY: Record<ActivityModalKind, string> = {
  artist: "stream_by_artist",
  library: "stream_by_library",
  playlist: "stream_by_playlist",
  single: "stream_by_playlist",
  album: "stream_by_library",
  google: "google_warmup",
  shorts: "stream_youtube_shorts",
  tiktok: "stream_youtube_shorts",
};

const ACTIVITY_TYPE_BY_KIND: Record<ActivityModalKind, ActivityType> = {
  google: "google_search",
  artist: "ytm_artist",
  album: "ytm_album",
  single: "ytm_single",
  playlist: "ytm_playlist",
  library: "ytm_library",
  shorts: "yt_shorts",
  tiktok: "tiktok",
};

interface BackendField {
  index: number;
  key: string;
  description: string;
  default: unknown;
  type: "input" | "checkbox" | "select";
  is_required: boolean;
}

interface BackendActivity {
  name: string;
  endpoint: string;
  method: string;
  icon: string;
  args: BackendField[];
  kwaygs: BackendField[];
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "8px 11px",
  color: "#fff",
  fontSize: 12,
  fontFamily: "var(--app-font)",
  outline: "none",
  boxSizing: "border-box",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: `rgba(${ACCENT_RGB},0.7)`,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  marginBottom: 4,
  display: "block",
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function DragNumber({ value, onChange, min, max, step = 1, pad = false }: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  pad?: boolean;
}) {
  const drag = useRef<{ y: number; value: number } | null>(null);

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    drag.current = { y: e.clientY, value };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";
    const move = (ev: PointerEvent) => {
      if (!drag.current) return;
      const delta = Math.round((drag.current.y - ev.clientY) / 8);
      onChange(clamp(drag.current.value + delta * step, min, max));
    };
    const up = () => {
      drag.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      onPointerDown={startDrag}
      title="Drag up/down"
      style={{
        ...INPUT_STYLE,
        fontFamily: "var(--app-font-mono, monospace)",
        cursor: "ns-resize",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 35,
        padding: "7px 10px",
      }}
    >
      {pad ? String(value).padStart(2, "0") : value}
    </div>
  );
}

function TimeDrag({ value, onChange, min, max }: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const minHour = Math.floor(min / 60);
  const maxHour = Math.floor(max / 60);
  const setHours = (h: number) => onChange(clamp(h * 60 + minutes, min, max));
  const setMinutes = (m: number) => onChange(clamp(hours * 60 + m, min, max));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 4 }}>
      <DragNumber value={hours} onChange={setHours} min={minHour} max={maxHour} />
      <span style={{ color: `rgba(${ACCENT_RGB},0.65)`, fontWeight: 800, fontFamily: "var(--app-font-mono, monospace)" }}>:</span>
      <DragNumber value={minutes} onChange={setMinutes} min={0} max={59} pad />
    </div>
  );
}

function FieldRow({ label, required, description, children }: { label: string; required?: boolean; description?: string; children: React.ReactNode }) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={LABEL_STYLE}>
        {label}
        {required && (
          <span style={{ position: "relative", display: "inline-block" }}>
            <span
              style={{ color: "#ef4444", marginLeft: 3, cursor: description ? "help" : "default" }}
              onMouseEnter={() => description && setTooltipVisible(true)}
              onMouseLeave={() => setTooltipVisible(false)}
            >*</span>
            {tooltipVisible && description && (
              <span style={{
                position: "absolute",
                bottom: "calc(100% + 4px)",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(12,15,26,0.97)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 6,
                padding: "5px 9px",
                fontSize: 10,
                color: "rgba(255,255,255,0.75)",
                whiteSpace: "nowrap",
                maxWidth: 240,
                zIndex: 9999,
                pointerEvents: "none",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                fontWeight: 400,
                letterSpacing: 0,
                textTransform: "none",
              }}>
                {description}
              </span>
            )}
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

function renderDynamicField(
  field: BackendField,
  value: unknown,
  onChange: (v: unknown) => void
): React.ReactNode {
  if (field.type === "checkbox") {
    const checked = Boolean(value);
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          textAlign: "left",
        }}
      >
        <div style={{
          width: 32,
          height: 18,
          borderRadius: 9,
          background: checked ? `rgba(${ACCENT_RGB},0.8)` : "rgba(255,255,255,0.12)",
          border: `1px solid ${checked ? ACCENT : "rgba(255,255,255,0.2)"}`,
          position: "relative",
          transition: "all .15s",
          flexShrink: 0,
        }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: 2,
            left: checked ? 16 : 2,
            transition: "left .15s",
          }} />
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
          {field.description}
        </span>
      </button>
    );
  }

  if (field.type === "select") {
    const opts = Array.isArray(field.default) ? field.default as string[] : [String(field.default)];
    const currentStr = String(value ?? "");
    return (
      <select
        value={currentStr}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...INPUT_STYLE, cursor: "pointer" }}
      >
        {opts.map((o) => (
          <option key={o} value={o} style={{ background: "#0c0f18" }}>{o}</option>
        ))}
      </select>
    );
  }

  const isNumeric = typeof field.default === "number";
  const strVal = String(value ?? "");
  return (
    <input
      type={isNumeric ? "number" : "text"}
      style={INPUT_STYLE}
      value={strVal}
      placeholder={field.description}
      onChange={(e) => onChange(isNumeric ? Number(e.target.value) : e.target.value)}
    />
  );
}

export function ArtistActivityModal({ kind = "artist", deviceIds, onClose, onStart }: ArtistActivityModalProps) {
  const activityLogo = ACTIVITY_META[ACTIVITY_TYPE_BY_KIND[kind]].logo(18);
  const backendKey = KIND_TO_BACKEND_KEY[kind];

  const [dynamicActivity, setDynamicActivity] = useState<BackendActivity | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/get_activities")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const activity: BackendActivity | undefined = json?.data?.[backendKey];
        if (!activity) return;
        const initial: Record<string, unknown> = {};
        for (const f of [...(activity.args ?? []), ...(activity.kwaygs ?? [])]) {
          if (f.key === "device_id") {
            initial[f.key] = deviceIds.join(",");
          } else if (Array.isArray(f.default)) {
            initial[f.key] = (f.default as string[])[0] ?? "";
          } else {
            initial[f.key] = f.default ?? "";
          }
        }
        setDynamicActivity(activity);
        setFormData(initial);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [backendKey, deviceIds.join(",")]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setField = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validationErrors: string[] = [];
  if (dynamicActivity) {
    for (const f of dynamicActivity.args) {
      if (f.is_required && f.key !== "device_id") {
        const val = formData[f.key];
        if (val === null || val === undefined || String(val).trim() === "" || String(val) === "null") {
          validationErrors.push(`"${f.description.replace(/\.\.\.$/, "")}" is required.`);
        }
      }
    }
    const playHours = Number(formData["play_hours"] ?? 0);
    const maxPlayHours = Number(formData["max_play_hours"] ?? 0);
    const minPlayMinutes = Number(formData["min_play_minutes"] ?? 0);
    const maxItemCount = Number(formData["max_artists"] ?? formData["max_playlists"] ?? 1);
    if (playHours > 0 && maxPlayHours > 0 && minPlayMinutes > 0) {
      const playMinutes = playHours * 60;
      const minRequired = maxItemCount * minPlayMinutes;
      const maxAllowed = maxItemCount * maxPlayHours * 60;
      if (playMinutes < minRequired) {
        validationErrors.push(
          `Play time too short: ${maxItemCount} items × min ${minPlayMinutes}m = at least ${Math.ceil(minRequired / 60)}h needed.`
        );
      }
      if (playMinutes > maxAllowed) {
        validationErrors.push(
          `Play time too long: ${maxItemCount} items × max ${maxPlayHours}h = at most ${maxAllowed / 60}h allowed.`
        );
      }
    }
  }

  const canSubmit = deviceIds.length > 0 && validationErrors.length === 0;

  const handleStart = () => {
    if (!canSubmit) return;
    const nameKey = Object.keys(formData).find((k) => k.endsWith("_name") && !k.startsWith("max_"));
    const sheetKey = Object.keys(formData).find((k) => k.endsWith("_sheet_url") || k === "search_keywords_sheet_url");
    const maxKey = Object.keys(formData).find((k) => k.startsWith("max_") && k !== "max_play_hours" && k !== "max_play_minutes" && k !== "max_playlists" && !k.endsWith("_hours") && !k.endsWith("_minutes") || k === "max_artists" || k === "max_playlists");
    onStart({
      kind,
      name: String(formData[nameKey ?? ""] ?? kind),
      sheetUrl: String(formData[sheetKey ?? ""] ?? ""),
      maxItems: Number(formData[maxKey ?? "max_artists"] ?? formData["max_playlists"] ?? 10),
      playMinutes: Number(formData["play_hours"] ?? formData["play_minutes"] ?? 0) * (formData["play_hours"] !== undefined ? 60 : 1),
      maxPlayMinutesPerItem: Number(formData["max_play_hours"] ?? formData["max_play_minutes"] ?? 60) * (formData["max_play_hours"] !== undefined ? 60 : 1),
      minPlayMinutesPerItem: Number(formData["min_play_minutes"] ?? 10),
      deviceIds,
      scrollsPerSite: Number(formData["site_scroll_limit"] ?? formData["scrollsPerSite"] ?? 5),
      formData,
    });
    onClose();
  };

  const title = dynamicActivity?.name ?? kind.charAt(0).toUpperCase() + kind.slice(1) + " Stream";

  const argsToRender = (dynamicActivity?.args ?? []).filter((f) => f.key !== "device_id");
  const kwaygsList = dynamicActivity?.kwaygs ?? [];

  const modal = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 460, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 40px)", background: "rgba(18,22,30,0.97)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,232,0.08)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `rgba(${ACCENT_RGB},0.12)`, border: `1px solid rgba(${ACCENT_RGB},0.2)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {activityLogo}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{title}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>Configure and dispatch to selected devices</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: 4, borderRadius: 6, display: "flex" }}>
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {!dynamicActivity && (
            <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
              Loading activity settings…
            </div>
          )}

          {dynamicActivity && argsToRender.length === 0 && (
            <div style={{ textAlign: "center", padding: "12px 0", color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
              No configurable fields for this activity.
            </div>
          )}

          {dynamicActivity && argsToRender.map((field) => (
            <FieldRow key={field.key} label={field.key.replace(/_/g, " ").toUpperCase()} required={field.is_required} description={field.description.replace(/\.\.\.$/, "")}>
              {renderDynamicField(field, formData[field.key], (v) => setField(field.key, v))}
            </FieldRow>
          ))}

          {validationErrors.length > 0 && (
            <div style={{ border: "1px solid rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.08)", borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
              {validationErrors.map((error) => (
                <div key={error} style={{ fontSize: 10, lineHeight: 1.4, color: "rgba(255,180,180,0.9)", fontWeight: 600 }}>{error}</div>
              ))}
            </div>
          )}

          <FieldRow label={`Device IDs · ${deviceIds.length} selected`}>
            <div style={{ minHeight: 38, maxHeight: 88, overflowY: "auto", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 8px", display: "flex", flexWrap: "wrap", gap: 4, alignContent: "flex-start" }}>
              {deviceIds.length === 0 ? (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: "26px", padding: "0 3px" }}>No devices selected</span>
              ) : (
                deviceIds.map((id) => (
                  <span key={id} style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--app-font-mono, monospace)", background: `rgba(${ACCENT_RGB},0.1)`, border: `1px solid rgba(${ACCENT_RGB},0.2)`, borderRadius: 4, padding: "2px 6px", color: ACCENT, lineHeight: 1.8 }}>
                    {String(id).padStart(3, "0")}
                  </span>
                ))
              )}
            </div>
          </FieldRow>

          {dynamicActivity && kwaygsList.length > 0 && (
            <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: "rgba(255,255,255,0.03)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}
              >
                Advanced Settings
                <ChevronDown style={{ width: 14, height: 14, transform: advancedOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              </button>
              {advancedOpen && (
                <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  {kwaygsList.map((field) => (
                    <FieldRow key={field.key} label={field.key.replace(/_/g, " ").toUpperCase()} required={field.is_required} description={field.description.replace(/\.\.\.$/, "")}>
                      {renderDynamicField(field, formData[field.key], (v) => setField(field.key, v))}
                    </FieldRow>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!canSubmit}
            style={{ padding: "7px 18px", borderRadius: 8, border: `1px solid ${canSubmit ? `rgba(${ACCENT_RGB},0.4)` : "rgba(255,255,255,0.08)"}`, background: canSubmit ? `rgba(${ACCENT_RGB},0.15)` : "rgba(255,255,255,0.03)", color: canSubmit ? ACCENT : "rgba(255,255,255,0.2)", fontSize: 12, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}
          >
            <Play style={{ width: 11, height: 11 }} />
            Start Activity
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
