import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Play } from "lucide-react";
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

interface ActivityConfig {
  title: string;
  subtitle: string;
  nameLabel: string;
  sheetLabel: string;
  namePlaceholder: string;
  maxLabel: string;
  maxDefault: number;
  playDefault: number;
  maxPlayLabel: string;
  maxPlayDefault: number;
  minPlayDefault: number;
  avgLabel: string;
  scrollsDefault?: number;
}

const CONFIG: Record<ActivityModalKind, ActivityConfig> = {
  google: {
    title: "Google Search",
    subtitle: "Configure and dispatch to selected devices",
    nameLabel: "Google Search",
    sheetLabel: "Search Keywords Sheet URL",
    namePlaceholder: "Google Search",
    maxLabel: "Max Sites",
    maxDefault: 6,
    playDefault: 60,
    maxPlayLabel: "Max Search / Site",
    maxPlayDefault: 15,
    minPlayDefault: 5,
    avgLabel: "Avg / Site",
    scrollsDefault: 5,
  },
  artist: {
    title: "Artist Stream",
    subtitle: "Configure and dispatch to selected devices",
    nameLabel: "Artist Name",
    sheetLabel: "Artist Sheet URL",
    namePlaceholder: "e.g. Taylor Swift",
    maxLabel: "Max Artists",
    maxDefault: 10,
    playDefault: 8 * 60,
    maxPlayLabel: "Max Play / Artist",
    maxPlayDefault: 60,
    minPlayDefault: 20,
    avgLabel: "Avg / Artist",
  },
  album: {
    title: "Album Stream",
    subtitle: "Configure and dispatch to selected devices",
    nameLabel: "Album Name",
    sheetLabel: "Album Sheet URL",
    namePlaceholder: "e.g. Album title",
    maxLabel: "Max Albums",
    maxDefault: 24,
    playDefault: 8 * 60,
    maxPlayLabel: "Max Play / Album",
    maxPlayDefault: 30,
    minPlayDefault: 10,
    avgLabel: "Avg / Album",
  },
  single: {
    title: "Single Stream",
    subtitle: "Configure and dispatch to selected devices",
    nameLabel: "Single Name",
    sheetLabel: "Single Sheet URL",
    namePlaceholder: "e.g. Single title",
    maxLabel: "Max Singles",
    maxDefault: 30,
    playDefault: 20,
    maxPlayLabel: "Max Play / Singles",
    maxPlayDefault: 3,
    minPlayDefault: 1,
    avgLabel: "Avg / Singles",
  },
  playlist: {
    title: "Playlist Stream",
    subtitle: "Configure and dispatch to selected devices",
    nameLabel: "Playlist Name",
    sheetLabel: "Playlist Sheet URL",
    namePlaceholder: "e.g. Playlist name",
    maxLabel: "Max Playlists",
    maxDefault: 2,
    playDefault: 6 * 60,
    maxPlayLabel: "Max Play / Playlist",
    maxPlayDefault: 4 * 60,
    minPlayDefault: 60,
    avgLabel: "Avg / Playlists",
  },
  library: {
    title: "Library Stream",
    subtitle: "Configure and dispatch to selected devices",
    nameLabel: "Library Name",
    sheetLabel: "Library Sheet URL",
    namePlaceholder: "e.g. Library name",
    maxLabel: "Max Libraries",
    maxDefault: 2,
    playDefault: 6 * 60,
    maxPlayLabel: "Max Play / Library",
    maxPlayDefault: 4 * 60,
    minPlayDefault: 60,
    avgLabel: "Avg / Libraries",
  },
  shorts: {
    title: "Shorts",
    subtitle: "Configure and dispatch to selected devices",
    nameLabel: "Shorts",
    sheetLabel: "Shorts Sheet URL",
    namePlaceholder: "Shorts",
    maxLabel: "Max Shorts",
    maxDefault: 1,
    playDefault: 0,
    maxPlayLabel: "Max Play Time",
    maxPlayDefault: 60,
    minPlayDefault: 45,
    avgLabel: "Avg / Device",
  },
  tiktok: {
    title: "TikTok",
    subtitle: "Configure and dispatch to selected devices",
    nameLabel: "TikTok",
    sheetLabel: "TikTok Sheet URL",
    namePlaceholder: "TikTok",
    maxLabel: "Max TikToks",
    maxDefault: 1,
    playDefault: 0,
    maxPlayLabel: "Max Play Time",
    maxPlayDefault: 60,
    minPlayDefault: 45,
    avgLabel: "Avg / Device",
  },
};

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
}

