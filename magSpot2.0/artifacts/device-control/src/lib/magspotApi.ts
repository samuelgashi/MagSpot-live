const DEVICE_ID_MAP_KEY = "magspot-device-id-map";

function readLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readDeviceIdMap(): Record<string, string> {
  const raw = readLocalStorage(DEVICE_ID_MAP_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function getMagSpotBackendUrl(): string {
  return readLocalStorage("apiBackendUrl") || "/api";
}

export function buildMagSpotApiUrl(path: string): string {
  const base = getMagSpotBackendUrl().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/api/") ? path.slice(4) : path;
  if (base.endsWith("/api")) {
    return `${base}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
  }
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getMagSpotHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  // Session token (browser login) takes priority
  const sessionToken = readLocalStorage("sessionToken");
  if (sessionToken && !headers.has("authorization")) headers.set("authorization", `Bearer ${sessionToken}`);
  // Fallback: plain API key for headless / APIAAS clients
  const apiKey = readLocalStorage("apiKey");
  if (apiKey && !headers.has("x-api-key")) headers.set("x-api-key", apiKey);
  return headers;
}

export function getMagSpotDeviceBackendId(device: {
  id: number;
  ip?: string;
  [key: string]: unknown;
}): string {
  const explicitId =
    typeof device.backendId === "string" ? device.backendId :
    typeof device.magspotId === "string" ? device.magspotId :
    typeof device.serial === "string" ? device.serial :
    undefined;
  if (explicitId) return explicitId;
  const mapped = readDeviceIdMap()[String(device.id)];
  if (mapped) return mapped;
  return device.ip ? `${device.ip}:5555` : String(device.id);
}

export function getMagSpotActionCommand(action: string): { command: string; args: string[] } {
  switch (action) {
    case "home":
      return { command: "shell", args: ["input", "keyevent", "HOME"] };
    case "back":
      return { command: "shell", args: ["input", "keyevent", "BACK"] };
    case "lock":
      return { command: "shell", args: ["input", "keyevent", "POWER"] };
    case "rotate":
      return { command: "shell", args: ["settings", "put", "system", "accelerometer_rotation", "1"] };
    case "volume-up":
      return { command: "shell", args: ["input", "keyevent", "VOLUME_UP"] };
    case "volume-down":
      return { command: "shell", args: ["input", "keyevent", "VOLUME_DOWN"] };
    case "wifi":
      return { command: "shell", args: ["svc", "wifi", "enable"] };
    default:
      return { command: "shell", args: ["input", "keyevent", "HOME"] };
  }
}

export async function postMagSpotDeviceAction(device: { id: number; ip?: string; [key: string]: unknown }, action: string) {
  const { command, args } = getMagSpotActionCommand(action);
  const response = await fetch(buildMagSpotApiUrl("/api/devices/command"), {
    method: "POST",
    headers: getMagSpotHeaders(),
    body: JSON.stringify({
      deviceIds: [getMagSpotDeviceBackendId(device)],
      command,
      args,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Device action failed");
  }
  return response.json().catch(() => null);
}

export function getMagSpotDeviceScreenshotUrl(device: { id: number; ip?: string; [key: string]: unknown }, nonce = Date.now()): string {
  const deviceId = encodeURIComponent(getMagSpotDeviceBackendId(device));
  return buildMagSpotApiUrl(`/api/devices/screenshot?deviceId=${deviceId}&t=${nonce}`);
}

export function getMagSpotDeviceStreamUrl(device: { id: number; ip?: string; [key: string]: unknown }, fps = 8, nonce = Date.now()): string {
  const deviceId = encodeURIComponent(getMagSpotDeviceBackendId(device));
  return buildMagSpotApiUrl(`/api/devices/stream?deviceId=${deviceId}&fps=${fps}&t=${nonce}`);
}

export function getMagSpotDeviceScrcpyStreamUrl(device: { id: number; ip?: string; [key: string]: unknown }, maxFps = 30, maxSize = 720, bitRate = 4_000_000): string {
  const deviceId = encodeURIComponent(getMagSpotDeviceBackendId(device));
  const apiUrl = buildMagSpotApiUrl(`/api/devices/scrcpy-stream?deviceId=${deviceId}&maxFps=${maxFps}&maxSize=${maxSize}&bitRate=${bitRate}`);
  const url = new URL(apiUrl, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function getMagSpotDeviceWsImageStreamUrl(device: { id: number; ip?: string; [key: string]: unknown }, maxSize = 540, quality = 70): string {
  const deviceId = encodeURIComponent(getMagSpotDeviceBackendId(device));
  const apiUrl = buildMagSpotApiUrl(`/api/devices/ws-image-stream?deviceId=${deviceId}&maxSize=${maxSize}&quality=${quality}`);
  const url = new URL(apiUrl, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export async function postMagSpotStartScrcpyServer(device: { id: number; ip?: string; [key: string]: unknown }): Promise<{ wsUrl: string }> {
  const response = await fetch(buildMagSpotApiUrl("/api/devices/start-scrcpy-server"), {
    method: "POST",
    headers: getMagSpotHeaders(),
    body: JSON.stringify({ deviceId: getMagSpotDeviceBackendId(device) }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(err.message ?? "Failed to start scrcpy server");
  }
  return response.json();
}

export async function postMagSpotStopScrcpyServer(device: { id: number; ip?: string; [key: string]: unknown }): Promise<void> {
  await fetch(buildMagSpotApiUrl("/api/devices/stop-scrcpy-server"), {
    method: "POST",
    headers: getMagSpotHeaders(),
    body: JSON.stringify({ deviceId: getMagSpotDeviceBackendId(device) }),
  });
}

export async function postMagSpotLiveControl(
  device: { id: number; ip?: string; [key: string]: unknown },
  payload: { type: "tap"; x: number; y: number } | { type: "swipe"; x: number; y: number; x2: number; y2: number; duration?: number },
) {
  const response = await fetch(buildMagSpotApiUrl("/api/devices/live-control"), {
    method: "POST",
    headers: getMagSpotHeaders(),
    body: JSON.stringify({
      deviceId: getMagSpotDeviceBackendId(device),
      ...payload,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Live control failed");
  }
  return response.json().catch(() => null);
}

export async function postMagSpotLiveControlToDevices(
  devices: Array<{ id: number; ip?: string; [key: string]: unknown }>,
  payload: { type: "tap"; x: number; y: number } | { type: "swipe"; x: number; y: number; x2: number; y2: number; duration?: number },
) {
  return Promise.all(devices.map((device) => postMagSpotLiveControl(device, payload)));
}

export interface MagSpotCommandResult {
  deviceId: string;
  success: boolean;
  output?: string;
  error?: string;
}

export interface MagSpotTask {
  task_id: string;
  device_id: string;
  status: string;
  progress?: number;
  logs?: string;
  task_type?: string;
  created_at?: string;
}

export interface MagSpotApiKey {
  key_id: string;
  life_time: string;
  authorized_endpoints: string;
}

function splitCommand(input: string): string[] {
  const matches = input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return matches.map((part) => part.replace(/^["']|["']$/g, ""));
}

export function normalizeAdbShellInput(input: string): { command: string; args: string[]; display: string } {
  let parts = splitCommand(input.trim());
  if (parts[0] === "adb") parts = parts.slice(1);
  if (parts[0] === "-s" && parts.length > 2) parts = parts.slice(2);
  if (parts[0] === "shell") return { command: "shell", args: parts.slice(1), display: `shell ${parts.slice(1).join(" ")}` };
  if (parts[0] === "install" || parts[0] === "uninstall" || parts[0] === "push" || parts[0] === "pull" || parts[0] === "reboot") {
    return { command: parts[0], args: parts.slice(1), display: parts.join(" ") };
  }
  return { command: "shell", args: parts, display: `shell ${parts.join(" ")}` };
}

async function readJsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const message = typeof data === "object" && data && "message" in data
      ? String((data as { message?: unknown }).message)
      : typeof data === "object" && data && "error" in data
        ? String((data as { error?: unknown }).error)
        : typeof data === "string" && data
          ? data
          : fallback;
    throw new Error(message);
  }
  return data as T;
}

export async function executeMagSpotAdbCommand(devices: Array<{ id: number; ip?: string; [key: string]: unknown }>, input: string) {
  const normalized = normalizeAdbShellInput(input);
  const response = await fetch(buildMagSpotApiUrl("/api/devices/command"), {
    method: "POST",
    headers: getMagSpotHeaders(),
    body: JSON.stringify({
      deviceIds: devices.map(getMagSpotDeviceBackendId),
      command: normalized.command,
      args: normalized.args,
    }),
  });
  const results = await readJsonOrThrow<MagSpotCommandResult[]>(response, "Failed to execute ADB command");
  return { normalized, results };
}

export async function getMagSpotTasks() {
  const response = await fetch(buildMagSpotApiUrl("/api/tasks"), { headers: getMagSpotHeaders() });
  return readJsonOrThrow<{ tasks: MagSpotTask[] }>(response, "Failed to fetch tasks");
}

export async function getMagSpotTask(taskId: string) {
  const response = await fetch(buildMagSpotApiUrl(`/api/tasks/${encodeURIComponent(taskId)}`), { headers: getMagSpotHeaders() });
  return readJsonOrThrow<MagSpotTask>(response, "Failed to fetch task");
}

export async function stopMagSpotTask(taskId: string) {
  const response = await fetch(buildMagSpotApiUrl(`/api/tasks/${encodeURIComponent(taskId)}/stop`), {
    method: "POST",
    headers: getMagSpotHeaders(),
  });
  return readJsonOrThrow<{ message: string; task_id: string }>(response, "Failed to stop task");
}

export async function stopAllMagSpotTasks() {
  const response = await fetch(buildMagSpotApiUrl("/api/tasks/stop-all"), {
    method: "POST",
    headers: getMagSpotHeaders(),
  });
  return readJsonOrThrow<{ message: string }>(response, "Failed to stop all tasks");
}

export async function clearMagSpotTasks() {
  const response = await fetch(buildMagSpotApiUrl("/api/tasks"), {
    method: "DELETE",
    headers: getMagSpotHeaders(),
  });
  return readJsonOrThrow<{ message: string }>(response, "Failed to clear tasks");
}

export async function checkMagSpotHealth() {
  const response = await fetch(buildMagSpotApiUrl("/api/health_check"), { headers: getMagSpotHeaders() });
  return readJsonOrThrow<{ status: string; message?: string }>(response, "Health check failed");
}

export async function disconnectAllMagSpotDevices() {
  const response = await fetch(buildMagSpotApiUrl("/api/disconnect_all_devices"), {
    method: "POST",
    headers: getMagSpotHeaders(),
  });
  return readJsonOrThrow<{ status: string; output?: string; details?: string }>(response, "Failed to disconnect devices");
}

export async function getMagSpotTunnelStatus() {
  const response = await fetch(buildMagSpotApiUrl("/api/get_tunnel_status"), { headers: getMagSpotHeaders() });
  return readJsonOrThrow<{ status: string; tunnel?: { is_tunnel_running?: boolean; tunnel_url?: string; is_scrcpy_running?: boolean; scrcpy_url?: string } }>(response, "Failed to get tunnel status");
}

export async function startMagSpotScrcpyTunnel() {
  const response = await fetch(buildMagSpotApiUrl("/api/start_scrcpy_tunnel"), {
    method: "POST",
    headers: getMagSpotHeaders(),
  });
  return readJsonOrThrow<{ status: string; output?: string; public_url?: string; local_url?: string }>(response, "Failed to start tunnel");
}

export async function stopMagSpotScrcpyTunnel() {
  const response = await fetch(buildMagSpotApiUrl("/api/stop_scrcpy_tunnel"), {
    method: "POST",
    headers: getMagSpotHeaders(),
  });
  return readJsonOrThrow<{ status: string; output?: string; public_url?: null }>(response, "Failed to stop tunnel");
}

export async function createMagSpotApiKey(lifeTime: number) {
  const response = await fetch(buildMagSpotApiUrl("/api/api_keys"), {
    method: "POST",
    headers: getMagSpotHeaders(),
    body: JSON.stringify({ user_id: "admin", life_time: lifeTime, authorized_endpoints: "*" }),
  });
  return readJsonOrThrow<{ api_key: string; key_id: string }>(response, "Failed to create API key");
}

export async function listMagSpotApiKeys() {
  const response = await fetch(buildMagSpotApiUrl("/api/api_keys?user_id=admin"), { headers: getMagSpotHeaders() });
  return readJsonOrThrow<MagSpotApiKey[]>(response, "Failed to list API keys");
}

export async function deleteMagSpotApiKey(keyId: string) {
  const response = await fetch(buildMagSpotApiUrl(`/api/api_keys/${encodeURIComponent(keyId)}?user_id=admin`), {
    method: "DELETE",
    headers: getMagSpotHeaders(),
  });
  return readJsonOrThrow<{ message?: string }>(response, "Failed to delete API key");
}

export interface MagSpotActivity {
  key: string;
  name: string;
  endpoint: string;
  method: string;
  icon: string;
}

interface RawActivity {
  name: string;
  endpoint: string;
  method: string;
  icon: string;
}

export async function getMagSpotActivities(): Promise<MagSpotActivity[]> {
  const response = await fetch(buildMagSpotApiUrl("/api/get_activities"), { headers: getMagSpotHeaders() });
  const json = await readJsonOrThrow<{ data: Record<string, RawActivity> }>(response, "Failed to fetch activities");
  return Object.entries(json.data).map(([key, val]) => ({ key, ...val }));
}

export async function loginToMagSpot(username: string, password: string): Promise<{ token: string; user_id: string }> {
  const response = await fetch(buildMagSpotApiUrl("/api/auth/login"), {
    method: "POST",
    headers: new Headers({ "content-type": "application/json" }),
    body: JSON.stringify({ username, password }),
  });
  return readJsonOrThrow<{ token: string; user_id: string }>(response, "Login failed");
}

export async function changeMagSpotPassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const response = await fetch(buildMagSpotApiUrl("/api/auth/change_password"), {
    method: "POST",
    headers: getMagSpotHeaders(),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  return readJsonOrThrow<{ message: string }>(response, "Failed to change password");
}