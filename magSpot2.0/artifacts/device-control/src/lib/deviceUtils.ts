export function isUsbDevice(device: { ip?: string }): boolean {
  return !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test((device.ip ?? "").split(":")[0]);
}

export function deviceStatusColor(device: { ip?: string; status?: string }): string {
  if (isUsbDevice(device)) return "#3b82f6";
  if (device.status === "online") return "#22c55e";
  if (device.status === "offline") return "#ef4444";
  return "#eab308";
}
