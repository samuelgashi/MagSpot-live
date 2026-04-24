export const SCHEDULE_RESULTS_STORAGE_KEY = "magspot-schedule-results-v1";

export type SavedScheduleBlock = {
  act: string;
  absStart: number;
  absEnd: number;
};

export type SavedScheduleDevice = {
  deviceId: number;
  deviceNumber: number;
  currentIp: string;
  blocks: SavedScheduleBlock[];
};

export type SavedScheduleResult = {
  id: string;
  generatedAt: string;
  dates: string[];
  devices: SavedScheduleDevice[];
};

export type SchedulePlanScope = {
  deviceIds: number[];
  dateKeys: string[];
  baselineResult?: SavedScheduleResult;
};

export type ScheduleBlockRef = {
  deviceId: number;
  dayIndex: number;
  act: string;
  startH: number;
  endH: number;
};

export function loadSavedScheduleResult(): SavedScheduleResult | null {
  try {
    const raw = window.localStorage.getItem(SCHEDULE_RESULTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.dates) || !Array.isArray(parsed.devices)) {
      return null;
    }
    return parsed as SavedScheduleResult;
  } catch {
    return null;
  }
}

export function saveScheduleResult(result: SavedScheduleResult) {
  window.localStorage.setItem(SCHEDULE_RESULTS_STORAGE_KEY, JSON.stringify(result));
}

function sameTime(a: number, b: number) {
  return Math.abs(a - b) < 0.01;
}

function remapBlocks(blocks: SavedScheduleBlock[], fromDates: string[], toDates: string[], skip?: (deviceDayIndex: number, block: SavedScheduleBlock) => boolean) {
  const mapped: SavedScheduleBlock[] = [];
  for (const block of blocks) {
    const firstDay = Math.floor(block.absStart / 24);
    const lastDay = Math.floor((block.absEnd - 0.0001) / 24);
    for (let dayIndex = firstDay; dayIndex <= lastDay; dayIndex++) {
      const dateKey = fromDates[dayIndex];
      const newDayIndex = toDates.indexOf(dateKey);
      if (newDayIndex < 0) continue;
      const dayStart = dayIndex * 24;
      const startH = Math.max(block.absStart, dayStart) - dayStart;
      const endH = Math.min(block.absEnd, dayStart + 24) - dayStart;
      if (endH <= startH) continue;
      const segment = { act: block.act, absStart: newDayIndex * 24 + startH, absEnd: newDayIndex * 24 + endH };
      if (skip?.(dayIndex, segment)) continue;
      mapped.push(segment);
    }
  }
  return mapped;
}

export function mergeScheduleResult(existing: SavedScheduleResult | null, incoming: SavedScheduleResult): SavedScheduleResult {
  if (!existing) return incoming;
  const dates = Array.from(new Set([...existing.dates, ...incoming.dates])).sort();
  const replaceDates = new Set(incoming.dates);
  const incomingDeviceIds = new Set(incoming.devices.map((device) => device.deviceId));
  const incomingById = new Map(incoming.devices.map((device) => [device.deviceId, device]));
  const existingById = new Map(existing.devices.map((device) => [device.deviceId, device]));
  const deviceIds = Array.from(new Set([...existing.devices.map((device) => device.deviceId), ...incoming.devices.map((device) => device.deviceId)]));

  return {
    id: `schedule-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    dates,
    devices: deviceIds.map((deviceId) => {
      const oldDevice = existingById.get(deviceId);
      const newDevice = incomingById.get(deviceId);
      const oldBlocks = oldDevice
        ? remapBlocks(oldDevice.blocks, existing.dates, dates, (oldDayIndex) => incomingDeviceIds.has(deviceId) && replaceDates.has(existing.dates[oldDayIndex]))
        : [];
      const newBlocks = newDevice ? remapBlocks(newDevice.blocks, incoming.dates, dates) : [];
      return {
        deviceId,
        deviceNumber: newDevice?.deviceNumber ?? oldDevice?.deviceNumber ?? deviceId,
        currentIp: newDevice?.currentIp ?? oldDevice?.currentIp ?? "",
        blocks: [...oldBlocks, ...newBlocks].sort((a, b) => a.absStart - b.absStart),
      };
    }),
  };
}

export function mergeScheduleResultForScope(existing: SavedScheduleResult | null, incoming: SavedScheduleResult, scope: Pick<SchedulePlanScope, "deviceIds" | "dateKeys">): SavedScheduleResult {
  if (!existing) return incoming;
  const dates = Array.from(new Set([...existing.dates, ...incoming.dates, ...scope.dateKeys])).sort();
  const replaceDates = new Set(scope.dateKeys);
  const replaceDeviceIds = new Set(scope.deviceIds);
  const incomingById = new Map(incoming.devices.map((device) => [device.deviceId, device]));
  const existingById = new Map(existing.devices.map((device) => [device.deviceId, device]));
  const deviceIds = Array.from(new Set([...existing.devices.map((device) => device.deviceId), ...incoming.devices.map((device) => device.deviceId)]));

  return {
    id: `schedule-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    dates,
    devices: deviceIds.map((deviceId) => {
      const oldDevice = existingById.get(deviceId);
      const newDevice = incomingById.get(deviceId);
      const oldBlocks = oldDevice
        ? remapBlocks(oldDevice.blocks, existing.dates, dates, (oldDayIndex) => replaceDeviceIds.has(deviceId) && replaceDates.has(existing.dates[oldDayIndex]))
        : [];
      const newBlocks = newDevice
        ? remapBlocks(newDevice.blocks, incoming.dates, dates, (incomingDayIndex) => !replaceDeviceIds.has(deviceId) || !replaceDates.has(incoming.dates[incomingDayIndex]))
        : [];
      return {
        deviceId,
        deviceNumber: newDevice?.deviceNumber ?? oldDevice?.deviceNumber ?? deviceId,
        currentIp: newDevice?.currentIp ?? oldDevice?.currentIp ?? "",
        blocks: [...oldBlocks, ...newBlocks].sort((a, b) => a.absStart - b.absStart),
      };
    }),
  };
}

export function deleteScheduleDayForDevices(result: SavedScheduleResult, dayIndex: number, deviceIds: number[]) {
  const deviceSet = new Set(deviceIds);
  return {
    ...result,
    id: `schedule-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    devices: result.devices.map((device) => ({
      ...device,
      blocks: deviceSet.has(device.deviceId)
        ? remapBlocks(device.blocks, result.dates, result.dates, (currentDayIndex) => currentDayIndex === dayIndex)
        : device.blocks,
    })),
  };
}

export function deleteScheduleBlocks(result: SavedScheduleResult, refs: ScheduleBlockRef[]) {
  const refKeys = new Set(refs.map((ref) => `${ref.deviceId}:${ref.dayIndex}:${ref.act}:${ref.startH.toFixed(2)}:${ref.endH.toFixed(2)}`));
  return {
    ...result,
    id: `schedule-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    devices: result.devices.map((device) => ({
      ...device,
      blocks: remapBlocks(device.blocks, result.dates, result.dates, (dayIndex, block) => {
        const startH = block.absStart - dayIndex * 24;
        const endH = block.absEnd - dayIndex * 24;
        return refKeys.has(`${device.deviceId}:${dayIndex}:${block.act}:${startH.toFixed(2)}:${endH.toFixed(2)}`)
          || refs.some((ref) => ref.deviceId === device.deviceId && ref.dayIndex === dayIndex && ref.act === block.act && sameTime(ref.startH, startH) && sameTime(ref.endH, endH));
      }),
    })),
  };
}