import { getAppTimezone, getTodayDateKey } from "@/lib/timezone";
import { SavedScheduleBlock, SavedScheduleResult } from "@/lib/scheduleResults";

const DEVICE_EXECUTION_HEALTH_STORAGE_KEY = "magspot-device-execution-health-v1";

export type PlanIndicatorState = "running" | "idle" | "missing";
type DeviceExecutionHealth = Record<string, { state: "running" | "missing"; blockKey?: string; updatedAt?: string }>;

function getCurrentHourInTimezone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return value("hour") + value("minute") / 60 + value("second") / 3600;
}

function loadDeviceExecutionHealth(): DeviceExecutionHealth {
  try {
    const raw = window.localStorage.getItem(DEVICE_EXECUTION_HEALTH_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getActiveScheduleBlock(deviceId: number, schedule: SavedScheduleResult | null, now: Date): SavedScheduleBlock | null {
  if (!schedule) return null;
  const timeZone = getAppTimezone();
  const todayKey = getTodayDateKey(timeZone);
  const dayIndex = schedule.dates.indexOf(todayKey);
  if (dayIndex < 0) return null;
  const scheduledDevice = schedule.devices.find((item) => item.deviceId === deviceId);
  if (!scheduledDevice) return null;
  const currentAbsHour = dayIndex * 24 + getCurrentHourInTimezone(now, timeZone);
  return scheduledDevice.blocks.find((block) => currentAbsHour >= block.absStart && currentAbsHour < block.absEnd) ?? null;
}

export function getDevicePlanIndicator(deviceId: number, schedule: SavedScheduleResult | null, now: Date): PlanIndicatorState {
  const activeBlock = getActiveScheduleBlock(deviceId, schedule, now);
  if (!activeBlock) return "idle";
  const blockKey = `${activeBlock.act}:${activeBlock.absStart.toFixed(2)}:${activeBlock.absEnd.toFixed(2)}`;
  const health = loadDeviceExecutionHealth()[String(deviceId)];
  if (health?.state === "missing" && (!health.blockKey || health.blockKey === blockKey)) return "missing";
  return "running";
}

export function getPlanIndicatorStyle(state: PlanIndicatorState) {
  if (state === "running") return { bg: "#22c55e", glow: "rgba(34,197,94,0.55)" };
  if (state === "missing") return { bg: "#ef4444", glow: "rgba(239,68,68,0.48)" };
  return { bg: "rgba(148,163,184,0.58)", glow: "rgba(148,163,184,0.16)" };
}