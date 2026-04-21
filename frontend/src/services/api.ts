// API Service for Backend Communication
// This connects to the main Python backend

// Get configured backend API URL
export function getBackendUrl() {
  return localStorage.getItem('apiBackendUrl') || '/api';
}
const API_BASE = `${getBackendUrl()}`;

// Get API key
const getApiKey = () => localStorage.getItem('apiKey') || '';

// Helper to get headers with API key and auth token if available
const getHeaders = (authToken?: string) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = getApiKey();
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
};

export interface Device {
  id: string;
  ip: string;
  port: number;
  serial: string;
  model: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
  lastSeen: string;
  octet: number;
}

export interface ConnectRequest {
  host: string;
  port?: number;
}

export interface ConnectRangeRequest {
  baseSubnet: string;
  startOctet: number;
  endOctet: number;
  port?: number;
}

export interface CommandRequest {
  deviceIds: string[];
  command: string;
  args?: string[];
}

export interface CommandResult {
  deviceId: string;
  success: boolean;
  output: string;
  error?: string;
}

export interface ScanRequest {
  baseSubnet: string;
  startOctet?: number;
  endOctet?: number;
  concurrency?: number;
}

export interface ActivityField {
  index: number;
  key: string;
  description: string;
  default: any;
  type: string;
  is_required: boolean;
}

export interface Activity {
  name: string;
  endpoint: string;
  method: string;
  args: ActivityField[];
  kwaygs: ActivityField[];
}


