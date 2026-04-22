export type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

export type AuthTokenGetter = () => Promise<string | null> | string | null;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

// ---------------------------------------------------------------------------
// Module-level configuration
// ---------------------------------------------------------------------------

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

const DEVICE_ID_MAP_KEY = "magspot-device-id-map";
const GROUP_ID_MAP_KEY = "magspot-group-id-map";

/**
 * Set a base URL that is prepended to every relative request URL
 * (i.e. paths that start with `/`).
 *
 * Useful for Expo bundles that need to call a remote API server.
 * Pass `null` to clear the base URL.
 */
export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

/**
 * Register a getter that supplies a bearer auth token.  Before every fetch
 * the getter is invoked; when it returns a non-null string, an
 * `Authorization: Bearer <token>` header is attached to the request.
 *
 * Useful for Expo bundles making token-gated API calls.
 * Pass `null` to clear the getter.
 *
 * NOTE: This function should never be used in web applications where session
 * token cookies are automatically associated with API calls by the browser.
 */
export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

// Use loose check for URL — some runtimes (e.g. React Native) polyfill URL
// differently, so `instanceof URL` can fail.
function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}

function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!_baseUrl) return input;
  const url = resolveUrl(input);
  // Only prepend to relative paths (starting with /)
  if (!url.startsWith("/")) return input;

  const absolute = `${_baseUrl}${url}`;
  if (typeof input === "string") return absolute;
  if (isUrl(input)) return new URL(absolute);
  return new Request(absolute, input as Request);
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

function getStorageValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageValue(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
  }
}