export type ArtistParams = ActivityParams;

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={LABEL_STYLE}>{label}</span>
      {children}
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function formatMinutes(total: number) {
  const safe = Math.max(0, Math.round(total));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatCountLabel(label: string) {
  return label.replace(/^Max\s+/i, "");
}

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

export function ArtistActivityModal({ kind = "artist", deviceIds, onClose, onStart }: ArtistActivityModalProps) {
  const cfg = CONFIG[kind];
  const isCompactActivity = kind === "shorts" || kind === "tiktok";
  const isGoogle = kind === "google";
  const activityLogo = ACTIVITY_META[ACTIVITY_TYPE_BY_KIND[kind]].logo(18);
  const [activityName, setActivityName] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [maxItems, setMaxItems] = useState(cfg.maxDefault);
  const [playMinutes, setPlayMinutes] = useState(cfg.playDefault);
  const [maxPlayMinutesPerItem, setMaxPlayMinutesPerItem] = useState(cfg.maxPlayDefault);
  const [minPlayMinutesPerItem, setMinPlayMinutesPerItem] = useState(cfg.minPlayDefault);
  const [scrollsPerSite, setScrollsPerSite] = useState(cfg.scrollsDefault ?? 5);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canStart = (isCompactActivity || isGoogle || activityName.trim().length > 0) && deviceIds.length > 0;
  const avgMinutesPerItem = isCompactActivity
    ? (maxPlayMinutesPerItem + minPlayMinutesPerItem) / 2
    : maxItems > 0 ? playMinutes / maxItems : 0;
  const validationErrors: string[] = [];
  const itemLabel = isGoogle ? "sites" : formatCountLabel(cfg.maxLabel).toLowerCase();
  const totalTimeLabel = isGoogle ? "Max Search Time" : "Play Time";

  if (minPlayMinutesPerItem > maxPlayMinutesPerItem) {
    validationErrors.push(`Min darf nicht größer als Max sein (${formatMinutes(minPlayMinutesPerItem)} > ${formatMinutes(maxPlayMinutesPerItem)}).`);
  }

  if (!isCompactActivity && minPlayMinutesPerItem <= maxPlayMinutesPerItem) {
    const minRequired = maxItems * minPlayMinutesPerItem;
    const maxAllowed = maxItems * maxPlayMinutesPerItem;

    if (playMinutes < minRequired) {
      validationErrors.push(`${totalTimeLabel} zu kurz: ${maxItems} ${itemLabel} × Min ${formatMinutes(minPlayMinutesPerItem)} = mindestens ${formatMinutes(minRequired)}.`);
    }

    if (playMinutes > maxAllowed) {
      validationErrors.push(`${totalTimeLabel} zu lang: ${maxItems} ${itemLabel} × Max ${formatMinutes(maxPlayMinutesPerItem)} = maximal ${formatMinutes(maxAllowed)}.`);
    }
  }

  const hasValidationErrors = validationErrors.length > 0;
  const canSubmit = canStart && !hasValidationErrors;

  const handleStart = () => {
    if (!canSubmit) return;
    onStart({
      kind,
      name: isCompactActivity || isGoogle ? cfg.title : activityName.trim(),
      sheetUrl: sheetUrl.trim(),
      maxItems,
      playMinutes,
      maxPlayMinutesPerItem,
      minPlayMinutesPerItem,
      deviceIds,
      scrollsPerSite,
    });
    onClose();
  };

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: "calc(100vw - 32px)",
          background: "rgba(18,22,30,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,232,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 18px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: `rgba(${ACCENT_RGB},0.12)`,
              border: `1px solid rgba(${ACCENT_RGB},0.2)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {activityLogo}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
              {cfg.title}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
              {cfg.subtitle}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.35)",
              padding: 4,
              borderRadius: 6,
              display: "flex",
            }}
          >
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {isGoogle ? (
            <>
              <Field label={cfg.sheetLabel}>
                <input
                  style={INPUT_STYLE}
                  placeholder="https://docs.google.com/spreadsheets/..."
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  autoFocus
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Max Search Time">
                  <TimeDrag value={playMinutes} onChange={setPlayMinutes} min={1} max={24 * 60} />
                </Field>
                <Field label={cfg.maxLabel}>
                  <DragNumber value={maxItems} onChange={setMaxItems} min={1} max={500} step={1} />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                <Field label="Scrolls / Sites">
                  <DragNumber value={scrollsPerSite} onChange={setScrollsPerSite} min={0} max={100} step={1} />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label={cfg.maxPlayLabel}>
                  <TimeDrag value={maxPlayMinutesPerItem} onChange={setMaxPlayMinutesPerItem} min={1} max={24 * 60} />
                </Field>
                <Field label="Min Search / Site">
                  <TimeDrag value={minPlayMinutesPerItem} onChange={setMinPlayMinutesPerItem} min={1} max={24 * 60} />
                </Field>
              </div>
            </>
          ) : isCompactActivity ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Max Play Time">
                <TimeDrag value={maxPlayMinutesPerItem} onChange={setMaxPlayMinutesPerItem} min={1} max={24 * 60} />
              </Field>
              <Field label="Min Play Time">
                <TimeDrag value={minPlayMinutesPerItem} onChange={setMinPlayMinutesPerItem} min={1} max={24 * 60} />
              </Field>
            </div>
          ) : (
            <>
              <Field label={cfg.nameLabel}>
                <input
                  style={INPUT_STYLE}
                  placeholder={cfg.namePlaceholder}
                  value={activityName}
                  onChange={(e) => setActivityName(e.target.value)}
                  autoFocus
                />
              </Field>

              <Field label={cfg.sheetLabel}>
                <input
                  style={INPUT_STYLE}
                  placeholder="https://docs.google.com/spreadsheets/..."
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label={cfg.maxLabel}>
                  <DragNumber value={maxItems} onChange={setMaxItems} min={1} max={500} step={1} />
                </Field>
                <Field label="Play Time">
                  <TimeDrag value={playMinutes} onChange={setPlayMinutes} min={1} max={24 * 60} />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label={cfg.maxPlayLabel}>
                  <TimeDrag value={maxPlayMinutesPerItem} onChange={setMaxPlayMinutesPerItem} min={1} max={24 * 60} />
                </Field>
                <Field label="Min Play">
                  <TimeDrag value={minPlayMinutesPerItem} onChange={setMinPlayMinutesPerItem} min={1} max={24 * 60} />
                </Field>
              </div>
            </>
          )}

          <div
            style={{
              background: `linear-gradient(135deg, rgba(${ACCENT_RGB},0.08), rgba(255,255,255,0.025))`,
              border: `1px solid rgba(${ACCENT_RGB},0.13)`,
              borderRadius: 8,
              padding: "8px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: `rgba(${ACCENT_RGB},0.72)`, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {cfg.avgLabel}
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.85)", fontFamily: "var(--app-font-mono, monospace)" }}>
              {formatMinutes(avgMinutesPerItem)}
            </span>
          </div>

          {hasValidationErrors && (
            <div
              style={{
                border: "1px solid rgba(239,68,68,0.28)",
                background: "rgba(239,68,68,0.08)",
                borderRadius: 8,
                padding: "8px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {validationErrors.map((error) => (
                <div
                  key={error}
                  style={{
                    fontSize: 10,
                    lineHeight: 1.4,
                    color: "rgba(255,180,180,0.9)",
                    fontWeight: 600,
                  }}
                >
                  {error}
                </div>
              ))}
            </div>
          )}

          <Field label={`Device IDs · ${deviceIds.length} selected`}>
            <div
              style={{
                minHeight: 38,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "6px 8px",
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
              }}
            >
              {deviceIds.length === 0 ? (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: "26px", padding: "0 3px" }}>
                  No devices selected
                </span>
              ) : (
                deviceIds.map((id) => (
                  <span
                    key={id}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: "var(--app-font-mono, monospace)",
                      background: `rgba(${ACCENT_RGB},0.1)`,
                      border: `1px solid rgba(${ACCENT_RGB},0.2)`,
                      borderRadius: 4,
                      padding: "2px 6px",
                      color: ACCENT,
                      lineHeight: 1.8,
                    }}
                  >
                    {String(id).padStart(3, "0")}
                  </span>
                ))
              )}
            </div>
          </Field>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "12px 18px 16px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.55)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!canSubmit}
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              border: `1px solid ${canSubmit ? `rgba(${ACCENT_RGB},0.4)` : "rgba(255,255,255,0.08)"}`,
              background: canSubmit ? `rgba(${ACCENT_RGB},0.15)` : "rgba(255,255,255,0.03)",
              color: canSubmit ? ACCENT : "rgba(255,255,255,0.2)",
              fontSize: 12,
              fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all .15s",
            }}
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
