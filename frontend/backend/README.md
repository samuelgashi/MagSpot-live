# ADB Dashboard Backend

A Node.js backend service for managing Android devices over ADB TCP (port 5555).

## Prerequisites

1. **ADB installed and in PATH**
   ```bash
   adb version
   ```

2. **Android devices connected via WiFi ADB**
   ```bash
   # On each device, enable ADB over TCP:
   adb tcpip 5555
   ```

## Installation

```bash
cd backend
npm install
```

## Running

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `SUBNET_BASE` | 192.168.1 | Base subnet for scanning |
| `ADB_PORT` | 5555 | ADB TCP port |
| `CONCURRENCY` | 200 | Max concurrent connections during scan |
| `SCAN_TIMEOUT_MS` | 1000 | TCP connection timeout |

## API Endpoints

### GET /api/devices
List all connected devices.

**Response:**
```json
[
  {
    "id": "192.168.1.5:5555",
    "ip": "192.168.1.5",
    "port": 5555,
    "serial": "ABC123",
    "model": "Pixel 7",
    "status": "online",
    "lastSeen": "2024-01-20T12:00:00Z",
    "octet": 5
  }
]
```

### POST /api/devices/connect
Connect to a single device.

**Request:**
```json
{
  "host": "192.168.1.5",
  "port": 5555
}
```

### POST /api/devices/connect-range
Connect to a range of devices.

**Request:**
```json
{
  "baseSubnet": "192.168.1",
  "startOctet": 1,
  "endOctet": 254,
  "port": 5555
}
```

### POST /api/devices/disconnect
Disconnect a device.

**Request:**
```json
{
  "id": "192.168.1.5:5555"
}
```

### POST /api/devices/command
Execute ADB command on selected devices.

**Request:**
```json
{
  "deviceIds": ["192.168.1.5:5555", "192.168.1.6:5555"],
  "command": "shell",
  "args": ["input", "tap", "500", "500"]
}
```

**Response:**
```json
[
  {
    "deviceId": "192.168.1.5:5555",
    "success": true,
    "output": ""
  },
  {
    "deviceId": "192.168.1.6:5555",
    "success": false,
    "output": "",
    "error": "device offline"
  }
]
```

### POST /api/scan
Scan subnet for responsive devices (TCP port check only, doesn't connect).

**Request:**
```json
{
  "baseSubnet": "192.168.1",
  "startOctet": 1,
  "endOctet": 254,
  "concurrency": 200
}
```

## WebSocket Events

Connect to the same port for real-time updates:

### Server → Client

- `devices:update` - Full device list update
- `device:update` - Single device changed
- `task:progress` - Command execution progress
- `scan:progress` - Subnet scan progress

### Example WebSocket Client

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

socket.on('devices:update', (devices) => {
  console.log('Devices:', devices);
});

socket.on('task:progress', (progress) => {
  console.log('Task progress:', progress);
});
```

## Common ADB Commands

```bash
# Tap screen
shell input tap 500 500

# Swipe
shell input swipe 500 500 500 1000

# Type text
shell input text "hello"

# Press key
shell input keyevent 3   # Home
shell input keyevent 4   # Back
shell input keyevent 26  # Power

# Screenshot (saves to device)
shell screencap /sdcard/screenshot.png

# Get battery info
shell dumpsys battery

# List packages
shell pm list packages

# Start activity
shell am start -n com.package/.MainActivity
```
