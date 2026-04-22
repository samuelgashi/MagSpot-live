const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const http = require('http');
const { spawn, spawnSync, execSync } = require('child_process');
const net = require('net');
const path = require('path');
const os = require('os');
const { URL } = require('url');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
const h264StreamWss = new WebSocketServer({ noServer: true });

// Configuration from environment
const PORT = process.env.PORT || 3001;
const SUBNET_BASE = process.env.SUBNET_BASE || '192.168.1';
const ADB_PORT = parseInt(process.env.ADB_PORT) || 5555;
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 200;
const SCAN_TIMEOUT_MS = parseInt(process.env.SCAN_TIMEOUT_MS) || 1000;

app.use(cors());
app.use(express.json());

const frontendDistPath = path.resolve(__dirname, '../dist');
server.on('upgrade', (request, socket, head) => {
  let url;
  try {
    url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  } catch {
    return;
  }
  if (url.pathname !== '/api/devices/scrcpy-stream') return;
  h264StreamWss.handleUpgrade(request, socket, head, (ws) => {
    h264StreamWss.emit('connection', ws, request, url);
  });
});

h264StreamWss.on('connection', (ws, request, url) => {
  const deviceId = url.searchParams.get('deviceId');
  if (!deviceId) {
    ws.close(1008, 'deviceId is required');
    return;
  }
  startScrcpyStyleStream(ws, deviceId, {
    maxSize: url.searchParams.get('maxSize'),
    bitRate: url.searchParams.get('bitRate'),
    maxFps: url.searchParams.get('maxFps')
  });
});

if (require('fs').existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
}

// In-memory device store
let devices = new Map();
let groups = new Map();
let tasks = new Map();
let apiKeys = new Map();
let adbAvailable = true;
let screenStreamHubs = new Map();

// Helper: Extract octet from IP
function getOctet(ip) {
  const parts = ip.split('.');
  return parseInt(parts[3]) || 0;
}

// Helper: Execute ADB command
function adbExec(command) {
  if (!adbAvailable && command !== 'version') {
    return { success: false, output: '', error: 'ADB is not available in this environment' };
  }

  try {
    const args = command.trim().split(/\s+/).filter(Boolean);
    const result = spawnSync('adb', args, {
      encoding: 'utf-8',
      timeout: 30000,
    });

    if (result.error) {
      return { success: false, output: '', error: result.error.message };
    }

    if (result.status !== 0) {
      return { success: false, output: result.stdout?.trim() || '', error: result.stderr?.trim() || `ADB exited with status ${result.status}` };
    }

    return { success: true, output: result.stdout.trim() };
  } catch (error) {
    return { success: false, output: '', error: error.message };
  }
}

// Helper: Execute ADB command on a specific device
function adbDeviceExec(deviceId, command) {
  try {
    const result = execSync(`adb -s ${deviceId} ${command}`, { 
      encoding: 'utf-8',
      timeout: 30000 
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    return { success: false, output: '', error: error.message };
  }
}

function adbDeviceSpawn(deviceId, args, options = {}) {
  try {
    const result = spawnSync('adb', ['-s', deviceId, ...args], {
      encoding: options.encoding === null ? null : 'utf-8',
      timeout: options.timeout || 30000,
      maxBuffer: options.maxBuffer || 10 * 1024 * 1024
    });

    if (result.error) {
      return { success: false, output: null, error: result.error.message };
    }

    if (result.status !== 0) {
      const stderr = result.stderr ? result.stderr.toString().trim() : '';
      return { success: false, output: result.stdout, error: stderr || `ADB exited with status ${result.status}` };
    }

    return { success: true, output: result.stdout, error: '' };
  } catch (error) {
    return { success: false, output: null, error: error.message };
  }
}

function parsePositiveInt(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function clampFps(value, fallback) {
  const fps = Number(value);
  if (!Number.isFinite(fps)) return fallback;
  return Math.max(1, Math.min(30, Math.round(fps)));
}

function captureDeviceScreencap(deviceId, timeout = 12000) {
  return new Promise((resolve) => {
    const child = spawn('adb', ['-s', deviceId, 'exec-out', 'screencap', '-p'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const stdout = [];
    const stderr = [];
    let total = 0;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({ success: false, buffer: null, error: 'Screenshot timed out' });
    }, timeout);

    child.stdout.on('data', (chunk) => {
      total += chunk.length;
      if (total <= 12 * 1024 * 1024) stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ success: false, buffer: null, error: error.message });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ success: false, buffer: null, error: Buffer.concat(stderr).toString().trim() || `ADB exited with status ${code}` });
        return;
      }
      const buffer = Buffer.concat(stdout);
      resolve({ success: buffer.length > 0, buffer, error: buffer.length > 0 ? '' : 'Empty screenshot' });
    });
  });
}