function readMap(key: string): Record<string, string> {
  const raw = getStorageValue(key);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeMap(key: string, value: Record<string, string>): void {
  setStorageValue(key, JSON.stringify(value));
}

function getMagSpotBackendUrl(): string {
  return getStorageValue("apiBackendUrl") || "/api";
}

function buildMagSpotUrl(path: string): string {
  const base = getMagSpotBackendUrl().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/api/") ? path.slice(4) : path;
  if (base.endsWith("/api")) {
    return `${base}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
  }
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function getPathname(url: string): string {
  if (url.startsWith("/")) return url;
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function hashToPositiveInt(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

function parseBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== "string") return {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function getBackendDeviceId(id: number): string {
  return readMap(DEVICE_ID_MAP_KEY)[String(id)] || String(id);
}

function getBackendGroupId(id: number): string {
  return readMap(GROUP_ID_MAP_KEY)[String(id)] || String(id);
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function normalizeDevice(rawValue: unknown, index: number): Record<string, unknown> {
  const raw = getObject(rawValue);
  const backendId = getString(raw.id) ?? getString(raw.device_id) ?? getString(raw.serial) ?? getString(raw.serial_number) ?? getString(raw.ip) ?? `device-${index + 1}`;
  const numericId = getNumber(raw.numericId) ?? getNumber(raw.index) ?? hashToPositiveInt(backendId);
  const rawStatus = getString(raw.status)?.toLowerCase();
  const groupIdString = getString(raw.group_id) ?? getString(raw.groupId);
  return {
    id: numericId,
    backendId,
    magspotId: backendId,
    name: getString(raw.name) ?? getString(raw.device_name) ?? getString(raw.serial) ?? backendId,
    ip: getString(raw.ip) ?? backendId.split(":")[0] ?? backendId,
    status: rawStatus === "busy" ? "busy" : rawStatus === "offline" ? "offline" : rawStatus === "idle" ? "idle" : "online",
    model: getString(raw.model) ?? getString(raw.model_name),
    androidVersion: getString(raw.androidVersion) ?? getString(raw.android_version),
    batteryLevel: getNumber(raw.batteryLevel) ?? getNumber(raw.battery_level),
    groupId: groupIdString ? hashToPositiveInt(groupIdString) : getNumber(raw.groupId) ?? null,
    sheetUrl: getString(raw.sheetUrl) ?? getString(raw.sheet_url) ?? null,
    lastSeen: getString(raw.lastSeen) ?? getString(raw.last_seen) ?? new Date().toISOString(),
    createdAt: getString(raw.createdAt) ?? getString(raw.created_at) ?? new Date().toISOString(),
  };
}

function normalizeDevices(data: unknown): Record<string, unknown>[] {
  const source = getObject(data);
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(source.devices)
      ? source.devices
      : Array.isArray(source.data)
        ? source.data
        : [];
  const devices = rows.map(normalizeDevice);
  writeMap(DEVICE_ID_MAP_KEY, Object.fromEntries(devices.map((device) => [String(device.id), String(device.backendId)])));
  return devices;
}

function normalizeGroup(rawValue: unknown, index: number): Record<string, unknown> {
  const raw = getObject(rawValue);
  const backendId = getString(raw.group_id) ?? getString(raw.id) ?? `group-${index + 1}`;
  const numericId = getNumber(raw.id) ?? hashToPositiveInt(backendId);
  const deviceBackendIds: string[] = Array.isArray(raw.devices)
    ? (raw.devices as unknown[])
        .map((d) => getString(getObject(d).serial_number))
        .filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];
  const deviceCount = deviceBackendIds.length > 0
    ? deviceBackendIds.length
    : Array.isArray(raw.devices)
      ? (raw.devices as unknown[]).length
      : getNumber(raw.deviceCount) ?? 0;
  return {
    id: numericId,
    backendId,
    name: getString(raw.name) ?? backendId,
    description: getString(raw.description) ?? null,
    color: getString(raw.color) ?? null,
    deviceCount,
    deviceBackendIds,
    createdAt: getString(raw.createdAt) ?? getString(raw.created_at) ?? new Date().toISOString(),
  };
}

function normalizeGroups(data: unknown): Record<string, unknown>[] {
  const source = getObject(data);
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(source.groups)
      ? source.groups
      : Array.isArray(source.data)
        ? source.data
        : [];
  const groups = rows.map(normalizeGroup);
  writeMap(GROUP_ID_MAP_KEY, Object.fromEntries(groups.map((group) => [String(group.id), String(group.backendId)])));
  return groups;
}

function getActionCommand(action: unknown): { command: string; args: string[] } {
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

function adaptMagSpotRequest(
  input: RequestInfo | URL,
  init: Omit<CustomFetchOptions, "responseType" | "headers">,
  method: string,
): { input: RequestInfo | URL; init: Omit<CustomFetchOptions, "responseType" | "headers">; method: string; originalPath: string } {
  const url = resolveUrl(input);
  const path = getPathname(url);
  const body = parseBody(init.body);
  const deviceMatch = path.match(/^\/api\/devices\/(\d+)$/);
  const controlMatch = path.match(/^\/api\/devices\/(\d+)\/control$/);
  const groupMatch = path.match(/^\/api\/groups\/(\d+)$/);
  const nextInit = { ...init };
  let nextMethod = method;
  let nextPath = path;

  if (path === "/api/healthz") {
    nextPath = "/api/health_check";
  } else if (path === "/api/devices" && method === "POST") {
    nextPath = "/api/devices/connect";
    const ip = getString(body.ip) ?? getString(body.host) ?? "";
    nextInit.body = JSON.stringify({ host: ip, port: getNumber(body.port) ?? 5555 });
  } else if (path === "/api/devices/scan" && method === "POST") {
    nextPath = "/api/devices/connect-range";
    nextInit.body = JSON.stringify({
      baseSubnet: getString(body.ipRange) ?? getString(body.baseSubnet) ?? "192.168.1",
      startOctet: getNumber(body.startOctet) ?? 1,
      endOctet: getNumber(body.endOctet) ?? 254,
      port: getNumber(body.port) ?? 5555,
    });
  } else if (path === "/api/devices/stats" && method === "GET") {
    nextPath = "/api/devices";
  } else if (deviceMatch && method === "GET") {
    nextPath = "/api/devices";
  } else if (deviceMatch && method === "DELETE") {
    nextPath = "/api/devices/disconnect";
    nextMethod = "POST";
    nextInit.body = JSON.stringify({ id: getBackendDeviceId(Number(deviceMatch[1])) });
  } else if (deviceMatch && method === "PUT") {
    if (body.groupId !== undefined && body.groupId !== null) {
      nextPath = `/api/groups/${getBackendGroupId(Number(body.groupId))}/devices`;
      nextMethod = "POST";
      nextInit.body = JSON.stringify({
        devices: [{ serial_number: getBackendDeviceId(Number(deviceMatch[1])) }],
      });
    } else {
      nextPath = "/api/devices";
      nextMethod = "GET";
      delete nextInit.body;
    }
  } else if (controlMatch && method === "POST") {
    const command = getActionCommand(body.action);
    nextPath = "/api/devices/command";
    nextInit.body = JSON.stringify({
      deviceIds: [getBackendDeviceId(Number(controlMatch[1]))],
      ...command,
    });
  } else if (path === "/api/groups" && method === "POST") {
    nextPath = "/api/groups";
    const groupColor = getString(body.color);
    const groupBody: Record<string, unknown> = { name: getString(body.name) ?? "Group" };
    if (groupColor) groupBody.color = groupColor;
    if (getString(body.description)) groupBody.description = getString(body.description);
    nextInit.body = JSON.stringify(groupBody);
  } else if (groupMatch) {
    nextPath = `/api/groups/${getBackendGroupId(Number(groupMatch[1]))}`;
  }

  const nextInput = nextPath.startsWith("/api") ? buildMagSpotUrl(nextPath) : input;
  return { input: nextInput, init: nextInit, method: nextMethod, originalPath: path };
}

function adaptMagSpotResponse(path: string, method: string, data: unknown): unknown {
  if (path === "/api/devices" || path === "/api/devices/scan") return normalizeDevices(data);
  if (path === "/api/devices/stats") {
    const devices = normalizeDevices(data);
    return {
      total: devices.length,
      online: devices.filter((device) => device.status === "online").length,
      offline: devices.filter((device) => device.status === "offline").length,
      busy: devices.filter((device) => device.status === "busy").length,
      idle: devices.filter((device) => device.status === "idle").length,
      groups: 0,
    };
  }
  if (/^\/api\/devices\/\d+$/.test(path) && method === "GET") {
    const requestedId = Number(path.split("/").pop());
    return normalizeDevices(data).find((device) => device.id === requestedId) ?? normalizeDevices(data)[0] ?? null;
  }
  if (/^\/api\/devices\/\d+$/.test(path) && (method === "PUT" || method === "DELETE")) {
    return normalizeDevices(data)[0] ?? data;
  }
  if (path === "/api/groups") return method === "GET" ? normalizeGroups(data) : normalizeGroup(getObject(data).group ?? data, 0);
  if (/^\/api\/groups\/\d+$/.test(path)) return normalizeGroup(getObject(data).group ?? data, 0);
  return data;
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

function isTextMediaType(mediaType: string | null): boolean {
  return Boolean(
    mediaType &&
      (mediaType.startsWith("text/") ||
        mediaType === "application/xml" ||
        mediaType === "text/xml" ||
        mediaType.endsWith("+xml") ||
        mediaType === "application/x-www-form-urlencoded"),
  );
}

// Use strict equality: in browsers, `response.body` is `null` when the
// response genuinely has no content.  In React Native, `response.body` is
// always `undefined` because the ReadableStream API is not implemented —
// even when the response carries a full payload readable via `.text()` or
// `.json()`.  Loose equality (`== null`) matches both `null` and `undefined`,
// which causes every React Native response to be treated as empty.
function hasNoBody(response: Response, method: string): boolean {
  if (method === "HEAD") return true;
  if (NO_BODY_STATUS.has(response.status)) return true;
  if (response.headers.get("content-length") === "0") return true;
  if (response.body === null) return true;
  return false;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;

  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;

  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }

  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message =
    getStringField(data, "message") ??
    getStringField(data, "error_description") ??
    getStringField(data, "error");

  if (title && detail) return `${prefix}: ${title} — ${detail}`;
  if (detail) return `${prefix}: ${detail}`;
  if (message) return `${prefix}: ${message}`;
  if (title) return `${prefix}: ${title}`;

  return prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(
    response: Response,
    data: T | null,
    requestInfo: { method: string; url: string },
  ) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

export class ResponseParseError extends Error {
  readonly name = "ResponseParseError";
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;
  readonly rawBody: string;
  readonly cause: unknown;

  constructor(
    response: Response,
    rawBody: string,
    cause: unknown,
    requestInfo: { method: string; url: string },
  ) {
    super(
      `Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
        `(${response.status} ${response.statusText}) as JSON`,
    );
    Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;
  }
}

