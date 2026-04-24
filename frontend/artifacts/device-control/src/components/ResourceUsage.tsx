import React, { useEffect, useState } from "react";
import { Activity, Box, Cpu, MemoryStick, RefreshCw } from "lucide-react";
import { buildMagSpotApiUrl, getMagSpotHeaders } from "@/lib/magspotApi";

type ResourcePayload = {
  cpu?: { percent?: number; usage?: number };
  ram?: { percent?: number; usage?: number; total?: number; used?: number };
  containers?: Array<{ name?: string; status?: string; cpu?: string; memory?: string }> | Record<string, unknown>;
};

type ResourceState = {
  cpu: number | null;
  ram: number | null;
  containers: number | null;
};

const emptyResources: ResourceState = { cpu: null, ram: null, containers: null };

function getPercent(value: ResourcePayload["cpu"] | ResourcePayload["ram"]): number | null {
  const raw = value?.percent ?? value?.usage;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  // Handle string values like "35%" returned by some backend versions
  if (typeof raw === "string") {
    const parsed = parseFloat(raw.replace("%", ""));
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
  return null;
}

function normalizeResources(raw: unknown): ResourceState {
  const payload = raw && typeof raw === "object" && "data" in raw
    ? (raw as { data?: ResourcePayload }).data
    : raw as ResourcePayload;
  const containers = payload?.containers;
  return {
    cpu: getPercent(payload?.cpu),
    ram: getPercent(payload?.ram),
    containers: Array.isArray(containers) ? containers.length : containers && typeof containers === "object" ? Object.keys(containers).length : null,
  };
}

function pctColor(pct: number | null): string {
  if (pct === null) return "#00d4e8";
  if (pct < 50) return "#22c55e";
  if (pct < 80) return "#3b82f6";
  return "#ef4444";
}

function ResourceRow({ icon, label, value, pct }: { icon: React.ReactNode; label: string; value: string; pct?: number | null }) {
  return (
    <div className="flex items-center justify-between rounded-md px-2.5 py-2" style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.075)" }}>
      <span className="flex items-center gap-2 text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.64)" }}>
        {icon}
        {label}
      </span>
      <span className="text-[11px] font-mono font-semibold" style={{ color: pct !== undefined ? pctColor(pct) : "#00d4e8" }}>{value}</span>
    </div>
  );
}

export function ResourceUsage() {
  const [resources, setResources] = useState<ResourceState>(emptyResources);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadResources = async () => {
      try {
        const response = await fetch(buildMagSpotApiUrl("/api/system/resources"), {
          headers: getMagSpotHeaders({ Accept: "application/json" }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!active) return;
        setResources(normalizeResources(payload));
        setError(null);
      } catch (resourceError) {
        if (!active) return;
        setError(resourceError instanceof Error ? resourceError.message : "Unavailable");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadResources();
    const interval = window.setInterval(loadResources, 2_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" style={{ color: "#00d4e8" }} />
          <span className="text-[13px] font-semibold tracking-tight" style={{ color: "rgba(255,255,255,0.78)" }}>Resources</span>
        </div>
        {isLoading && <RefreshCw className="w-3 h-3 animate-spin" style={{ color: "rgba(255,255,255,0.35)" }} />}
      </div>
      <div className="space-y-1.5">
        <ResourceRow icon={<Cpu className="w-3.5 h-3.5" />} label="CPU" value={resources.cpu === null ? "--" : `${resources.cpu}%`} pct={resources.cpu} />
        <ResourceRow icon={<MemoryStick className="w-3.5 h-3.5" />} label="RAM" value={resources.ram === null ? "--" : `${resources.ram}%`} pct={resources.ram} />
        <ResourceRow icon={<Box className="w-3.5 h-3.5" />} label="Containers" value={resources.containers === null ? "--" : String(resources.containers)} />
      </div>
      {error && <div className="mt-2 text-[10px] font-mono" style={{ color: "rgba(248,113,113,0.85)" }}>Resource API: {error}</div>}
    </div>
  );
}