function findH264StartCode(buffer, offset = 0) {
  for (let i = offset; i < buffer.length - 3; i += 1) {
    if (buffer[i] === 0 && buffer[i + 1] === 0) {
      if (buffer[i + 2] === 1) return i;
      if (i < buffer.length - 4 && buffer[i + 2] === 0 && buffer[i + 3] === 1) return i;
    }
  }
  return -1;
}

function streamH264NalUnits(input, onNalUnit) {
  let buffer = Buffer.alloc(0);
  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    let first = findH264StartCode(buffer);
    if (first < 0) {
      if (buffer.length > 2 * 1024 * 1024) buffer = buffer.subarray(buffer.length - 4096);
      return;
    }
    if (first > 0) buffer = buffer.subarray(first);
    let next = findH264StartCode(buffer, first + 3);
    while (next >= 0) {
      const nal = buffer.subarray(0, next);
      if (nal.length > 4) onNalUnit(nal);
      buffer = buffer.subarray(next);
      next = findH264StartCode(buffer, 3);
    }
  };
}

function getScreenrecordSizeArg(deviceId, maxSize) {
  const result = adbDeviceSpawn(deviceId, ['shell', 'wm', 'size'], { timeout: 5000 });
  const output = result.success ? String(result.output || '') : '';
  const match = output.match(/Physical size:\s*(\d+)x(\d+)/i) || output.match(/Override size:\s*(\d+)x(\d+)/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const scaledWidth = Math.max(2, Math.round(width * scale / 2) * 2);
  const scaledHeight = Math.max(2, Math.round(height * scale / 2) * 2);
  return `${scaledWidth}x${scaledHeight}`;
}

function startScrcpyStyleStream(ws, deviceId, options = {}) {
  const maxSize = Math.max(240, Math.min(1440, parsePositiveInt(options.maxSize) || 720));
  const bitRate = Math.max(250000, Math.min(16000000, parsePositiveInt(options.bitRate) || 4000000));
  const maxFps = Math.max(5, Math.min(60, parsePositiveInt(options.maxFps) || 30));
  const sizeArg = getScreenrecordSizeArg(deviceId, maxSize);
  const args = [
    '-s',
    deviceId,
    'exec-out',
    'screenrecord',
    '--output-format=h264',
    `--bit-rate=${bitRate}`,
    '-'
  ];
  if (sizeArg) args.splice(6, 0, `--size=${sizeArg}`);
  const adb = spawn('adb', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let closed = false;
  let lastSentAt = 0;
  const pushNalUnit = streamH264NalUnits(null, (nal) => {
    if (closed || ws.readyState !== WebSocket.OPEN) return;
    const type = nal[(nal[2] === 1 ? 3 : 4)] & 0x1f;
    const now = Date.now();
    if (type === 1 && now - lastSentAt < Math.floor(1000 / maxFps)) return;
    lastSentAt = now;
    ws.send(nal);
  });
  const cleanup = () => {
    if (closed) return;
    closed = true;
    adb.kill('SIGTERM');
    setTimeout(() => {
      if (!adb.killed) adb.kill('SIGKILL');
    }, 1000);
  };

  adb.stdout.on('data', pushNalUnit);
  adb.stderr.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) console.warn(`ADB H264 stream ${deviceId}: ${text}`);
  });
  adb.on('error', (error) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', message: error.message }));
    cleanup();
  });
  adb.on('close', cleanup);
  ws.on('close', cleanup);
  ws.on('error', cleanup);
}

