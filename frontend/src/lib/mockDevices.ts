import { Device, DeviceStatus } from '@/types/device';

const deviceModels = [
  'Pixel 7 Pro', 'Pixel 6', 'Galaxy S23', 'Galaxy A54', 
  'OnePlus 11', 'Xiaomi 13', 'Redmi Note 12', 'Moto G84',
  'Sony Xperia 5', 'OPPO Find X5', 'Realme GT', 'Nothing Phone 2'
];

const deviceNames = [
  'MagSpot-1', 'MagSpot-2', 'MagSpot-3', 'MagSpot-4', 'MagSpot-5',
  'MagSpot-6', 'MagSpot-7', 'MagSpot-8', 'MagSpot-9', 'MagSpot-10',
  'MagSpot-11', 'MagSpot-12', 'MagSpot-13', 'MagSpot-14', 'MagSpot-15',
  'MagSpot-16', 'MagSpot-17', 'MagSpot-18', 'MagSpot-19', 'MagSpot-20',
  'MagSpot-21', 'MagSpot-22', 'MagSpot-23', 'MagSpot-24', 'MagSpot-25',
  'MagSpot-26', 'MagSpot-27', 'MagSpot-28', 'MagSpot-29', 'MagSpot-30'
];

const statuses: DeviceStatus[] = ['online', 'online', 'online', 'busy', 'offline'];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSerial(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateLastSeen(): string {
  const now = new Date();
  const offset = Math.floor(Math.random() * 3600000); // Random offset up to 1 hour
  return new Date(now.getTime() - offset).toISOString();
}

export function generateMockDevices(baseSubnet: string = '192.168.1', count: number = 30): Device[] {
  const devices: Device[] = [];
  const usedOctets = new Set<number>();
  
  while (devices.length < count) {
    const octet = Math.floor(Math.random() * 254) + 1;
    if (usedOctets.has(octet)) continue;
    usedOctets.add(octet);
    
    const ip = `${baseSubnet}.${octet}`;
    devices.push({
      id: `${ip}:5555`,
      ip,
      port: 5555,
      serial: generateSerial(),
      model: randomElement(deviceModels),
      name: `MagSpot-${devices.length + 1}`,
      status: randomElement(statuses),
      lastSeen: generateLastSeen(),
      octet,
    });
  }
  
  return devices.sort((a, b) => a.octet - b.octet);
}

export function parseOctetRange(input: string): number[] {
  const octets: number[] = [];
  const parts = input.split(',').map(p => p.trim()).filter(Boolean);
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          if (i >= 1 && i <= 254 && !octets.includes(i)) {
            octets.push(i);
          }
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= 254 && !octets.includes(num)) {
        octets.push(num);
      }
    }
  }
  
  return octets.sort((a, b) => a - b);
}
