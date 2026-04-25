import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { KeyRound, Lock, LogOut, Loader2, Play, PlugZap, Save, Settings, Square, Trash2, Unplug, X } from "lucide-react";
import { COMMON_TIMEZONES, getTodayDateKey, useAppTimezone } from "@/lib/timezone";
import { checkMagSpotHealth, changeMagSpotPassword, createMagSpotApiKey, deleteMagSpotApiKey, disconnectAllMagSpotDevices, getMagSpotTunnelStatus, listMagSpotApiKeys, MagSpotApiKey, startMagSpotScrcpyTunnel, stopMagSpotScrcpyTunnel } from "@/lib/magspotApi";
import { clearSessionToken } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { useToast } from "@/hooks/use-toast";

const ACCENT = "#00d4e8";
const ACCENT_RGB = "0,212,232";

export function SettingsPanel({ onClose, onLogout }: { onClose: () => void; onLogout?: () => void }) {
  const { t } = useLang();
  const { toast } = useToast();
  const { timeZone, setTimeZone, browserTimeZone } = useAppTimezone();
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [lifeTime, setLifeTime] = useState("24");
  const [tunnelUrl, setTunnelUrl] = useState("");
  const [apiKeys, setApiKeys] = useState<MagSpotApiKey[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const timezoneOptions = useMemo(() => {
    const merged = new Set([timeZone, browserTimeZone, ...COMMON_TIMEZONES]);
    const runtimeZones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    runtimeZones.slice(0, 400).forEach((zone) => merged.add(zone));
    return Array.from(merged).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [browserTimeZone, timeZone]);

  useEffect(() => {
    // If the user hasn't saved a URL yet, seed localStorage from the build-time
    // env var (VITE_BACKEND_API_URL set in .env or passed as a Docker build ARG).
    // This means deployers only need to set the variable once — the settings panel
    // will already show the correct URL on first open.
    const stored = localStorage.getItem("apiBackendUrl") || "";
    if (!stored.trim()) {
      const baked = (import.meta.env.VITE_BACKEND_API_URL as string | undefined)?.trim();
      if (baked) {
        localStorage.setItem("apiBackendUrl", baked);
        setApiUrl(baked);
      } else {
        setApiUrl("");
      }
    } else {
      setApiUrl(stored);
    }
    setApiKey(localStorage.getItem("apiKey") || "");
    void loadKeys();
    void loadTunnel();
  }, []);

  const withBusy = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Action failed", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const loadKeys = async () => {
    try {
      setApiKeys(await listMagSpotApiKeys());
    } catch {
      setApiKeys([]);
    }
  };

  const loadTunnel = async () => {
    try {
      const result = await getMagSpotTunnelStatus();
      setTunnelUrl(result.tunnel?.tunnel_url || "");
    } catch {
      setTunnelUrl("");
    }
  };

  const saveSettings = () => {
    localStorage.setItem("apiBackendUrl", apiUrl.trim());
    localStorage.setItem("apiKey", apiKey.trim());
    toast({ title: "Settings saved" });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.56)", backdropFilter: "blur(5px)" }}>
      <div className="w-full sm:max-w-5xl h-[92vh] sm:h-[82vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col" style={{ background: "rgba(10,13,22,0.98)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 28px 90px rgba(0,0,0,0.7)" }}>
        <div className="h-14 flex items-center justify-between px-4 sm:px-5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `rgba(${ACCENT_RGB},0.12)`, border: `1px solid rgba(${ACCENT_RGB},0.28)` }}>
              <Settings className="w-4 h-4" style={{ color: ACCENT }} />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{t.settingsTitle}</div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.36)" }}>API, tunnel, device and date/time configuration</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10" style={{ color: "rgba(255,255,255,0.58)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-5">
          <div className="flex flex-wrap justify-end gap-2 mb-4">
            <ActionButton icon={LogOut} label="Logout" danger onClick={() => {
              clearSessionToken();
              onClose();
              onLogout?.();
            }} />
            <ActionButton icon={Unplug} label={busy === "disconnect" ? "Disconnecting..." : "Disconnect All Devices"} danger disabled={busy === "disconnect"} onClick={() => withBusy("disconnect", async () => {
              if (!window.confirm("Disconnect all ADB devices?")) return;
              const result = await disconnectAllMagSpotDevices();
              toast({ title: result.details || result.output || "Devices disconnected" });
            })} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <SettingsCard title="API Configuration" subtitle="Set the backend API URL and optional API key." icon={PlugZap}>
              <Field label="API Backend URL">
                <input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} placeholder="/api" className="h-10 w-full rounded-lg px-3 text-sm outline-none text-white placeholder-white/25" style={inputStyle} />
              </Field>
              <Field label="Backend API Key">
                <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type="password" placeholder="Optional API key" className="h-10 w-full rounded-lg px-3 text-sm outline-none text-white placeholder-white/25" style={inputStyle} />
              </Field>
              <div className="flex gap-2">
                <ActionButton icon={Save} label="Save Settings" onClick={saveSettings} grow />
                <ActionButton icon={busy === "test" ? Loader2 : PlugZap} label={busy === "test" ? "Testing..." : "Test Connection"} disabled={busy === "test"} onClick={() => withBusy("test", async () => {
                  const result = await checkMagSpotHealth();
                  toast({ title: result.message || "Connection successful" });
                })} grow />
              </div>
            </SettingsCard>

            <SettingsCard title="Tunnels" subtitle="Manage Cloudflare tunnel for scrcpy access." icon={Play}>
              <Field label="Cloudflared Public URL">
                <input value={tunnelUrl} readOnly placeholder="No tunnel active" className="h-10 w-full rounded-lg px-3 text-sm outline-none text-white placeholder-white/25" style={inputStyle} />
              </Field>
              <div className="flex gap-2">
                <ActionButton icon={busy === "startTunnel" ? Loader2 : Play} label={busy === "startTunnel" ? "Starting..." : "Start Ws-Scrcpy"} disabled={busy === "startTunnel"} onClick={() => withBusy("startTunnel", async () => {
                  const result = await startMagSpotScrcpyTunnel();
                  setTunnelUrl(result.public_url || result.local_url || "");
                  toast({ title: result.public_url || result.output || "Tunnel started" });
                })} grow />
                <ActionButton icon={busy === "stopTunnel" ? Loader2 : Square} label={busy === "stopTunnel" ? "Stopping..." : "Stop Scrcpy"} disabled={busy === "stopTunnel"} onClick={() => withBusy("stopTunnel", async () => {
                  const result = await stopMagSpotScrcpyTunnel();
                  setTunnelUrl("");
                  toast({ title: result.output || "Tunnel stopped" });
                })} grow />
              </div>
            </SettingsCard>

            <SettingsCard title="API Key Configuration" subtitle="Generate and manage backend access keys." icon={KeyRound}>
              <div className="flex gap-2 items-end">
                <Field label="Lifetime (Days)" className="flex-1">
                  <input value={lifeTime} onChange={(event) => setLifeTime(event.target.value)} type="number" min="1" className="h-10 w-full rounded-lg px-3 text-sm outline-none text-white placeholder-white/25" style={inputStyle} />
                </Field>
                <ActionButton icon={busy === "key" ? Loader2 : KeyRound} label={busy === "key" ? "Generating..." : "Generate API Key"} disabled={busy === "key"} onClick={() => withBusy("key", async () => {
                  const days = Number(lifeTime);
                  if (!Number.isFinite(days) || days <= 0) throw new Error("Please enter a valid lifetime.");
                  const result = await createMagSpotApiKey(days);
                  toast({ title: `API key created: ${result.api_key}` });
                  await loadKeys();
                })} />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.72)" }}>Generated API Keys</div>
                {apiKeys.length === 0 ? (
                  <div className="rounded-xl p-4 text-xs" style={{ background: "rgba(255,255,255,0.025)", border: "1px dashed rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.28)" }}>No API keys generated yet.</div>
                ) : (
                  apiKeys.map((key) => (
                    <div key={key.key_id} className="rounded-xl p-3 flex items-center justify-between gap-3" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="min-w-0">
                        <div className="text-xs font-mono truncate text-white">{key.key_id}</div>
                        <div className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.38)" }}>Expires: {new Date(key.life_time).toLocaleString()} • Endpoints: {key.authorized_endpoints}</div>
                      </div>
                      <button onClick={() => withBusy(`delete-${key.key_id}`, async () => { await deleteMagSpotApiKey(key.key_id); await loadKeys(); })} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/10" style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.24)" }}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </SettingsCard>

            <SettingsCard title="Security" subtitle="Change your account password." icon={Lock}>
              <Field label="Current Password">
                <input value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} type="password" placeholder="Current password" className="h-10 w-full rounded-lg px-3 text-sm outline-none text-white placeholder-white/25" style={inputStyle} />
              </Field>
              <Field label="New Password">
                <input value={newPw} onChange={(e) => setNewPw(e.target.value)} type="password" placeholder="New password" className="h-10 w-full rounded-lg px-3 text-sm outline-none text-white placeholder-white/25" style={inputStyle} />
              </Field>
              <Field label="Confirm New Password">
                <input value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} type="password" placeholder="Confirm new password" className="h-10 w-full rounded-lg px-3 text-sm outline-none text-white placeholder-white/25" style={inputStyle} />
              </Field>
              <ActionButton icon={busy === "changePw" ? Loader2 : Lock} label={busy === "changePw" ? "Changing…" : "Change Password"} disabled={busy === "changePw"} onClick={() => withBusy("changePw", async () => {
                if (!currentPw || !newPw || !confirmPw) throw new Error("Please fill in all password fields.");
                if (newPw !== confirmPw) throw new Error("New passwords do not match.");
                if (newPw.length < 4) throw new Error("New password must be at least 4 characters.");
                await changeMagSpotPassword(currentPw, newPw);
                toast({ title: "Password changed successfully" });
                setCurrentPw(""); setNewPw(""); setConfirmPw("");
              })} grow />
            </SettingsCard>

            <SettingsCard title={t.settingsDateTimeTitle} subtitle={t.settingsTimezoneHint} icon={Settings}>
              <Field label={t.settingsTimezone}>
                <select value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className="h-10 w-full rounded-lg px-3 text-sm outline-none" style={inputStyle}>
                  {timezoneOptions.map((zone) => <option key={zone} value={zone} style={{ background: "#0b0f1a", color: "white" }}>{zone}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Info label={t.settingsBrowserTimezone} value={browserTimeZone} />
                <Info label={t.settingsCurrentDate} value={getTodayDateKey(timeZone)} accent />
              </div>
            </SettingsCard>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SettingsCard({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 space-y-4" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `rgba(${ACCENT_RGB},0.1)`, border: `1px solid rgba(${ACCENT_RGB},0.22)` }}>
          <Icon className="w-4 h-4" style={{ color: ACCENT }} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.36)" }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block space-y-2 ${className || ""}`}><span className="block text-xs font-bold" style={{ color: "rgba(255,255,255,0.72)" }}>{label}</span>{children}</label>;
}

function ActionButton({ icon: Icon, label, onClick, disabled, danger, grow }: { icon: React.ElementType; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; grow?: boolean }) {
  return (
    <button title={label} onClick={onClick} disabled={disabled} className={`h-10 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-40 ${grow ? "flex-1" : ""}`} style={{ background: danger ? "rgba(239,68,68,0.16)" : `rgba(${ACCENT_RGB},0.12)`, border: danger ? "1px solid rgba(239,68,68,0.35)" : `1px solid rgba(${ACCENT_RGB},0.3)`, color: danger ? "#f87171" : ACCENT }}>
      <Icon className={`w-4 h-4 ${disabled ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Info({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg p-3 min-w-0" style={{ background: accent ? `rgba(${ACCENT_RGB},0.08)` : "rgba(255,255,255,0.04)", border: accent ? `1px solid rgba(${ACCENT_RGB},0.18)` : "1px solid rgba(255,255,255,0.07)" }}>
      <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)" }}>{label}</div>
      <div className="text-xs font-mono mt-1 truncate" style={{ color: accent ? ACCENT : "rgba(255,255,255,0.68)" }}>{value}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "white",
};