function createScreenStreamHub(deviceId) {
  const hub = {
    deviceId,
    clients: new Set(),
    latestFrame: null,
    running: false
  };

  const stopProcesses = () => {
    hub.running = false;
  };

  const removeClient = (client) => {
    hub.clients.delete(client);
    if (hub.clients.size === 0) {
      stopProcesses();
      screenStreamHubs.delete(deviceId);
    }
  };

  const writeFrame = (client, frame) => {
    if (client.res.destroyed || client.res.writableEnded) {
      removeClient(client);
      return;
    }
    client.res.write(`--${client.boundary}\r\n`);
    client.res.write('Content-Type: image/png\r\n');
    client.res.write(`Content-Length: ${frame.length}\r\n\r\n`);
    client.res.write(frame);
    client.res.write('\r\n');
    client.lastSent = Date.now();
  };

  const broadcastFrame = (frame) => {
    hub.latestFrame = frame;
    const now = Date.now();
    for (const client of Array.from(hub.clients)) {
      if (now - client.lastSent >= client.frameDelay) {
        writeFrame(client, frame);
      }
    }
  };

  const start = () => {
    if (hub.running || hub.clients.size === 0) return;
    hub.running = true;

    const run = async () => {
      while (hub.running && hub.clients.size > 0) {
        const started = Date.now();
        const result = await captureDeviceScreencap(deviceId, 12000);
        if (result.success && result.buffer) {
          broadcastFrame(result.buffer);
        } else if (result.error) {
          console.warn(`screencap ${deviceId}: ${result.error}`);
        }
        const fastestDelay = Math.min(...Array.from(hub.clients).map((client) => client.frameDelay), 1000);
        const waitMs = Math.max(0, fastestDelay - (Date.now() - started));
        if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      hub.running = false;
      if (hub.clients.size === 0) screenStreamHubs.delete(deviceId);
    };

    run();
  };

  hub.addClient = (client) => {
    hub.clients.add(client);
    client.res.on('close', () => removeClient(client));
    if (hub.latestFrame) writeFrame(client, hub.latestFrame);
    start();
  };

  hub.stop = stopProcesses;
  return hub;
}

function getScreenStreamHub(deviceId) {
  let hub = screenStreamHubs.get(deviceId);
  if (!hub) {
    hub = createScreenStreamHub(deviceId);
    screenStreamHubs.set(deviceId, hub);
  }
  return hub;
}

function createTask(deviceId, taskType = 'adb_command') {
  const taskId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const task = {
    task_id: taskId,
    device_id: deviceId,
    status: 'RUNNING',
    progress: 0,
    logs: '',
    task_type: taskType,
    created_at: new Date().toISOString()
  };
  tasks.set(taskId, task);
  return task;
}

function updateTask(taskId, updates) {
  const current = tasks.get(taskId);
  if (!current) return null;
  const next = { ...current, ...updates };
  tasks.set(taskId, next);
  return next;
}

// Helper: Check if port is open (fast TCP check)
function checkPort(host, port, timeout = SCAN_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      resolved = true;
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });
    
    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });
    
    socket.connect(port, host);
  });
}

// Helper: Get device info from ADB
function getDeviceInfo(deviceId) {
  const ip = deviceId.split(':')[0];
  const port = parseInt(deviceId.split(':')[1]) || ADB_PORT;
  
  let model = 'Unknown';
  let serial = 'Unknown';
  
  try {
    const modelResult = adbDeviceExec(deviceId, 'shell getprop ro.product.model');
    if (modelResult.success) model = modelResult.output || 'Unknown';
    
    const serialResult = adbDeviceExec(deviceId, 'shell getprop ro.serialno');
    if (serialResult.success) serial = serialResult.output || deviceId;
  } catch (e) {
    console.error(`Error getting device info for ${deviceId}:`, e.message);
  }
  
  return {
    id: deviceId,
    ip,
    port,
    serial: serial || deviceId,
    model: model || 'Unknown',
    status: 'online',
    lastSeen: new Date().toISOString(),
    octet: getOctet(ip)
  };
}

