export type DeviceStatus = 'online' | 'offline' | 'busy';

export interface Device {
  id: string;
  ip: string;
  port: number;
  serial: string;
  model: string;
  name: string;
  status: DeviceStatus;
  lastSeen: string;
  octet: number; // Last octet for easy filtering
}

export interface TaskProgress {
  deviceId: string;
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  output?: string;
}

export interface ScanProgress {
  scanned: number;
  total: number;
  responsive: number;
  elapsed: number;
}