// Fetch all connected devices
export async function fetchDevices(authToken?: string): Promise<Device[]> {
  const response = await fetch(`${getBackendUrl()}/devices`, {
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch devices: ${response.statusText}`);
  }
  return response.json();
}

// Connect to a single device by IP
export async function connectDevice(request: ConnectRequest, authToken?: string): Promise<Device> {
  const response = await fetch(`${getBackendUrl()}/devices/connect`, {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'Failed to connect device');
  }
  return response.json();
}

// Connect to a range of devices
export async function connectDeviceRange(request: ConnectRangeRequest, authToken?: string): Promise<Device[]> {
  const response = await fetch(`${getBackendUrl()}/devices/connect-range`, {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'Failed to connect devices');
  }
  return response.json();
}

// Disconnect a device
export async function disconnectDevice(id: string, authToken?: string): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/devices/disconnect`, {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    throw new Error('Failed to disconnect device');
  }
}

// Execute ADB command on selected devices
export async function executeCommand(request: CommandRequest, authToken?: string): Promise<CommandResult[]> {
  const response = await fetch(`${getBackendUrl()}/devices/command`, {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error('Failed to execute command');
  }
  return response.json();
}

// Scan subnet for devices
export async function scanSubnet(request: ScanRequest, authToken?: string): Promise<{ found: number; devices: Device[] }> {
  const response = await fetch(`${getBackendUrl()}/scan`, {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error('Failed to scan subnet');
  }
  return response.json();
}

// Restart ADB server
export async function restartAdb(authToken?: string): Promise<{ success: boolean; message: string; results: Record<string, { success: boolean; output: string; error: string }> }> {
  const response = await fetch(`${getBackendUrl()}/devices/restart-adb`, {
    method: 'POST',
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error('Failed to restart ADB');
  }
  return response.json();
}

// Fetch activities
export async function fetchActivities(authToken?: string): Promise<{ status: string; message: string; data: Record<string, Activity> }> {
  const response = await fetch(`${getBackendUrl()}/get_activities`, {
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch activities');
  }
  return response.json();
}

// Health check for backend API
export async function healthCheck(authToken?: string): Promise<{ status: string; message: string }> {
  const baseUrl = getBackendUrl();
  const response = await fetch(`${baseUrl}/health_check`, {
    method: 'GET',
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json();
}

export interface ApiKey {
  key_id: string;
  life_time: string;
  authorized_endpoints: string;
}

export interface CreateApiKeyRequest {
  user_id: string;
  life_time?: number;
  authorized_endpoints?: string;
}

// Create API key
export async function createApiKey(request: CreateApiKeyRequest, authToken?: string): Promise<{ api_key: string; key_id: string }> {
  const baseUrl = getBackendUrl();
  const response = await fetch(`${baseUrl}/api_keys`, {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error('Failed to create API key');
  }
  return response.json();
}

// List API keys
export async function listApiKeys(userId: string, authToken?: string): Promise<ApiKey[]> {
  const baseUrl = getBackendUrl();
  const response = await fetch(`${baseUrl}/api_keys?user_id=${userId}`, {
    method: 'GET',
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error('Failed to list API keys');
  }
  return response.json();
}

// Delete API key
export async function deleteApiKey(keyId: string, userId: string, authToken?: string): Promise<void> {
  const baseUrl = getBackendUrl();
  const response = await fetch(`${baseUrl}/api_keys/${keyId}?user_id=${userId}`, {
    method: 'DELETE',
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error('Failed to delete API key');
  }
}

export interface TunnelStatus {
  status: string;
  tunnel?: {
    is_tunnel_running?: boolean;
    tunnel_url?: string;
    is_scrcpy_running?: boolean;
    scrcpy_url?: string;
  };
}

// Get tunnel status
export async function getTunnelStatus(authToken?: string): Promise<TunnelStatus> {
  const response = await fetch(`${getBackendUrl()}/get_tunnel_status`, {
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error('Failed to get tunnel status');
  }
  return response.json();
}

// Disconnect all devices
export async function disconnectAllDevices(authToken?: string): Promise<{ status: string; output: string; details: string }> {
  const response = await fetch(`${getBackendUrl()}/disconnect_all_devices`, {
    method: 'POST',
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error('Failed to disconnect all devices');
  }
  return response.json();
}

// Start scrcpy tunnel
export async function startScrcpyTunnel(authToken?: string): Promise<{ status: string; output: string; public_url?: string; local_url?: string }> {
  const response = await fetch(`${getBackendUrl()}/start_scrcpy_tunnel`, {
    method: 'POST',
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error('Failed to start scrcpy tunnel');
  }
  return response.json();
}

// Stop scrcpy tunnel
export async function stopScrcpyTunnel(authToken?: string): Promise<{ status: string; output: string; public_url?: null }> {
  const response = await fetch(`${getBackendUrl()}/stop_scrcpy_tunnel`, {
    method: 'POST',
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error('Failed to stop scrcpy tunnel');
  }
  return response.json();
}

// -----------------------
// GROUPS API ENDPOINTS
// -----------------------

export interface GroupDevice {
  id: string;
  serial_number: string;
  device_name: string;
  model_name: string | null;
}

export interface CreateGroupDevice {
  serial_number: string;
  device_name?: string;
  model_name?: string;
}

export interface DeviceGroup {
  group_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  devices: GroupDevice[];
}

// Create a new group
export async function createGroup(name: string, authToken?: string): Promise<{ message: string; group_id: string }> {
  const response = await fetch(`${getBackendUrl()}/groups`, {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create group' }));
    throw new Error(error.error || 'Failed to create group');
  }
  return response.json();
}

// Get all groups
export async function fetchGroups(authToken?: string): Promise<{ count: number; groups: DeviceGroup[] }> {
  const response = await fetch(`${getBackendUrl()}/groups`, {
    method: 'GET',
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch groups');
  }
  return response.json();
}

// Get a single group
export async function fetchGroup(groupId: string, authToken?: string): Promise<{ group: DeviceGroup }> {
  const response = await fetch(`${getBackendUrl()}/groups/${groupId}`, {
    method: 'GET',
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch group');
  }
  return response.json();
}

// Update a group
export async function updateGroup(groupId: string, name: string, authToken?: string): Promise<{ message: string }> {
  const response = await fetch(`${getBackendUrl()}/groups/${groupId}`, {
    method: 'PUT',
    headers: getHeaders(authToken),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error('Failed to update group');
  }
  return response.json();
}

// Delete a group
export async function deleteGroup(groupId: string, authToken?: string): Promise<{ message: string }> {
  const response = await fetch(`${getBackendUrl()}/groups/${groupId}`, {
    method: 'DELETE',
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error('Failed to delete group');
  }
  return response.json();
}

// Add devices to a group
export async function addDevicesToGroup(groupId: string, devices: CreateGroupDevice[], authToken?: string): Promise<{ message: string; added_count: number; device_ids: string[] }> {
  const response = await fetch(`${getBackendUrl()}/groups/${groupId}/devices`, {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify({ devices }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to add devices' }));
    throw new Error(error.error || 'Failed to add devices to group');
  }
  return response.json();
}

// Remove a device from a group
export async function removeDeviceFromGroup(groupId: string, deviceId: string, authToken?: string): Promise<{ message: string }> {
  const response = await fetch(`${getBackendUrl()}/groups/${groupId}/devices/${deviceId}`, {
    method: 'DELETE',
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error('Failed to remove device from group');
  }
  return response.json();
}

// Clear all devices from a group
export async function clearGroupDevices(groupId: string, authToken?: string): Promise<{ message: string }> {
  const response = await fetch(`${getBackendUrl()}/groups/${groupId}/devices`, {
    method: 'DELETE',
    headers: getHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error('Failed to clear group devices');
  }
  return response.json();
}