// Helper: Refresh devices from ADB
function refreshDevices() {
  if (!adbAvailable) {
    io.emit('devices:update', Array.from(devices.values()));
    return;
  }

  const result = adbExec('devices');
  if (!result.success) {
    console.error('Failed to get devices:', result.error);
    return;
  }
  
  const lines = result.output.split('\n').slice(1); // Skip header
  const currentIds = new Set();
  
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && parts[1] === 'device') {
      const deviceId = parts[0];
      currentIds.add(deviceId);
      
      // Only update if not already tracked or update lastSeen
      if (!devices.has(deviceId)) {
        const info = getDeviceInfo(deviceId);
        devices.set(deviceId, info);
        console.log(`Device connected: ${deviceId}`);
      } else {
        // Update lastSeen
        const existing = devices.get(deviceId);
        existing.lastSeen = new Date().toISOString();
        existing.status = 'online';
        devices.set(deviceId, existing);
      }
    }
  }
  
  // Mark disconnected devices as offline
  for (const [id, device] of devices) {
    if (!currentIds.has(id)) {
      device.status = 'offline';
      devices.set(id, device);
    }
  }
  
  io.emit('devices:update', Array.from(devices.values()));
}

// ─── Auth helpers (simple HS256 JWT using Node crypto) ───────────────────────
const crypto = require('crypto');

const AUTH_SECRET = process.env.FLASK_SECRET_KEY || 'a_default_secret_key_if_not_set';
const SESSION_EXPIRE_DAYS = parseInt(process.env.SESSION_EXPIRE_DAYS || '30', 10);
let adminPassword = process.env.ADMIN_PASSWORD || 'admin';

function b64url(str) {
  return Buffer.from(str).toString('base64url');
}

function signJwt(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const expected = crypto.createHmac('sha256', AUTH_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) {
    const payload = verifyJwt(auth.slice(7));
    if (!payload) return res.status(401).json({ error: 'Invalid or expired session token' });
    req.userId = payload.user_id || payload.sub;
    return next();
  }
  const apiKey = req.headers['x-api-key'] || req.headers['X-API-KEY'] || req.query.api_key;
  if (apiKey) {
    req.userId = 'admin';
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
  if (username.trim() !== 'admin' || password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({ user_id: 'admin', sub: 'admin', type: 'session', iat: now, exp: now + SESSION_EXPIRE_DAYS * 86400 });
  res.json({ token, user_id: 'admin' });
});

// ── POST /api/auth/change_password ───────────────────────────────────────────
app.post('/api/auth/change_password', authMiddleware, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password are required' });
  if (current_password !== adminPassword) return res.status(401).json({ error: 'Current password is incorrect' });
  if (new_password.length < 4) return res.status(400).json({ error: 'New password must be at least 4 characters' });
  adminPassword = new_password;
  res.json({ message: 'Password changed successfully' });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user_id: req.userId });
});

// API Routes

app.get('/api/health_check', (req, res) => {
  res.json({ status: 'ok', message: 'Service is healthy' });
});

app.get('/api/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/system/resources', (req, res) => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const load = os.loadavg()[0] || 0;
  const cpuCount = os.cpus().length || 1;
  res.json({
    status: 'ok',
    data: {
      cpu: {
        percent: Math.min(100, Math.round((load / cpuCount) * 100)),
        loadAverage: os.loadavg(),
        cores: cpuCount,
      },
      ram: {
        percent: Math.round((usedMemory / totalMemory) * 100),
        used: usedMemory,
        total: totalMemory,
      },
      containers: [],
    },
  });
});

