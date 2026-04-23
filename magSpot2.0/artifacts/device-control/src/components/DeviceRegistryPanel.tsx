import React, { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Device } from "@workspace/api-client-react";
import { Save, Trash2, X } from "lucide-react";
import { useLang } from "@/lib/lang";
import { CountryOption, countryFlag, matchCountries } from "@/lib/countries";

const ACCENT = "#00d4e8";
const ACCENT_RGB = "0,212,232";
export const DEVICE_REGISTRY_STORAGE_KEY = "magspot-device-registry-v1";
export const DEVICE_MODEL_OPTIONS_STORAGE_KEY = "magspot-device-model-options-v2";
export const DEVICE_REGISTRY_CHANGE_EVENT = "magspot-device-registry-change";

export type DeviceRegistryRecord = {
  deviceNumber: string;
  deviceModel: string;
  vpnCountry: string;
  vpnCountryCode: string;
  vpnCountryFlag: string;
  firstName: string;
  lastName: string;
  gmailAddress: string;
  gmailPassword: string;
  secondEmail: string;
  twoFactorNotes: string;
  cardHolder: string;
  cardType: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  billingDate: string;
  misc: string;
};

export type DeviceRegistryMap = Record<string, DeviceRegistryRecord>;

export const emptyRecord = (deviceNumber: string): DeviceRegistryRecord => ({
  deviceNumber,
  deviceModel: "",
  vpnCountry: "",
  vpnCountryCode: "",
  vpnCountryFlag: "",
  firstName: "",
  lastName: "",
  gmailAddress: "",
  gmailPassword: "",
  secondEmail: "",
  twoFactorNotes: "",
  cardHolder: "",
  cardType: "",
  cardNumber: "",
  expiryDate: "",
  cvv: "",
  billingDate: "",
  misc: "",
});

