import { useEffect, useState } from "react";

const STORAGE_KEY = "magspot-app-timezone-v1";
const CHANGE_EVENT = "magspot-timezone-change";

export const FALLBACK_TIMEZONE = "UTC";

export const COMMON_TIMEZONES = [
  "UTC",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Zurich",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function isValidTimezone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
}

export function getAppTimezone() {
  if (typeof window === "undefined") return FALLBACK_TIMEZONE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && isValidTimezone(stored)) return stored;
  const browserTimezone = getBrowserTimezone();
  return isValidTimezone(browserTimezone) ? browserTimezone : FALLBACK_TIMEZONE;
}

export function setAppTimezone(timeZone: string) {
  if (typeof window === "undefined" || !isValidTimezone(timeZone)) return;
  window.localStorage.setItem(STORAGE_KEY, timeZone);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: timeZone }));
}

export function formatDateKeyInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function getTodayDateKey(timeZone = getAppTimezone()) {
  return formatDateKeyInTimezone(new Date(), timeZone);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function useAppTimezone() {
  const [timeZone, setTimeZone] = useState(getAppTimezone);

  useEffect(() => {
    const sync = () => setTimeZone(getAppTimezone());
    const onCustom = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      setTimeZone(isValidTimezone(next) ? next : getAppTimezone());
    };
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, onCustom);
    };
  }, []);

  return { timeZone, setTimeZone: setAppTimezone, browserTimeZone: getBrowserTimezone() };
}