app.get('/api/tasks', (req, res) => {
  res.json({ tasks: Array.from(tasks.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
});

app.get('/api/tasks/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

app.post('/api/tasks/:taskId/stop', (req, res) => {
  const existing = tasks.get(req.params.taskId);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  updateTask(req.params.taskId, { status: 'STOPPED', progress: 100, logs: `${existing.logs || ''}\nTask stopped by user.`.trim() });
  res.json({ message: 'Task stopped', task_id: req.params.taskId });
});

app.post('/api/tasks/stop-all', (req, res) => {
  let count = 0;
  for (const [taskId, task] of tasks.entries()) {
    if (['RUNNING', 'IN_PROGRESS', 'PENDING', 'QUEUED', 'BUSY'].includes(String(task.status).toUpperCase())) {
      updateTask(taskId, { status: 'STOPPED', progress: 100, logs: `${task.logs || ''}\nTask stopped by user.`.trim() });
      count += 1;
    }
  }
  res.json({ message: `Stopped ${count} task(s)` });
});

app.delete('/api/tasks', (req, res) => {
  const count = tasks.size;
  tasks.clear();
  res.json({ message: `Cleared ${count} task(s)` });
});

app.get('/api/api_keys', (req, res) => {
  res.json(Array.from(apiKeys.values()));
});

app.post('/api/api_keys', (req, res) => {
  const lifeTimeDays = Number(req.body.life_time || 24);
  const keyId = `key_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const apiKey = `magspot_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const expires = new Date(Date.now() + Math.max(1, lifeTimeDays) * 24 * 60 * 60 * 1000).toISOString();
  apiKeys.set(keyId, {
    key_id: keyId,
    life_time: expires,
    authorized_endpoints: req.body.authorized_endpoints || '*'
  });
  res.json({ api_key: apiKey, key_id: keyId });
});

app.delete('/api/api_keys/:keyId', (req, res) => {
  apiKeys.delete(req.params.keyId);
  res.json({ message: 'API key deleted' });
});

app.post('/api/disconnect_all_devices', (req, res) => {
  const result = adbExec('disconnect');
  for (const [id, device] of devices.entries()) {
    device.status = 'offline';
    devices.set(id, device);
    io.emit('device:update', device);
  }
  res.json({
    status: result.success ? 'success' : 'error',
    output: result.output || result.error,
    details: result.success ? 'All ADB devices disconnected' : result.error
  });
});

app.get('/api/get_tunnel_status', (req, res) => {
  res.json({
    status: 'success',
    tunnel: {
      is_tunnel_running: true,
      tunnel_url: process.env.MAGSPOT_TUNNEL_URL || 'magician_device_101.bgnodes.com',
      is_scrcpy_running: false,
      scrcpy_url: ''
    }
  });
});

app.post('/api/start_scrcpy_tunnel', (req, res) => {
  res.json({
    status: 'success',
    output: 'Tunnel is managed by the running workflow.',
    public_url: process.env.MAGSPOT_TUNNEL_URL || 'magician_device_101.bgnodes.com',
    local_url: 'localhost:5555'
  });
});

app.post('/api/stop_scrcpy_tunnel', (req, res) => {
  res.json({
    status: 'success',
    output: 'Tunnel stop requested. The development workflow may restart it automatically.',
    public_url: null
  });
});

app.get('/api/devices/screenshot', (req, res) => {
  const deviceId = req.query.deviceId;
  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ message: 'deviceId is required' });
  }

  const result = adbDeviceSpawn(deviceId, ['exec-out', 'screencap', '-p'], { encoding: null, timeout: 15000 });
  if (!result.success || !result.output || result.output.length === 0) {
    return res.status(500).json({ message: result.error || 'Failed to capture screenshot' });
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.send(result.output);
});

app.get('/api/devices/stream', (req, res) => {
  const deviceId = req.query.deviceId;
  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ message: 'deviceId is required' });
  }

  const fps = clampFps(req.query.fps, 8);
  const frameDelay = Math.round(1000 / fps);
  const boundary = 'magspotframe';

  res.writeHead(200, {
    'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Connection': 'close',
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  getScreenStreamHub(deviceId).addClient({
    res,
    boundary,
    frameDelay,
    lastSent: 0
  });
});

app.get('/api/devices/screen-info', (req, res) => {
  const deviceId = req.query.deviceId;
  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ message: 'deviceId is required' });
  }

  const result = adbDeviceSpawn(deviceId, ['shell', 'wm', 'size'], { timeout: 10000 });
  const output = result.success ? String(result.output || '') : '';
  const match = output.match(/Physical size:\s*(\d+)x(\d+)/i) || output.match(/Override size:\s*(\d+)x(\d+)/i);
  if (!match) {
    return res.json({ width: null, height: null, raw: output || result.error || '' });
  }
  res.json({ width: Number(match[1]), height: Number(match[2]), raw: output });
});