export function safeLoadRecords(): DeviceRegistryMap {
  try {
    const raw = window.localStorage.getItem(DEVICE_REGISTRY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function fetchRegistryFromApi(): Promise<DeviceRegistryMap | null> {
  try {
    const res = await fetch("/api/device-registry");
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

async function pushRecordToApi(deviceId: string, record: DeviceRegistryRecord): Promise<void> {
  try {
    await fetch(`/api/device-registry/${encodeURIComponent(deviceId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
  } catch { /* ignore */ }
}

async function deleteRecordFromApi(deviceId: string): Promise<void> {
  try {
    await fetch(`/api/device-registry/${encodeURIComponent(deviceId)}`, { method: "DELETE" });
  } catch { /* ignore */ }
}

export function saveDeviceModels(models: string[]): string[] {
  const normalized = models.reduce<string[]>((list, model) => {
    const trimmed = model.trim();
    if (!trimmed) return list;
    if (list.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) return list;
    return [...list, trimmed];
  }, []);
  window.localStorage.setItem(DEVICE_MODEL_OPTIONS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function safeLoadDeviceModels(records: DeviceRegistryMap = safeLoadRecords()): string[] {
  try {
    const raw = window.localStorage.getItem(DEVICE_MODEL_OPTIONS_STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : [];
    const storedModels = Array.isArray(stored) ? stored.filter((model): model is string => typeof model === "string") : [];
    return saveDeviceModels(storedModels);
  } catch {
    return [];
  }
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.38)" }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        autoComplete="off"
        className="h-9 min-w-0 rounded-lg px-3 text-sm outline-none text-white placeholder-white/20"
        style={{
          background: "rgba(255,255,255,0.055)",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      />
    </label>
  );
}

function ModelField({
  label,
  addLabel,
  value,
  options,
  onChange,
  onAdd,
}: {
  label: string;
  addLabel: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onAdd: (value: string) => void;
}) {
  const trimmed = value.trim();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const canAdd = Boolean(trimmed) && !options.some((option) => option.toLowerCase() === trimmed.toLowerCase());
  const visibleOptions = options.filter((option) => !trimmed || option.toLowerCase().includes(trimmed.toLowerCase()));

  return (
    <label
      className="flex min-w-0 flex-col gap-1.5"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDropdownOpen(false);
        }
      }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.38)" }}>
        {label}
      </span>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_36px] gap-2">
        <input
          value={value}
          onFocus={() => setIsDropdownOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setIsDropdownOpen(true);
          }}
          type="text"
          autoComplete="off"
          className="h-9 min-w-0 rounded-lg px-3 text-sm outline-none text-white placeholder-white/20"
          style={{
            background: "rgba(255,255,255,0.055)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        />
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => {
            onAdd(trimmed);
            setIsDropdownOpen(false);
          }}
          title={addLabel}
          className="h-9 rounded-lg text-sm font-bold transition-colors"
          style={{
            color: canAdd ? ACCENT : "rgba(255,255,255,0.22)",
            background: canAdd ? `rgba(${ACCENT_RGB},0.12)` : "rgba(255,255,255,0.04)",
            border: `1px solid ${canAdd ? `rgba(${ACCENT_RGB},0.3)` : "rgba(255,255,255,0.08)"}`,
          }}
        >
          +
        </button>
      </div>
      {isDropdownOpen && visibleOptions.length > 0 ? (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(7,10,18,0.84)" }}>
          {visibleOptions.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option);
                setIsDropdownOpen(false);
              }}
              className="w-full h-7 px-3 flex items-center text-left text-xs hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.82)" }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.38)" }}>
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="min-w-0 rounded-lg px-3 py-2 text-sm outline-none text-white resize-none placeholder-white/20"
        style={{
          background: "rgba(255,255,255,0.055)",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      />
    </label>
  );
}

function CountryField({
  label,
  codeLabel,
  hint,
  value,
  countryCode,
  countryFlagValue,
  onChange,
}: {
  label: string;
  codeLabel: string;
  hint: string;
  value: string;
  countryCode: string;
  countryFlagValue: string;
  onChange: (patch: Pick<DeviceRegistryRecord, "vpnCountry" | "vpnCountryCode" | "vpnCountryFlag">) => void;
}) {
  const matches = useMemo(() => matchCountries(value), [value]);
  const isSelectedCountry = Boolean(countryCode && countryFlagValue && matches.some((country) => country.code === countryCode && country.name === value));
  const visibleMatches = isSelectedCountry ? [] : matches;
  const bestMatch = matches[0] ?? null;

  const applyCountry = (country: CountryOption) => {
    onChange({
      vpnCountry: country.name,
      vpnCountryCode: country.code,
      vpnCountryFlag: countryFlag(country.code),
    });
  };

  const handleValueChange = (nextValue: string) => {
    const nextMatches = matchCountries(nextValue, 1);
    const nextMatch = nextMatches[0];
    onChange({
      vpnCountry: nextValue,
      vpnCountryCode: nextMatch ? nextMatch.code : "",
      vpnCountryFlag: nextMatch ? countryFlag(nextMatch.code) : "",
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.38)" }}>
        {label}
      </span>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_96px] gap-2">
        <input
          value={value}
          onChange={(event) => handleValueChange(event.target.value)}
          type="text"
          autoComplete="off"
          className="h-9 min-w-0 rounded-lg px-3 text-sm outline-none text-white placeholder-white/20"
          style={{
            background: "rgba(255,255,255,0.055)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        />
        <div
          className="h-9 rounded-lg px-3 flex items-center justify-between"
          style={{
            background: "rgba(255,255,255,0.045)",
            border: "1px solid rgba(255,255,255,0.09)",
            color: countryCode ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.22)",
          }}
        >
          <span className="text-[10px] uppercase tracking-[0.08em]">{codeLabel}</span>
          <span className="font-mono text-xs font-bold flex items-center gap-1.5">
            <span>{countryFlagValue}</span>
            <span>{countryCode}</span>
          </span>
        </div>
      </div>
      {visibleMatches.length > 0 ? (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(7,10,18,0.76)" }}>
          {visibleMatches.map((country) => {
            const flag = countryFlag(country.code);
            const isBest = bestMatch?.code === country.code;
            return (
              <button
                key={country.code}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyCountry(country)}
                className="w-full h-8 px-3 flex items-center justify-between text-left hover:bg-white/10"
                style={{ color: isBest ? ACCENT : "rgba(255,255,255,0.74)" }}
              >
                <span className="text-xs truncate">{country.name}</span>
                <span className="font-mono text-xs font-bold flex items-center gap-2">
                  <span>{flag}</span>
                  <span>{country.code}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : value.trim() && !isSelectedCountry ? (
        <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <h3 className="text-xs font-semibold mb-3" style={{ color: ACCENT }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function DeviceRegistryPanel({
  devices,
  onClose,
}: {
  devices: Device[];
  onClose: () => void;
}) {
  const { t } = useLang();
  const sortedDevices = useMemo(() => [...devices].sort((a, b) => a.id - b.id), [devices]);
  const [records, setRecords] = useState<DeviceRegistryMap>(() => safeLoadRecords());
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(() => sortedDevices[0]?.id ?? null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "form">("list");
  const selectedIndex = sortedDevices.findIndex((device) => device.id === selectedDeviceId);
  const selectedDevice = selectedIndex >= 0 ? sortedDevices[selectedIndex] : null;
  const selectedNumber = selectedIndex >= 0 ? String(selectedIndex + 1).padStart(3, "0") : "001";
  const selectedKey = selectedDevice ? String(selectedDevice.id) : "manual";
  const record = records[selectedKey] ?? emptyRecord(selectedNumber);
  const [modelOptions, setModelOptions] = useState<string[]>(() => safeLoadDeviceModels());

  useEffect(() => {
    if (selectedDeviceId === null && sortedDevices.length > 0) {
      setSelectedDeviceId(sortedDevices[0].id);
    }
  }, [selectedDeviceId, sortedDevices]);

  useEffect(() => {
    setIsClearConfirmOpen(false);
  }, [selectedDeviceId]);

  const updateRecord = (patch: Partial<DeviceRegistryRecord>) => {
    setRecords((prev) => ({
      ...prev,
      [selectedKey]: {
        ...(prev[selectedKey] ?? emptyRecord(selectedNumber)),
        ...patch,
      },
    }));
  };

  useEffect(() => {
    fetchRegistryFromApi().then((apiData) => {
      if (!apiData) return;
      const merged = { ...safeLoadRecords(), ...apiData };
      window.localStorage.setItem(DEVICE_REGISTRY_STORAGE_KEY, JSON.stringify(merged));
      setRecords(merged);
    });
  }, []);

  const saveRecords = () => {
    window.localStorage.setItem(DEVICE_REGISTRY_STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event(DEVICE_REGISTRY_CHANGE_EVENT));
    if (selectedKey !== "manual") {
      pushRecordToApi(selectedKey, records[selectedKey] ?? emptyRecord(selectedNumber));
    }
    onClose();
  };

  const clearSelected = () => {
    setRecords((prev) => {
      const next = { ...prev };
      delete next[selectedKey];
      window.localStorage.setItem(DEVICE_REGISTRY_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(DEVICE_REGISTRY_CHANGE_EVENT));
      return next;
    });
    if (selectedKey !== "manual") deleteRecordFromApi(selectedKey);
    setIsClearConfirmOpen(false);
  };

  const addDeviceModel = (model: string) => {
    const nextOptions = saveDeviceModels([...modelOptions, model]);
    setModelOptions(nextOptions);
    updateRecord({ deviceModel: model });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-5" style={{ background: "rgba(0,0,0,0.56)", backdropFilter: "blur(5px)" }}>
      {isClearConfirmOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,0.36)" }}>
          <div
            className="w-full max-w-sm rounded-2xl p-5"
            style={{
              background: "rgba(14,18,28,0.98)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
            }}
          >
            <div className="text-sm font-semibold text-white">{t.clearConfirmQuestion}</div>
            <div className="mt-2 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.46)" }}>
              Device {record.deviceNumber || selectedNumber} · {selectedDevice?.ip ?? t.noDevice}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="h-8 px-3 rounded-lg text-xs font-semibold hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.62)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={clearSelected}
                className="h-8 px-3 rounded-lg text-xs font-semibold"
                style={{ color: "#ffb4b4", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.34)" }}
              >
                {t.clearConfirmAction}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div
        className="w-full sm:max-w-6xl h-[92vh] sm:h-[86vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col sm:flex-row"
        style={{
          background: "rgba(12,15,24,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 28px 90px rgba(0,0,0,0.65)",
        }}
      >
        <aside
          className={`sm:w-64 sm:shrink-0 flex flex-col ${mobileView === "list" ? "flex w-full sm:w-64" : "hidden sm:flex"}`}
          style={{ borderRight: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.025)" }}
        >
          <div className="h-14 flex items-center justify-between px-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div>
              <div className="text-sm font-semibold text-white">Devices</div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.36)" }}>
                {t.deviceRegistrySubtitle}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10" style={{ color: "rgba(255,255,255,0.58)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {sortedDevices.map((device, index) => {
              const num = String(index + 1).padStart(3, "0");
              const isSelected = device.id === selectedDeviceId;
              const hasRecord = Boolean(records[String(device.id)]);
              return (
                <button
                  key={device.id}
                  onClick={() => { setSelectedDeviceId(device.id); setMobileView("form"); }}
                  className="w-full h-10 rounded-lg px-3 flex items-center justify-between text-left mb-1 transition-colors"
                  style={{
                    background: isSelected ? `rgba(${ACCENT_RGB},0.14)` : "transparent",
                    border: isSelected ? `1px solid rgba(${ACCENT_RGB},0.35)` : "1px solid transparent",
                    color: isSelected ? ACCENT : "rgba(255,255,255,0.72)",
                  }}
                >
                  <span className="font-mono text-xs font-bold">{num}</span>
                  <span className="font-mono text-[10px] truncate mx-2 flex-1" style={{ color: "rgba(255,255,255,0.34)" }}>
                    {device.ip}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: hasRecord ? ACCENT : "rgba(255,255,255,0.16)" }} />
                </button>
              );
            })}
          </div>
        </aside>

        <main className={`flex-1 flex flex-col min-w-0 ${mobileView === "form" ? "flex" : "hidden sm:flex"}`}>
          <div className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileView("list")}
                className="sm:hidden w-7 h-7 rounded-lg flex items-center justify-center mr-1 hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.58)" }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <span className="font-mono text-sm font-bold" style={{ color: ACCENT }}>
                {record.deviceNumber || selectedNumber}
              </span>
              <span className="font-mono text-xs truncate" style={{ color: "rgba(255,255,255,0.42)" }}>
                {selectedDevice?.ip ?? t.noDevice}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsClearConfirmOpen(true)}
                className="h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.48)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t.clear}
              </button>
              <button
                onClick={saveRecords}
                className="h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-2"
                style={{ color: ACCENT, background: `rgba(${ACCENT_RGB},0.12)`, border: `1px solid rgba(${ACCENT_RGB},0.3)` }}
              >
                <Save className="w-3.5 h-3.5" />
                {t.save}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-4">
            <Section title={t.deviceSection}>
              <div className="grid min-w-0 grid-cols-[180px_minmax(220px,250px)_minmax(0,1fr)] gap-4">
                <Field label={t.deviceNumber} value={record.deviceNumber} onChange={(value) => updateRecord({ deviceNumber: value })} />
                <ModelField
                  label={t.deviceModel}
                  addLabel={t.addDeviceModel}
                  value={record.deviceModel ?? ""}
                  options={modelOptions}
                  onChange={(value) => updateRecord({ deviceModel: value })}
                  onAdd={addDeviceModel}
                />
                <CountryField
                  label={t.vpnCountry}
                  codeLabel={t.countryCode}
                  hint={t.countryMatchHint}
                  value={record.vpnCountry}
                  countryCode={record.vpnCountryCode ?? ""}
                  countryFlagValue={record.vpnCountryFlag ?? ""}
                  onChange={(patch) => updateRecord(patch)}
                />
              </div>
            </Section>

            <Section title={t.accountSection}>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.firstName} value={record.firstName} onChange={(value) => updateRecord({ firstName: value })} />
                <Field label={t.lastName} value={record.lastName} onChange={(value) => updateRecord({ lastName: value })} />
                <Field label={t.gmailAddress} value={record.gmailAddress} onChange={(value) => updateRecord({ gmailAddress: value })} />
                <Field label={t.gmailPassword} type="password" value={record.gmailPassword} onChange={(value) => updateRecord({ gmailPassword: value })} />
                <Field label={t.secondEmail} value={record.secondEmail} onChange={(value) => updateRecord({ secondEmail: value })} />
                <TextAreaField label={t.twoFactorNotes} rows={3} value={record.twoFactorNotes} onChange={(value) => updateRecord({ twoFactorNotes: value })} />
              </div>
            </Section>

            <Section title={t.paymentSection}>
              <div className="grid grid-cols-3 gap-3">
                <Field label={t.cardHolder} value={record.cardHolder} onChange={(value) => updateRecord({ cardHolder: value })} />
                <Field label={t.cardType} value={record.cardType} onChange={(value) => updateRecord({ cardType: value })} />
                <Field label={t.cardNumber} value={record.cardNumber} onChange={(value) => updateRecord({ cardNumber: value })} />
                <Field label={t.expiryDate} value={record.expiryDate} onChange={(value) => updateRecord({ expiryDate: value })} />
                <Field label={t.cvv} type="password" value={record.cvv} onChange={(value) => updateRecord({ cvv: value })} />
                <Field label={t.billingDate} value={record.billingDate} onChange={(value) => updateRecord({ billingDate: value })} />
              </div>
            </Section>

            <Section title={t.miscSection}>
              <TextAreaField label={t.misc} rows={5} value={record.misc} onChange={(value) => updateRecord({ misc: value })} />
            </Section>
          </div>
        </main>
      </div>
    </div>,
    document.body
  );
}