async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  const raw = await response.text();
  const normalized = stripBom(raw);

  if (normalized.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch (cause) {
    throw new ResponseParseError(response, raw, cause, requestInfo);
  }
}

async function parseErrorBody(response: Response, method: string): Promise<unknown> {
  if (hasNoBody(response, method)) {
    return null;
  }

  const mediaType = getMediaType(response.headers);

  // Fall back to text when blob() is unavailable (e.g. some React Native builds).
  if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
    return typeof response.blob === "function" ? response.blob() : response.text();
  }

  const raw = await response.text();
  const normalized = stripBom(raw);
  const trimmed = normalized.trim();

  if (trimmed === "") {
    return null;
  }

  if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
    try {
      return JSON.parse(normalized);
    } catch {
      return raw;
    }
  }

  return raw;
}

function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);

  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

async function parseSuccessBody(
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  if (hasNoBody(response, requestInfo.method)) {
    return null;
  }

  const effectiveType =
    responseType === "auto" ? inferResponseType(response) : responseType;

  switch (effectiveType) {
    case "json":
      return parseJsonBody(response, requestInfo);

    case "text": {
      const text = await response.text();
      return text === "" ? null : text;
    }

    case "blob":
      if (typeof response.blob !== "function") {
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            "Use responseType \"json\" or \"text\" instead.",
        );
      }
      return response.blob();
  }
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  input = applyBaseUrl(input);
  const { responseType = "auto", headers: headersInit, ...init } = options;

  let method = resolveMethod(input, init.method);
  const adaptedRequest = adaptMagSpotRequest(input, init, method);
  input = adaptedRequest.input;
  method = adaptedRequest.method;
  const requestInit = adaptedRequest.init;

  if (requestInit.body != null && (method === "GET" || method === "HEAD")) {
    throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
  }

  const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);

  if (
    typeof requestInit.body === "string" &&
    !headers.has("content-type") &&
    looksLikeJson(requestInit.body)
  ) {
    headers.set("content-type", "application/json");
  }

  if (responseType === "json" && !headers.has("accept")) {
    headers.set("accept", DEFAULT_JSON_ACCEPT);
  }

  // Attach bearer token when an auth getter is configured and no
  // Authorization header has been explicitly provided.
  if (_authTokenGetter && !headers.has("authorization")) {
    const token = await _authTokenGetter();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const sessionToken = getStorageValue("sessionToken");
  if (sessionToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${sessionToken}`);
  }

  const apiKey = getStorageValue("apiKey");
  if (apiKey && !headers.has("x-api-key")) {
    headers.set("x-api-key", apiKey);
  }

  const requestInfo = { method, url: resolveUrl(input) };

  const response = await fetch(input, { ...requestInit, method, headers });

  if (!response.ok) {
    const errorData = await parseErrorBody(response, method);
    throw new ApiError(response, errorData, requestInfo);
  }

  const data = await parseSuccessBody(response, responseType, requestInfo);
  return adaptMagSpotResponse(adaptedRequest.originalPath, method, data) as T;
}