app.post('/api/devices/live-control', (req, res) => {
  const { deviceId, type } = req.body || {};
  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ message: 'deviceId is required' });
  }

  const x = parsePositiveInt(req.body.x);
  const y = parsePositiveInt(req.body.y);
  const x2 = parsePositiveInt(req.body.x2);
  const y2 = parsePositiveInt(req.body.y2);
  const duration = Math.max(50, Math.min(2000, parsePositiveInt(req.body.duration) || 250));

  if (type === 'tap') {
    if (x === null || y === null) return res.status(400).json({ message: 'x and y are required for tap' });
    const result = adbDeviceSpawn(deviceId, ['shell', 'input', 'tap', String(x), String(y)], { timeout: 10000 });
    if (!result.success) return res.status(500).json({ message: result.error || 'Tap failed' });
    return res.json({ success: true });
  }

  if (type === 'swipe') {
    if (x === null || y === null || x2 === null || y2 === null) {
      return res.status(400).json({ message: 'x, y, x2 and y2 are required for swipe' });
    }
    const result = adbDeviceSpawn(deviceId, ['shell', 'input', 'swipe', String(x), String(y), String(x2), String(y2), String(duration)], { timeout: 10000 });
    if (!result.success) return res.status(500).json({ message: result.error || 'Swipe failed' });
    return res.json({ success: true });
  }

  res.status(400).json({ message: 'type must be tap or swipe' });
});

// GET /api/devices - List all devices
app.get('/api/devices', (req, res) => {
  refreshDevices();
  res.json(Array.from(devices.values()));
});

app.get('/api/groups', (req, res) => {
  const groupList = Array.from(groups.values());
  res.json({ count: groupList.length, groups: groupList });
});

app.post('/api/groups', (req, res) => {
  const name = req.body?.name;
  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  const groupId = `group-${Date.now()}`;
  const group = {
    group_id: groupId,
    name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    devices: [],
  };
  groups.set(groupId, group);
  res.status(201).json({ message: 'Group created successfully', group_id: groupId, group });
});

app.put('/api/groups/:groupId', (req, res) => {
  const group = groups.get(req.params.groupId);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  group.name = req.body?.name || group.name;
  group.updated_at = new Date().toISOString();
  groups.set(req.params.groupId, group);
  res.json({ message: 'Group updated successfully', group });
});

app.delete('/api/groups/:groupId', (req, res) => {
  const groupId = req.params.groupId;
  if (!groups.delete(groupId)) {
    return res.status(404).json({ error: 'Group not found' });
  }
  for (const [deviceId, device] of devices.entries()) {
    if (device.group_id === groupId || device.groupId === groupId) {
      delete device.group_id;
      device.groupId = null;
      devices.set(deviceId, device);
    }
  }
  io.emit('devices:update', Array.from(devices.values()));
  res.json({ message: 'Group deleted successfully' });
});

app.post('/api/groups/:groupId/devices', (req, res) => {
  const groupId = req.params.groupId;
  const group = groups.get(groupId);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  const incomingDevices = Array.isArray(req.body?.devices) ? req.body.devices : [];
  const added = [];
  for (const item of incomingDevices) {
    const serialNumber = item.serial_number || item.serial || item.id || item.device_id;
    if (!serialNumber) continue;
    for (const [otherGroupId, otherGroup] of groups.entries()) {
      otherGroup.devices = otherGroup.devices.filter((device) => device.serial_number !== serialNumber);
      groups.set(otherGroupId, otherGroup);
    }
    const existing = group.devices.find((device) => device.serial_number === serialNumber);
    const device = existing || {
      id: `${groupId}-${serialNumber}`,
      serial_number: serialNumber,
      device_name: item.device_name || serialNumber,
      model_name: item.model_name || null,
    };
    if (!existing) {
      group.devices.push(device);
      added.push(device.id);
    }
    if (devices.has(serialNumber)) {
      const storedDevice = devices.get(serialNumber);
      storedDevice.group_id = groupId;
      storedDevice.groupId = groupId;
      devices.set(serialNumber, storedDevice);
      io.emit('device:update', storedDevice);
    }
  }
  group.updated_at = new Date().toISOString();
  groups.set(groupId, group);
  io.emit('devices:update', Array.from(devices.values()));
  res.status(201).json({ message: 'Devices added successfully', added_count: added.length, device_ids: added, group });
});

// POST /api/devices/connect - Connect to a single device
app.post('/api/devices/connect', async (req, res) => {
  const { host, port = ADB_PORT } = req.body;
  
  if (!host) {
    return res.status(400).json({ message: 'Host is required' });
  }
  
  console.log(`Connecting to ${host}:${port}...`);
  
  // First check if port is open
  const isOpen = await checkPort(host, port);
  if (!isOpen) {
    return res.status(400).json({ message: `Cannot reach ${host}:${port}` });
  }
  
  // Connect via ADB
  const result = adbExec(`connect ${host}:${port}`);
  if (!result.success || result.output.includes('failed')) {
    return res.status(400).json({ message: result.output || 'Connection failed' });
  }
  
  // Get device info
  setTimeout(() => {
    const deviceId = `${host}:${port}`;
    const info = getDeviceInfo(deviceId);
    devices.set(deviceId, info);
    io.emit('device:update', info);
    res.json(info);
  }, 500);
});

// POST /api/devices/connect-range - Connect to a range of devices
app.post('/api/devices/connect-range', async (req, res) => {
  const { baseSubnet, startOctet, endOctet, port = ADB_PORT } = req.body;
  
  if (!baseSubnet || !startOctet || !endOctet) {
    return res.status(400).json({ message: 'baseSubnet, startOctet, and endOctet are required' });
  }
  
  console.log(`Scanning ${baseSubnet}.${startOctet}-${endOctet}:${port}...`);
  
  const connectedDevices = [];
  const promises = [];
  
  // Create batches based on concurrency
  for (let octet = startOctet; octet <= endOctet; octet++) {
    const host = `${baseSubnet}.${octet}`;
    
    promises.push(
      (async () => {
        const isOpen = await checkPort(host, port);
        if (isOpen) {
          const result = adbExec(`connect ${host}:${port}`);
          if (result.success && !result.output.includes('failed')) {
            return { host, port, octet };
          }
        }
        return null;
      })()
    );
    
    // Process in batches
    if (promises.length >= CONCURRENCY) {
      const batch = await Promise.all(promises);
      for (const item of batch) {
        if (item) {
          const deviceId = `${item.host}:${item.port}`;
          const info = getDeviceInfo(deviceId);
          devices.set(deviceId, info);
          connectedDevices.push(info);
        }
      }
      promises.length = 0;
    }
  }
  
  // Process remaining
  if (promises.length > 0) {
    const batch = await Promise.all(promises);
    for (const item of batch) {
      if (item) {
        const deviceId = `${item.host}:${item.port}`;
        const info = getDeviceInfo(deviceId);
        devices.set(deviceId, info);
        connectedDevices.push(info);
      }
    }
  }
  
  io.emit('devices:update', Array.from(devices.values()));
  res.json(connectedDevices);
});

// POST /api/devices/disconnect - Disconnect a device
app.post('/api/devices/disconnect', (req, res) => {
  const { id } = req.body;
  
  if (!id) {
    return res.status(400).json({ message: 'Device ID is required' });
  }
  
  const result = adbExec(`disconnect ${id}`);
  if (result.success) {
    if (devices.has(id)) {
      const device = devices.get(id);
      device.status = 'offline';
      devices.set(id, device);
      io.emit('device:update', device);
    }
    res.json({ success: true });
  } else {
    res.status(400).json({ message: result.error });
  }
});

// POST /api/devices/command - Execute ADB command on devices
app.post('/api/devices/command', async (req, res) => {
  const { deviceIds, command, args = [] } = req.body;
  
  if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return res.status(400).json({ message: 'deviceIds array is required' });
  }
  
  if (!command) {
    return res.status(400).json({ message: 'command is required' });
  }
  
  const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
  console.log(`Executing on ${deviceIds.length} devices: ${fullCommand}`);
  
  const results = [];
  
  // Execute in parallel with concurrency limit
  const executeOnDevice = async (deviceId) => {
    const task = createTask(deviceId, 'adb_command');
    // Mark device as busy
    if (devices.has(deviceId)) {
      const device = devices.get(deviceId);
      device.status = 'busy';
      devices.set(deviceId, device);
      io.emit('device:update', device);
    }
    
    const result = adbDeviceExec(deviceId, fullCommand);
    updateTask(task.task_id, {
      status: result.success ? 'COMPLETED' : 'FAILED',
      progress: 100,
      logs: result.output || result.error || ''
    });
    
    // Mark device back as online
    if (devices.has(deviceId)) {
      const device = devices.get(deviceId);
      device.status = 'online';
      device.lastSeen = new Date().toISOString();
      devices.set(deviceId, device);
      io.emit('device:update', device);
    }
    
    io.emit('task:progress', {
      id: deviceId,
      taskId: task.task_id,
      status: result.success ? 'completed' : 'failed',
      output: result.output || result.error
    });
    
    return {
      deviceId,
      taskId: task.task_id,
      success: result.success,
      output: result.output,
      error: result.error
    };
  };
  
  // Process all devices
  const promises = deviceIds.map(id => executeOnDevice(id));
  const allResults = await Promise.all(promises);
  
  res.json(allResults);
});

// POST /api/scan - Scan subnet for devices
app.post('/api/scan', async (req, res) => {
  const { 
    baseSubnet = SUBNET_BASE, 
    startOctet = 1, 
    endOctet = 254, 
    concurrency = CONCURRENCY 
  } = req.body;
  
  console.log(`Scanning ${baseSubnet}.${startOctet}-${endOctet}...`);
  
  const found = [];
  let scanned = 0;
  const total = endOctet - startOctet + 1;
  
  // Create all promises
  const scanPromises = [];
  for (let octet = startOctet; octet <= endOctet; octet++) {
    const host = `${baseSubnet}.${octet}`;
    scanPromises.push(
      checkPort(host, ADB_PORT).then(isOpen => {
        scanned++;
        io.emit('scan:progress', { scanned, total, found: found.length });
        return isOpen ? { host, octet } : null;
      })
    );
  }
  
  // Process in batches
  const batchSize = concurrency;
  for (let i = 0; i < scanPromises.length; i += batchSize) {
    const batch = scanPromises.slice(i, i + batchSize);
    const results = await Promise.all(batch);
    
    for (const result of results) {
      if (result) {
        found.push(result);
      }
    }
  }
  
  res.json({ 
    found: found.length, 
    devices: found.map(f => ({ ip: f.host, port: ADB_PORT, octet: f.octet }))
  });
});

if (require('fs').existsSync(frontendDistPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current devices on connect
  socket.emit('devices:update', Array.from(devices.values()));
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initial device refresh
console.log('Starting ADB Dashboard Backend...');
console.log(`Configuration: PORT=${PORT}, SUBNET_BASE=${SUBNET_BASE}, CONCURRENCY=${CONCURRENCY}`);

// Verify ADB is available
const adbVersion = adbExec('version');
if (adbVersion.success) {
  console.log('ADB available:', adbVersion.output.split('\n')[0]);
} else {
  adbAvailable = false;
  console.warn('ADB not available in this Replit environment. Device features will show empty data until ADB is configured.');
}

// Start server
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /api/devices          - List devices');
  console.log('  POST /api/devices/connect  - Connect to device');
  console.log('  POST /api/devices/connect-range - Connect to range');
  console.log('  POST /api/devices/disconnect - Disconnect device');
  console.log('  POST /api/devices/command  - Execute ADB command');
  console.log('  POST /api/scan             - Scan subnet');
  
  // Initial refresh
  refreshDevices();
  
  // Periodic refresh every 10 seconds
  setInterval(refreshDevices, 10000);
});
