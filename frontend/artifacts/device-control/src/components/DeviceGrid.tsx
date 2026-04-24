import React, { useRef, useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Device, Group } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, Copy, Home, Info, Keyboard, Lock, Pencil, RotateCw, Save, Send, Volume1, Volume2, X, Wifi } from "lucide-react";
import { useLang } from "../lib/lang";
import { DEVICE_REGISTRY_CHANGE_EVENT, DEVICE_REGISTRY_STORAGE_KEY, emptyRecord, safeLoadDeviceModels, safeLoadRecords, saveDeviceModels, DeviceRegistryRecord } from "./DeviceRegistryPanel";
import { CountryOption, countryFlag, matchCountries } from "@/lib/countries";
import { loadSavedScheduleResult, SavedScheduleResult } from "@/lib/scheduleResults";
import { getDevicePlanIndicator, getPlanIndicatorStyle } from "@/lib/devicePlanIndicator";
import { postMagSpotStartScrcpyServer, getMagSpotDeviceWsImageStreamUrl, getMagSpotDeviceScrcpyStreamUrl, getMagSpotDeviceStreamUrl, postMagSpotDeviceAction, postMagSpotLiveControlToDevices, postMagSpotSyncCommand, getMagSpotDeviceName, getMagSpotDeviceBackendId, buildMagSpotApiUrl, getMagSpotHeaders } from "@/lib/magspotApi";
import { BROWSER_KEYCODE_MAP, keyMetaState, isPrintableKey } from "@/lib/androidKeycodes";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { isUsbDevice, deviceStatusColor } from "@/lib/deviceUtils";

const ACCENT = "#00d4e8";
const ACCENT_RGB = "0,212,232";
const ORIGIN_ACCENT = "#a855f7";
const ORIGIN_ACCENT_RGB = "168,85,247";
const DRAG_THRESHOLD = 6; // px before rubber-band activates
const DOUBLE_CLICK_WINDOW_MS = 240;
const PHONE_ASPECT_HEIGHT_OVER_WIDTH = 1024 / 509;

function useDeviceNames(devices: { id: number; ip?: string; [key: string]: unknown }[]): Record<number, string> {
  const [names, setNames] = React.useState<Record<number, string>>({});
  const fetchedRef = React.useRef<Set<number>>(new Set());
  const idsKey = devices.map((d) => d.id).join(",");
  React.useEffect(() => {
    devices.forEach((device) => {
      if (fetchedRef.current.has(device.id)) return;
      fetchedRef.current.add(device.id);
      const deviceId = getMagSpotDeviceBackendId(device as Parameters<typeof getMagSpotDeviceBackendId>[0]);
      const url = buildMagSpotApiUrl(`/api/devices/device-name?device_id=${encodeURIComponent(deviceId)}`);
      fetch(url, { headers: getMagSpotHeaders() })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.device_name) {
            setNames((prev) => ({ ...prev, [device.id]: data.device_name }));
          }
        })
        .catch(() => {});
    });
  }, [idsKey]);
  return names;
}

function getNalHeaderOffset(data: Uint8Array) {
  return data[2] === 1 ? 3 : 4;
}

function getNalType(data: Uint8Array) {
  return data[getNalHeaderOffset(data)] & 0x1f;
}

function getSpsCodec(data: Uint8Array) {
  const offset = getNalHeaderOffset(data) + 1;
  if (data.length < offset + 3) return "avc1.42E01E";
  return `avc1.${[data[offset], data[offset + 1], data[offset + 2]].map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join("")}`;
}

function concatNalUnits(units: Uint8Array[]) {
  const length = units.reduce((sum, unit) => sum + unit.byteLength, 0);
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const unit of units) {
    combined.set(unit, offset);
    offset += unit.byteLength;
  }
  return combined;
}

function useMagSpotScrcpyVideo(device: Device, enabled: boolean, maxFps: number, maxSize: number, bitRate: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [connected, setConnected] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || typeof VideoDecoder !== "function") {
      setConnected(false);
      setFailed(false);
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;
    let decoder: VideoDecoder | null = null;
    let fallbackTimer: number | null = null;
    let configured = false;
    let gotKeyFrame = false;
    let timestamp = 0;
    let sps: Uint8Array | null = null;
    let pps: Uint8Array | null = null;
    let hasDecodedFrame = false;

    const start = async () => {
      try {
        setConnected(false);
        setFailed(false);
        const context = canvasRef.current?.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas unavailable");
        decoder = new VideoDecoder({
          output: (frame) => {
            if (cancelled || !canvasRef.current) {
              frame.close();
              return;
            }
            if (canvasRef.current.width !== frame.displayWidth || canvasRef.current.height !== frame.displayHeight) {
              canvasRef.current.width = frame.displayWidth;
              canvasRef.current.height = frame.displayHeight;
            }
            context.drawImage(frame, 0, 0, canvasRef.current.width, canvasRef.current.height);
            frame.close();
            hasDecodedFrame = true;
            setConnected(true);
            setFailed(false);
          },
          error: () => {
            if (!cancelled) {
              setConnected(false);
              setFailed(true);
            }
          },
        });
        socket = new WebSocket(getMagSpotDeviceScrcpyStreamUrl(device, maxFps, maxSize, bitRate));
        socket.binaryType = "arraybuffer";
        fallbackTimer = window.setTimeout(() => {
          if (!cancelled && !hasDecodedFrame) setFailed(true);
        }, 5000);
        socket.onmessage = (event) => {
          if (cancelled || !decoder || !(event.data instanceof ArrayBuffer)) return;
          const data = new Uint8Array(event.data);
          const type = getNalType(data);
          if (type === 7) {
            sps = data;
            if (!configured) {
              decoder.configure({ codec: getSpsCodec(data), optimizeForLatency: true });
              configured = true;
            }
            return;
          }
          if (type === 8) {
            pps = data;
            return;
          }
          if (!configured || decoder.state !== "configured") return;
          const keyFrame = type === 5;
          if (keyFrame) gotKeyFrame = true;
          if (!gotKeyFrame) return;
          const chunkData = keyFrame && sps && pps ? concatNalUnits([sps, pps, data]) : data;
          decoder.decode(new EncodedVideoChunk({
            type: keyFrame ? "key" : "delta",
            timestamp,
            data: chunkData,
          }));
          timestamp += Math.round(1_000_000 / maxFps);
        };
        socket.onerror = () => {
          if (!cancelled) setFailed(true);
        };
        socket.onclose = () => {
          if (!cancelled) {
            setConnected(false);
            setFailed(true);
          }
        };
      } catch {
        if (!cancelled) {
          setConnected(false);
          setFailed(true);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      if (socket) socket.close();
      if (decoder && decoder.state !== "closed") decoder.close();
      setConnected(false);
    };
  }, [device.id, device.ip, enabled, maxFps, maxSize, bitRate]);

  return { canvasRef, connected, failed };
}

function useMagSpotWsImageStream(device: Device, enabled: boolean, maxSize = 540, quality = 70) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [connected, setConnected] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      setFailed(false);
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;
    let hasFrame = false;
    let fallbackTimer: number | null = null;

    socket = new WebSocket(getMagSpotDeviceWsImageStreamUrl(device, maxSize, quality));
    socket.binaryType = "arraybuffer";

    fallbackTimer = window.setTimeout(() => {
      if (!cancelled && !hasFrame) setFailed(true);
    }, 8000);

    socket.onmessage = async (event) => {
      if (cancelled || !canvasRef.current || !(event.data instanceof ArrayBuffer)) return;
      try {
        const blob = new Blob([event.data], { type: "image/jpeg" });
        const bitmap = await createImageBitmap(blob);
        if (cancelled || !canvasRef.current) { bitmap.close(); return; }
        const ctx = canvasRef.current.getContext("2d", { alpha: false });
        if (!ctx) { bitmap.close(); return; }
        if (canvasRef.current.width !== bitmap.width || canvasRef.current.height !== bitmap.height) {
          canvasRef.current.width = bitmap.width;
          canvasRef.current.height = bitmap.height;
        }
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        if (!hasFrame) {
          hasFrame = true;
          if (fallbackTimer !== null) { window.clearTimeout(fallbackTimer); fallbackTimer = null; }
          setConnected(true);
          setFailed(false);
        }
      } catch { /* ignore decode errors */ }
    };
    socket.onerror = () => { if (!cancelled) setFailed(true); };
    socket.onclose = () => { if (!cancelled) { setConnected(false); setFailed(true); } };

    return () => {
      cancelled = true;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      if (socket) socket.close();
      setConnected(false);
    };
  }, [device.id, device.ip, enabled, maxSize, quality]);

  return { canvasRef, connected, failed };
}

// ── helpers ──────────────────────────────────────────────────────────────────
// ws-scrcpy initial-handshake magic bytes: "scrcpy_initial"
const SCRCPY_INITIAL_MAGIC = new TextEncoder().encode("scrcpy_initial");

/**
 * Build a TYPE_CHANGE_STREAM_PARAMETERS (101) control message.
 *
 * Wire layout (matches ws-scrcpy VideoSettings.toBuffer() + 1-byte type prefix):
 *   1  type=101
 *   4  bitrate      BE int32
 *   4  maxFps       BE int32
 *   1  iFrameInterval  int8
 *   2  bounds width BE int16  (0 = unconstrained)
 *   2  bounds height BE int16
 *   2  crop left  BE int16
 *   2  crop top   BE int16
 *   2  crop right  BE int16
 *   2  crop bottom BE int16
 *   1  sendFrameMeta  int8
 *   1  lockedVideoOrientation int8  (-1 = unlocked)
 *   4  displayId   BE int32
 *   4  codecOptionsLength BE int32 [+ N bytes UTF-8]
 *   4  encoderNameLength  BE int32 [+ M bytes UTF-8]
 */
function buildVideoSettingsMsg(
  maxSize: number,
  bitRate: number,
  maxFps: number,
  iFrameInterval = 2,
  encoderName = "",
): ArrayBuffer {
  const enc = encoderName ? new TextEncoder().encode(encoderName) : null;
  const base = 36; // 1 type + 35 VideoSettings base
  const buf = new DataView(new ArrayBuffer(base + (enc ? enc.length : 0)));
  let o = 0;
  buf.setUint8(o, 101); o += 1;                          // TYPE_CHANGE_STREAM_PARAMETERS
  buf.setInt32(o, bitRate, false); o += 4;               // bitrate
  buf.setInt32(o, maxFps, false); o += 4;                // maxFps
  buf.setInt8(o, iFrameInterval); o += 1;                // iFrameInterval
  buf.setInt16(o, maxSize, false); o += 2;               // bounds width
  buf.setInt16(o, maxSize, false); o += 2;               // bounds height
  buf.setInt16(o, 0, false); o += 2;                     // crop left
  buf.setInt16(o, 0, false); o += 2;                     // crop top
  buf.setInt16(o, 0, false); o += 2;                     // crop right
  buf.setInt16(o, 0, false); o += 2;                     // crop bottom
  buf.setInt8(o, 0); o += 1;                             // sendFrameMeta = false
  buf.setInt8(o, -1); o += 1;                            // lockedVideoOrientation = -1
  buf.setInt32(o, 0, false); o += 4;                     // displayId = 0
  buf.setInt32(o, 0, false); o += 4;                     // codecOptionsLength = 0
  if (enc && enc.length > 0) {
    buf.setInt32(o, enc.length, false); o += 4;          // encoderNameLength
    enc.forEach((b, i) => buf.setUint8(o + i, b));
  } else {
    buf.setInt32(o, 0, false);                           // encoderNameLength = 0
  }
  return buf.buffer;
}

// ── scrcpy stream quality presets ────────────────────────────────────────────
//
// Encoder names — pick the one that matches your device SoC.
// Scrcpy falls back to the auto-selected encoder if the name is not found.
//
//  Qualcomm Snapdragon (S8/S9+/S10 US, Z Flip/Fold US):
//    "OMX.qcom.video.encoder.avc"        ← current choice (HW, very fast)
//    "c2.qti.avc.encoder"                ← Codec2 Qualcomm (Android 10+)
//
//  Samsung Exynos (S8/S9+/S10 EU/KR/global):
//    "OMX.Exynos.AVC.Encoder"            ← Exynos HW encoder
//    "c2.exynos.avc.encoder"             ← Codec2 Exynos (Android 10+)
//
//  MediaTek Dimensity / Helio:
//    "OMX.MTK.VIDEO.ENCODER.AVC"
//    "c2.mtk.avc.encoder"
//
//  Generic software fallback (any device, highest CPU cost, worst latency):
//    "OMX.google.h264.encoder"
//    "c2.android.avc.encoder"
//
//  Leave empty ("") to let the device auto-select the best available encoder.
//
// Set a specific encoder name only if you know it exists on your devices.
// Wrong name → scrcpy server exits → no stream. Leave empty to auto-select.
const SCRCPY_ENCODER = "";
//
// Stream quality — tweak here to trade resolution/bitrate for latency.
// At 300 devices these numbers matter: 420p @ 1 Mbps keeps bandwidth tight.
const SCRCPY_MAX_SIZE      = 420;        // max dimension in px  (420 ≈ 420p)
const SCRCPY_BITRATE       = 1_000_000; // bits/s  — 1 Mbps is plenty at 420p
const SCRCPY_FPS           = 30;
const SCRCPY_IFRAME_SECS   = 1;         // I-frame every 1 s → fast decoder lock-on

// ── Android motion / key constants (from scrcpy ControlMessage + KeyEvent) ────
const A_DOWN   = 0;   // MotionEvent ACTION_DOWN
const A_UP     = 1;   // MotionEvent ACTION_UP
const A_MOVE   = 2;   // MotionEvent ACTION_MOVE
const A_CANCEL = 3;   // MotionEvent ACTION_CANCEL
const BTN_PRIMARY = 1; // MotionEvent BUTTON_PRIMARY

// KeyEvent action constants
const KEY_DOWN = 0;
const KEY_UP   = 1;


/** Build a 29-byte TYPE_TOUCH control message */
function buildTouchMsg(
  action: number, pointerId: number,
  x: number, y: number, screenW: number, screenH: number,
  pressure: number, buttons: number,
): ArrayBuffer {
  const v = new DataView(new ArrayBuffer(29));
  let o = 0;
  v.setUint8(o, 2); o++;                          // type = TYPE_TOUCH (2)
  v.setUint8(o, action); o++;                     // action
  v.setUint32(o, 0, false); o += 4;               // pointerId high 32 bits = 0
  v.setUint32(o, pointerId >>> 0, false); o += 4; // pointerId low 32 bits
  v.setUint32(o, x >>> 0, false); o += 4;         // x
  v.setUint32(o, y >>> 0, false); o += 4;         // y
  v.setUint16(o, screenW, false); o += 2;         // screenWidth
  v.setUint16(o, screenH, false); o += 2;         // screenHeight
  v.setUint16(o, Math.round(Math.max(0, Math.min(1, pressure)) * 0xffff), false); o += 2; // pressure
  v.setUint32(o, buttons, false);                 // buttons
  return v.buffer;
}

/** Build a 21-byte TYPE_SCROLL control message */
function buildScrollMsg(
  x: number, y: number, screenW: number, screenH: number,
  hScroll: number, vScroll: number,
): ArrayBuffer {
  const v = new DataView(new ArrayBuffer(21));
  let o = 0;
  v.setUint8(o, 3); o++;               // type = TYPE_SCROLL (3)
  v.setUint32(o, x >>> 0, false); o += 4;
  v.setUint32(o, y >>> 0, false); o += 4;
  v.setUint16(o, screenW, false); o += 2;
  v.setUint16(o, screenH, false); o += 2;
  v.setInt32(o, hScroll, false); o += 4;
  v.setInt32(o, vScroll, false);
  return v.buffer;
}

/** Build a 14-byte TYPE_KEYCODE control message */
function buildKeyMsg(action: number, keycode: number, repeat: number, metaState: number): ArrayBuffer {
  const v = new DataView(new ArrayBuffer(14));
  let o = 0;
  v.setInt8(o, 0); o++;              // type = TYPE_KEYCODE (0)
  v.setInt8(o, action); o++;         // action
  v.setInt32(o, keycode, false); o += 4;
  v.setInt32(o, repeat, false); o += 4;
  v.setInt32(o, metaState, false);
  return v.buffer;
}


/** Locate next Annex-B start code: returns [position, startCodeLength] or [-1, 0] */
function findAnnexBStartCode(data: Uint8Array, from: number): [number, number] {
  const lim = data.length - 3;
  for (let i = from; i <= lim; i++) {
    if (data[i] === 0 && data[i + 1] === 0) {
      if (i < lim && data[i + 2] === 0 && data[i + 3] === 1) return [i, 4];
      if (data[i + 2] === 1) return [i, 3];
    }
  }
  return [-1, 0];
}

/**
 * Connect directly to a ws-scrcpy server running on the Android device.
 * Calls POST /api/devices/start-scrcpy-server first to push + start the jar,
 * then opens ws://DEVICE_IP:8886, skips the initial handshake message,
 * sends VideoSettings, and feeds the H264 Annex-B stream to WebCodecs.
 */
function useScrcpyDirectVideo(
  device: Device,
  enabled: boolean,
  maxFps = 30,
  maxSize = 720,
  bitRate = 2_000_000,
  iFrameInterval = 2,
  encoderName = "",
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [failed, setFailed] = useState(false);

  const sendControl = useCallback((data: ArrayBuffer) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
  }, []);

  useEffect(() => {
    if (!enabled || typeof VideoDecoder !== "function") {
      setConnected(false);
      setFailed(false);
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;
    let decoder: VideoDecoder | null = null;
    let fallbackTimer: number | null = null;

    // WebCodecs decoder state
    let configured = false;
    let gotKeyFrame = false;
    let timestamp = 0;
    let sps: Uint8Array | null = null;
    let pps: Uint8Array | null = null;
    let hasDecodedFrame = false;
    let initialMsgReceived = false;

    // Annex-B NAL splitter state
    let pendingBuf = new Uint8Array(0);

    const concat = (a: Uint8Array, b: Uint8Array) => {
      const c = new Uint8Array(a.length + b.length);
      c.set(a);
      c.set(b, a.length);
      return c;
    };

    const feedNal = (nal: Uint8Array) => {
      if (!decoder) return;
      const headerOff = getNalHeaderOffset(nal);
      const type = nal[headerOff] & 0x1f;
      if (type === 7) {
        sps = nal;
        if (!configured) {
          try {
            decoder.configure({ codec: getSpsCodec(nal), optimizeForLatency: true });
            configured = true;
          } catch { /* unsupported codec — will fail gracefully */ }
        }
        return;
      }
      if (type === 8) { pps = nal; return; }
      if (!configured || decoder.state !== "configured") return;
      const isKey = type === 5;
      if (isKey) gotKeyFrame = true;
      if (!gotKeyFrame) return;
      const chunkData = isKey && sps && pps ? concatNalUnits([sps, pps, nal]) : nal;
      try {
        decoder.decode(new EncodedVideoChunk({ type: isKey ? "key" : "delta", timestamp, data: chunkData }));
      } catch { /* ignore decode errors */ }
      timestamp += Math.round(1_000_000 / maxFps);
    };

    const processChunk = (chunk: Uint8Array) => {
      pendingBuf = concat(pendingBuf, chunk);

      // Discard bytes before first start code
      if (pendingBuf.length < 4) return;
      const [firstPos] = findAnnexBStartCode(pendingBuf, 0);
      if (firstPos < 0) return;
      if (firstPos > 0) pendingBuf = pendingBuf.slice(firstPos);

      // Extract complete NAL units
      while (pendingBuf.length >= 4) {
        const scLen = (pendingBuf[2] === 1) ? 3 : 4;
        const [nextPos] = findAnnexBStartCode(pendingBuf, scLen);
        if (nextPos < 0) break; // Incomplete — wait for more data
        const nal = pendingBuf.slice(0, nextPos);
        pendingBuf = pendingBuf.slice(nextPos);
        feedNal(nal);
      }
    };

    const start = async () => {
      try {
        setConnected(false);
        setFailed(false);
        const context = canvasRef.current?.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas unavailable");

        decoder = new VideoDecoder({
          output: (frame) => {
            if (cancelled || !canvasRef.current) { frame.close(); return; }
            if (canvasRef.current.width !== frame.displayWidth || canvasRef.current.height !== frame.displayHeight) {
              canvasRef.current.width = frame.displayWidth;
              canvasRef.current.height = frame.displayHeight;
            }
            context.drawImage(frame, 0, 0, canvasRef.current.width, canvasRef.current.height);
            frame.close();
            if (!hasDecodedFrame) {
              hasDecodedFrame = true;
              if (fallbackTimer !== null) { window.clearTimeout(fallbackTimer); fallbackTimer = null; }
              setConnected(true);
              setFailed(false);
            }
          },
          error: () => { if (!cancelled) { setConnected(false); setFailed(true); } },
        });

        // Ask backend to push the jar and start the scrcpy-server on the device
        const { wsUrl } = await postMagSpotStartScrcpyServer(device);
        if (cancelled) return;

        fallbackTimer = window.setTimeout(() => {
          if (!cancelled && !hasDecodedFrame) setFailed(true);
        }, 12_000);

        socket = new WebSocket(wsUrl);
        socket.binaryType = "arraybuffer";
        socketRef.current = socket;

        socket.onmessage = (event) => {
          if (cancelled || !decoder || !(event.data instanceof ArrayBuffer)) return;
          const data = new Uint8Array(event.data);

          // First message is the scrcpy handshake — skip it and send VideoSettings
          if (!initialMsgReceived) {
            initialMsgReceived = true;
            const magic = data.slice(0, SCRCPY_INITIAL_MAGIC.length);
            if (SCRCPY_INITIAL_MAGIC.every((b, i) => magic[i] === b)) {
              // Send VideoSettings to configure resolution, bitrate, fps
              if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(buildVideoSettingsMsg(maxSize, bitRate, maxFps, iFrameInterval, encoderName));
              }
              return;
            }
            // If first message wasn't the initial handshake, process it as video
          }

          processChunk(data);
        };

        socket.onerror = () => { if (!cancelled) setFailed(true); };
        socket.onclose = () => { if (!cancelled) { setConnected(false); setFailed(true); } };
      } catch {
        if (!cancelled) { setConnected(false); setFailed(true); }
      }
    };

    void start();

    return () => {
      cancelled = true;
      socketRef.current = null;
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      if (socket) socket.close();
      if (decoder && decoder.state !== "closed") decoder.close();
      setConnected(false);
    };
  }, [device.id, device.ip, enabled, maxFps, maxSize, bitRate, iFrameInterval, encoderName]);

  return { canvasRef, connected, failed, sendControl };
}

export interface FocusedDevice {
  device: Device;
  displayNum: number;
}

interface DeviceGridProps {
  sortedDevices: Device[];
  filteredDevices: Device[];
  columns: number;
  isLoading: boolean;
  selectedDeviceIds: number[];
  onToggleDevice: (id: number) => void;
  onSetSelection: (ids: number[]) => void;
  onClearSelection: () => void;
  groups: Group[];
  onAddToGroup: (groupId: number, deviceId?: number) => void;
  smallScreenEnabled: boolean;
  syncControlEnabled: boolean;
  streamEnabled: boolean;
  focusedDeviceId: number | null;
  onOpenFocusedDevice: (focusedDevice: FocusedDevice) => void;
}

export function DeviceGrid({
  sortedDevices,
  filteredDevices,
  columns,
  isLoading,
  selectedDeviceIds,
  onToggleDevice,
  onSetSelection,
  onClearSelection,
  groups,
  onAddToGroup,
  smallScreenEnabled,
  syncControlEnabled,
  streamEnabled,
  focusedDeviceId,
  onOpenFocusedDevice,
}: DeviceGridProps) {
  const { t } = useLang();
  const gridRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [registryVersion, setRegistryVersion] = useState(0);
  const deviceNames = useDeviceNames(sortedDevices);

  const dragStartRef = useRef<{ x: number; y: number; device: Device; displayNum: number } | null>(null);
  const isDragActiveRef = useRef(false);
  const pendingBarClickRef = useRef<{ deviceId: number; timer: number } | null>(null);

  // Keep latest callbacks and state in refs — document listeners never need re-attachment
  const onSetSelectionRef = useRef(onSetSelection);
  onSetSelectionRef.current = onSetSelection;
  const onClearSelectionRef = useRef(onClearSelection);
  onClearSelectionRef.current = onClearSelection;
  const selectedDeviceIdsRef = useRef(selectedDeviceIds);
  selectedDeviceIdsRef.current = selectedDeviceIds;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const syncRegistry = () => setRegistryVersion((version) => version + 1);
    window.addEventListener("storage", syncRegistry);
    window.addEventListener(DEVICE_REGISTRY_CHANGE_EVENT, syncRegistry);
    return () => {
      window.removeEventListener("storage", syncRegistry);
      window.removeEventListener(DEVICE_REGISTRY_CHANGE_EVENT, syncRegistry);
    };
  }, []);

  const cancelPendingBarClick = useCallback(() => {
    if (pendingBarClickRef.current) {
      window.clearTimeout(pendingBarClickRef.current.timer);
      pendingBarClickRef.current = null;
    }
  }, []);

  const toggleDeviceSelection = useCallback((deviceId: number) => {
    const current = selectedDeviceIdsRef.current;
    if (current.includes(deviceId)) {
      onSetSelectionRef.current(current.filter((id) => id !== deviceId));
    } else {
      onSetSelectionRef.current([...current, deviceId]);
    }
  }, []);

  // Clears all data-drag-hover attributes from the grid
  const clearDragHighlights = () => {
    gridRef.current
      ?.querySelectorAll<HTMLElement>("[data-drag-hover]")
      .forEach((el) => el.removeAttribute("data-drag-hover"));
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      if (!isDragActiveRef.current) {
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          isDragActiveRef.current = true;
          cancelPendingBarClick();
          // Clear old selection as soon as drag begins, so rubber-band starts fresh
          onClearSelectionRef.current();
          if (overlayRef.current) overlayRef.current.style.display = "block";
        } else {
          return;
        }
      }

      // Update overlay rect
      const x1 = dragStartRef.current.x;
      const y1 = dragStartRef.current.y;
      const x2 = e.clientX;
      const y2 = e.clientY;
      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      const right = Math.max(x1, x2);
      const bottom = Math.max(y1, y2);

      if (overlayRef.current) {
        overlayRef.current.style.left = `${left}px`;
        overlayRef.current.style.top = `${top}px`;
        overlayRef.current.style.width = `${right - left}px`;
        overlayRef.current.style.height = `${bottom - top}px`;
      }

      // ── Live highlight cards that intersect the drag rect ──
      if (gridRef.current) {
        const cards = gridRef.current.querySelectorAll<HTMLElement>("[data-device-id]");
        cards.forEach((card) => {
          const r = card.getBoundingClientRect();
          const hits = r.left < right && r.right > left && r.top < bottom && r.bottom > top;
          if (hits) {
            card.setAttribute("data-drag-hover", "true");
          } else {
            card.removeAttribute("data-drag-hover");
          }
        });
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!dragStartRef.current) return;

      // Clear live highlights
      clearDragHighlights();

      if (isDragActiveRef.current) {
        // Rubber-band: replace selection with all intersecting cards
        const x1 = Math.min(dragStartRef.current.x, e.clientX);
        const y1 = Math.min(dragStartRef.current.y, e.clientY);
        const x2 = Math.max(dragStartRef.current.x, e.clientX);
        const y2 = Math.max(dragStartRef.current.y, e.clientY);

        const ids: number[] = [];
        gridRef.current?.querySelectorAll<HTMLElement>("[data-device-id]").forEach((card) => {
          const r = card.getBoundingClientRect();
          if (r.left < x2 && r.right > x1 && r.top < y2 && r.bottom > y1) {
            ids.push(Number(card.getAttribute("data-device-id")));
          }
        });
        onSetSelectionRef.current(ids);
      } else {
        const clickTarget = dragStartRef.current;
        const current = selectedDeviceIdsRef.current;
        if (current.includes(clickTarget.device.id)) {
          onSetSelectionRef.current(current.filter((id) => id !== clickTarget.device.id));
        } else {
          onSetSelectionRef.current([...current, clickTarget.device.id]);
        }
      }

      dragStartRef.current = null;
      isDragActiveRef.current = false;
      if (overlayRef.current) {
        overlayRef.current.style.display = "none";
        overlayRef.current.style.width = "0";
        overlayRef.current.style.height = "0";
      }
    };

    // Clean up if the user drags the mouse out of the browser window
    const onBlur = () => {
      if (!dragStartRef.current) return;
      cancelPendingBarClick();
      clearDragHighlights();
      dragStartRef.current = null;
      isDragActiveRef.current = false;
      if (overlayRef.current) {
        overlayRef.current.style.display = "none";
        overlayRef.current.style.width = "0";
        overlayRef.current.style.height = "0";
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    window.addEventListener("blur", onBlur);
    return () => {
      cancelPendingBarClick();
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [cancelPendingBarClick, toggleDeviceSelection]);

  const handleBarMouseDown = useCallback((e: React.MouseEvent, device: Device, displayNum: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    // Just record the start — selection is handled entirely in mouseup
    dragStartRef.current = { x: e.clientX, y: e.clientY, device, displayNum };
    isDragActiveRef.current = false;
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "rgba(255,255,255,0.3)" }}>
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (filteredDevices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "rgba(255,255,255,0.2)" }}>
        <Wifi className="w-10 h-10" />
        <span className="text-sm">No devices found</span>
      </div>
    );
  }

  const savedSchedule = loadSavedScheduleResult();

  return (
    <>
      {/* Rubber-band selection rectangle — fixed, pointer-events none, hidden until drag */}
      <div
        ref={overlayRef}
        style={{
          display: "none",
          position: "fixed",
          pointerEvents: "none",
          border: `1px solid rgba(${ACCENT_RGB},0.65)`,
          background: `rgba(${ACCENT_RGB},0.06)`,
          borderRadius: "4px",
          zIndex: 9999,
        }}
      />

      <div
        ref={gridRef}
        data-registry-version={registryVersion}
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {filteredDevices.map((device) => {
          const displayNum = sortedDevices.indexOf(device) + 1;
          const isSelected = selectedDeviceIds.includes(device.id);
          const isFocusedOrigin = focusedDeviceId === device.id;
          return (
            <DeviceCard
              key={device.id}
              device={device}
              displayNum={displayNum}
              deviceName={deviceNames[device.id] ?? (device as { name?: string }).name ?? ""}
              isSelected={isSelected}
              isFocusedOrigin={isFocusedOrigin}
              onCardMouseDown={(e) => handleBarMouseDown(e, device, displayNum)}
              compact={columns >= 10}
              groups={groups}
              selectedDeviceIds={selectedDeviceIds}
              onAddToGroup={onAddToGroup}
              onClearSelection={onClearSelection}
              onOpenFocusedDevice={onOpenFocusedDevice}
              smallScreenEnabled={smallScreenEnabled}
              syncControlEnabled={syncControlEnabled}
              streamEnabled={streamEnabled}
              controlDevices={syncControlEnabled && selectedDeviceIds.length > 0 ? filteredDevices.filter(d => selectedDeviceIds.includes(d.id)) : [device]}
              now={now}
              savedSchedule={savedSchedule}
              t={t}
            />
          );
        })}
      </div>
    </>
  );
}

function DeviceCard({
  device,
  displayNum,
  deviceName,
  isSelected,
  isFocusedOrigin,
  onCardMouseDown,
  compact,
  groups,
  selectedDeviceIds,
  onAddToGroup,
  onClearSelection,
  onOpenFocusedDevice,
  smallScreenEnabled,
  syncControlEnabled,
  streamEnabled,
  controlDevices,
  now,
  savedSchedule,
  t,
}: {
  device: Device;
  displayNum: number;
  deviceName: string;
  isSelected: boolean;
  isFocusedOrigin: boolean;
  onCardMouseDown: (e: React.MouseEvent) => void;
  compact: boolean;
  groups: Group[];
  selectedDeviceIds: number[];
  onAddToGroup: (groupId: number, deviceId?: number) => void;
  onClearSelection: () => void;
  onOpenFocusedDevice: (focusedDevice: FocusedDevice) => void;
  smallScreenEnabled: boolean;
  syncControlEnabled: boolean;
  streamEnabled: boolean;
  controlDevices: Device[];
  now: Date;
  savedSchedule: SavedScheduleResult | null;
  t: ReturnType<typeof useLang>["t"];
}) {
  const planIndicator = getPlanIndicatorStyle(getDevicePlanIndicator(device.id, savedSchedule, now));
  const [controlError, setControlError] = useState<string | null>(null);
  const dashboardPointerRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const [localStreamEnabled, setLocalStreamEnabled] = useState(false);
  const shouldStream = (streamEnabled || localStreamEnabled) && !isFocusedOrigin;
  const dashboardStream = useScrcpyDirectVideo(device, shouldStream, SCRCPY_FPS, SCRCPY_MAX_SIZE, SCRCPY_BITRATE, SCRCPY_IFRAME_SECS, SCRCPY_ENCODER);

  const connectRealtimeDisplay = useCallback(() => {
    if (shouldStream) {
      // Already streaming — restart by briefly disabling
      setLocalStreamEnabled(false);
      setTimeout(() => setLocalStreamEnabled(true), 80);
    } else {
      setLocalStreamEnabled(true);
    }
  }, [shouldStream]);
  const registryRecord = safeLoadRecords()[String(device.id)];
  const deviceModel = registryRecord?.deviceModel?.trim() ?? "";
  const countryBadge = registryRecord?.vpnCountryCode
    ? `${registryRecord.vpnCountryFlag ? `${registryRecord.vpnCountryFlag} ` : ""}${registryRecord.vpnCountryCode}`
    : "";

  const contextCount = selectedDeviceIds.length;

  const getDashboardPoint = useCallback((event: React.PointerEvent | PointerEvent) => {
    const canvas = dashboardStream.canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return null;
    const rect = canvas.getBoundingClientRect();
    const naturalAspect = canvas.width / canvas.height;
    const renderedAspect = rect.width / rect.height;
    let drawWidth = rect.width;
    let drawHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;
    if (renderedAspect > naturalAspect) {
      drawWidth = rect.height * naturalAspect;
      offsetX = (rect.width - drawWidth) / 2;
    } else {
      drawHeight = rect.width / naturalAspect;
      offsetY = (rect.height - drawHeight) / 2;
    }
    const localX = event.clientX - rect.left - offsetX;
    const localY = event.clientY - rect.top - offsetY;
    if (localX < 0 || localY < 0 || localX > drawWidth || localY > drawHeight) return null;
    return {
      x: Math.round((localX / drawWidth) * canvas.width),
      y: Math.round((localY / drawHeight) * canvas.height),
    };
  }, [dashboardStream.canvasRef]);

  const handleDashboardPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!smallScreenEnabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getDashboardPoint(event);
    if (!point) return;
    dashboardPointerRef.current = { ...point, at: Date.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
    const canvas = dashboardStream.canvasRef.current;
    if (!canvas || !canvas.width) return;
    dashboardStream.sendControl(buildTouchMsg(A_DOWN, event.pointerId, point.x, point.y, canvas.width, canvas.height, event.pressure || 1, BTN_PRIMARY));
  }, [getDashboardPoint, smallScreenEnabled, dashboardStream]);

  const handleDashboardPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!smallScreenEnabled || !dashboardPointerRef.current) return;
    const point = getDashboardPoint(event);
    if (!point) return;
    const canvas = dashboardStream.canvasRef.current;
    if (!canvas || !canvas.width) return;
    dashboardStream.sendControl(buildTouchMsg(A_MOVE, event.pointerId, point.x, point.y, canvas.width, canvas.height, event.pressure || 1, BTN_PRIMARY));
  }, [getDashboardPoint, smallScreenEnabled, dashboardStream]);

  const handleDashboardPointerUp = useCallback(async (event: React.PointerEvent<HTMLDivElement>) => {
    if (!smallScreenEnabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = dashboardPointerRef.current;
    dashboardPointerRef.current = null;
    const end = getDashboardPoint(event);
    const canvas = dashboardStream.canvasRef.current;
    if (end && canvas && canvas.width) {
      dashboardStream.sendControl(buildTouchMsg(A_UP, event.pointerId, end.x, end.y, canvas.width, canvas.height, 0, BTN_PRIMARY));
    }
    if (!start || !end) return;
    // For group sync: send to extra devices via API (current device already handled above)
    const otherDevices = controlDevices.filter((d) => d.id !== device.id);
    if (otherDevices.length > 0) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const sw = canvas?.width  || undefined;
      const sh = canvas?.height || undefined;
      try {
        if (distance < 12) {
          await postMagSpotLiveControlToDevices(otherDevices, { type: "tap", x: end.x, y: end.y, streamW: sw, streamH: sh });
        } else {
          await postMagSpotLiveControlToDevices(otherDevices, { type: "swipe", x: start.x, y: start.y, x2: end.x, y2: end.y, duration: Date.now() - start.at, streamW: sw, streamH: sh });
        }
      } catch { /* ignore */ }
    }
    setControlError(null);
  }, [controlDevices, device.id, getDashboardPoint, smallScreenEnabled, dashboardStream]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* data-device-id is used by rubber-band intersection check */}
        <div
          data-device-id={device.id}
          onMouseDown={onCardMouseDown}
          onDoubleClick={() => onOpenFocusedDevice({ device, displayNum })}
          className={cn(
            "glass-card flex flex-col w-full relative overflow-hidden select-none",
            isSelected && "selected",
            isFocusedOrigin && "focus-origin"
          )}
          style={{
            aspectRatio: `1 / ${PHONE_ASPECT_HEIGHT_OVER_WIDTH}`,
            borderRadius: "clamp(5px, 8%, 16px)",
          }}
        >
          {/* Top shine */}
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)" }}
          />

          {/* ── PROTECTED BAR ── */}
          <div
            className="shrink-0 flex items-center justify-between cursor-pointer px-2.5"
            style={{
              height: compact ? "20px" : "28px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              background: isFocusedOrigin
                ? `rgba(${ORIGIN_ACCENT_RGB},0.14)`
                : isSelected
                ? `rgba(${ACCENT_RGB},0.09)`
                : "rgba(255,255,255,0.035)",
              userSelect: "none",
            }}
          >
            {/* IP last octet */}
            <span
              className="font-mono font-bold leading-none shrink-0"
              style={{
                fontSize: compact ? "9px" : "11px",
                color: isFocusedOrigin ? ORIGIN_ACCENT : isSelected ? ACCENT : "rgba(255,255,255,0.85)",
                minWidth: "2ch",
                textAlign: "right",
              }}
            >
              {isUsbDevice(device) ? (device.ip ?? "USB").split(":")[0].slice(0, 4) : (device.ip ?? "").split(":")[0].split(".").pop() ?? "—"}
            </span>

            {!compact && (
              <span
                className="font-sans leading-none truncate flex-1 text-center mx-1"
                style={{ fontSize: "10px", fontWeight: 600, color: "rgba(148,163,184,0.75)" }}
              >
                {deviceName || deviceModel || ""}
              </span>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              {countryBadge && (
                <span
                  className="font-mono leading-none px-1.5 py-0.5 rounded"
                  style={{
                    fontSize: compact ? "9px" : "10px",
                    color: "rgba(255,255,255,0.82)",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {countryBadge}
                </span>
              )}
              {(() => {
                const isIdle = planIndicator.bg === "rgba(148,163,184,0.58)";
                const dotColor = isIdle ? deviceStatusColor(device) : planIndicator.bg;
                const dotGlow = isIdle ? `${deviceStatusColor(device)}55` : planIndicator.glow;
                return (
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: dotColor, boxShadow: `0 0 5px ${dotGlow}` }}
                  />
                );
              })()}
            </div>
          </div>

          {/* ── PHONE DISPLAY AREA ── */}
          <div
            onPointerDown={handleDashboardPointerDown}
            onPointerMove={handleDashboardPointerMove}
            onPointerUp={handleDashboardPointerUp}
            onPointerCancel={(e) => {
              const canvas = dashboardStream.canvasRef.current;
              if (dashboardPointerRef.current && canvas && canvas.width) {
                const pt = dashboardPointerRef.current;
                dashboardStream.sendControl(buildTouchMsg(A_CANCEL, e.pointerId, pt.x, pt.y, canvas.width, canvas.height, 0, 0));
              }
              dashboardPointerRef.current = null;
            }}
            className="flex-1 relative overflow-hidden"
            style={{ cursor: smallScreenEnabled ? "crosshair" : "default", background: "#05070c", touchAction: smallScreenEnabled ? "none" : "auto" }}
          >
            {isFocusedOrigin ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                <div className="w-2 h-2 rounded-full" style={{ background: ORIGIN_ACCENT, boxShadow: `0 0 8px ${ORIGIN_ACCENT}` }} />
                <span className="text-[8px] font-mono tracking-widest uppercase" style={{ color: ORIGIN_ACCENT, opacity: 0.85 }}>
                  Connected
                </span>
              </div>
            ) : shouldStream ? (
              <>
                <canvas
                  ref={dashboardStream.canvasRef}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ opacity: dashboardStream.connected ? 1 : 0 }}
                />
                {!dashboardStream.connected && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[8px] font-mono tracking-widest" style={{ color: `rgba(${ACCENT_RGB},0.35)` }}>
                      {dashboardStream.failed ? "NO STREAM" : "CONNECTING…"}
                    </span>
                  </div>
                )}
                {!smallScreenEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: "rgba(0,0,0,0.18)" }}>
                    <span className="text-[8px] font-mono tracking-widest" style={{ color: `rgba(${ACCENT_RGB},0.35)` }}>
                      TOUCH OFF
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[8px] font-mono tracking-widest" style={{ color: `rgba(${ACCENT_RGB},0.22)` }}>
                  DISPLAY OFF
                </span>
              </div>
            )}
            {smallScreenEnabled && isSelected && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ boxShadow: `inset 0 0 24px rgba(${ACCENT_RGB},0.18)` }}
              />
            )}
          </div>


          {/* Selected left accent bar */}
          {(isSelected || isFocusedOrigin) && (
            <div
              className="absolute left-0 inset-y-0 w-0.5"
              style={{ background: `linear-gradient(180deg, transparent, ${isFocusedOrigin ? ORIGIN_ACCENT : ACCENT}, transparent)` }}
            />
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent
        className="w-52"
        style={{
          background: "rgba(15,18,28,0.96)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
        }}
      >
        <div className="px-2 py-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          {contextCount > 0 ? (
            <span className="text-[11px] font-medium">{t.devicesSelected(contextCount)}</span>
          ) : (
            <>
              <div className="text-[11px] font-semibold tracking-wide" style={{ color: "rgba(255,255,255,0.75)" }}>
                DEVICE: {deviceName || deviceModel || device.ip}
              </div>
              <div className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                IP: {device.ip}
              </div>
            </>
          )}
        </div>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-sm text-white/80 focus:bg-white/10 focus:text-white cursor-pointer flex items-center gap-2"
          onClick={connectRealtimeDisplay}
        >
          <Wifi className="w-3.5 h-3.5 shrink-0" style={{ color: "#00d4e8" }} />
          Connect Display
        </ContextMenuItem>
        {shouldStream && (
          <ContextMenuItem
            className="text-sm cursor-pointer flex items-center gap-2 focus:bg-white/10"
            style={{ color: "rgba(239,68,68,0.85)" }}
            onClick={() => setLocalStreamEnabled(false)}
          >
            <Wifi className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(239,68,68,0.75)" }} />
            Disconnect Display
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger className="text-sm text-white/80 focus:bg-white/10 focus:text-white">
            {t.moveToGroup}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent
            className="min-w-[160px]"
            style={{
              background: "rgba(15,18,28,0.96)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
            }}
          >
            {groups.length === 0 ? (
              <div className="px-2 py-2 text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                {t.noGroups}
              </div>
            ) : (
              groups.map((group) => (
                <ContextMenuItem
                  key={group.id}
                  className="text-sm text-white/80 focus:bg-white/10 focus:text-white cursor-pointer"
                  onClick={() => onAddToGroup(group.id, device.id)}
                >
                  <span
                    className="w-2 h-2 rounded-full mr-2 shrink-0 inline-block"
                    style={{ backgroundColor: group.color || ACCENT }}
                  />
                  {group.name}
                </ContextMenuItem>
              ))
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-sm focus:bg-white/10 cursor-pointer"
          style={{ color: "rgba(255,255,255,0.5)" }}
          onClick={onClearSelection}
        >
          {t.clearSelection}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function DeviceFocusModal({
  device,
  displayNum,
  onClose,
  controlDevices,
  syncControlEnabled,
  streamEnabled,
}: {
  device: Device;
  displayNum: number;
  onClose: () => void;
  controlDevices: Device[];
  syncControlEnabled: boolean;
  streamEnabled?: boolean;
}) {
  const { t } = useLang();
  const [infoOpen, setInfoOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardText, setKeyboardText] = useState("");
  const keyboardInputRef = useRef<HTMLInputElement>(null);
  const [registryRecords, setRegistryRecords] = useState(() => safeLoadRecords());
  const [actionState, setActionState] = useState<{ action: string; status: "running" | "ok" | "error" } | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const modalStreamEnabled = streamEnabled !== false;
  const focusedStream = useScrcpyDirectVideo(device, modalStreamEnabled, SCRCPY_FPS, SCRCPY_MAX_SIZE, SCRCPY_BITRATE, SCRCPY_IFRAME_SECS, SCRCPY_ENCODER);
  const modalDeviceNames = useDeviceNames([device]);
  const adbDeviceName = modalDeviceNames[device.id] ?? (device as { name?: string }).name ?? "";
  const [now, setNow] = useState(() => new Date());
  const [position, setPosition] = useState(() => ({
    x: Math.max(24, Math.round(window.innerWidth / 2 - 170)),
    y: Math.max(24, Math.round(window.innerHeight / 2 - 340)),
  }));
  const [size, setSize] = useState(() => ({
    width: 340,
    height: Math.round(340 * PHONE_ASPECT_HEIGHT_OVER_WIDTH),
  }));
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; originWidth: number; originHeight: number } | null>(null);
  const pointerRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const savedSchedule = loadSavedScheduleResult();
  const planIndicator = getPlanIndicatorStyle(getDevicePlanIndicator(device.id, savedSchedule, now));
  const registryRecord = registryRecords[String(device.id)] ?? emptyRecord(String(displayNum).padStart(3, "0"));
  const hasRegistryData = Object.entries(registryRecord).some(([key, value]) => key !== "deviceNumber" && value.trim().length > 0);
  const deviceModel = registryRecord.deviceModel?.trim() ?? "";
  const countryBadge = registryRecord.vpnCountryCode
    ? `${registryRecord.vpnCountryFlag ? `${registryRecord.vpnCountryFlag} ` : ""}${registryRecord.vpnCountryCode}`
    : "";
  const saveRegistryRecord = useCallback((record: DeviceRegistryRecord) => {
    setRegistryRecords((current) => {
      const next = {
        ...current,
        [String(device.id)]: record,
      };
      window.localStorage.setItem(DEVICE_REGISTRY_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(DEVICE_REGISTRY_CHANGE_EVENT));
      return next;
    });
  }, [device.id]);

  const runDeviceAction = useCallback(async (action: string) => {
    setActionState({ action, status: "running" });
    try {
      await postMagSpotDeviceAction(device, action);
      setActionState({ action, status: "ok" });
    } catch {
      setActionState({ action, status: "error" });
    } finally {
      window.setTimeout(() => {
        setActionState((current) => current?.action === action ? null : current);
      }, 1200);
    }
  }, [device.id]);

  const sendKeyboardText = useCallback(async () => {
    const text = keyboardText.trim();
    if (!text) return;
    setKeyboardText("");
    try {
      await postMagSpotSyncCommand(controlDevices, `input text "${text.replace(/"/g, '\\"')}"`);
    } catch {
    }
  }, [keyboardText, controlDevices]);

  useEffect(() => {
    if (keyboardOpen) {
      window.setTimeout(() => keyboardInputRef.current?.focus(), 50);
    }
  }, [keyboardOpen]);

  const getScreenPoint = useCallback((event: React.PointerEvent | PointerEvent) => {
    const canvas = focusedStream.canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return null;
    const rect = canvas.getBoundingClientRect();
    const naturalAspect = canvas.width / canvas.height;
    const renderedAspect = rect.width / rect.height;
    let drawWidth = rect.width;
    let drawHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;
    if (renderedAspect > naturalAspect) {
      drawWidth = rect.height * naturalAspect;
      offsetX = (rect.width - drawWidth) / 2;
    } else {
      drawHeight = rect.width / naturalAspect;
      offsetY = (rect.height - drawHeight) / 2;
    }
    const localX = event.clientX - rect.left - offsetX;
    const localY = event.clientY - rect.top - offsetY;
    if (localX < 0 || localY < 0 || localX > drawWidth || localY > drawHeight) return null;
    return {
      x: Math.round((localX / drawWidth) * canvas.width),
      y: Math.round((localY / drawHeight) * canvas.height),
    };
  }, [focusedStream.canvasRef]);

  const handleScreenPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getScreenPoint(event);
    if (!point) return;
    pointerRef.current = { ...point, at: Date.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
    const canvas = focusedStream.canvasRef.current;
    if (!canvas || !canvas.width) return;
    focusedStream.sendControl(buildTouchMsg(A_DOWN, event.pointerId, point.x, point.y, canvas.width, canvas.height, event.pressure || 1, BTN_PRIMARY));
  }, [getScreenPoint, focusedStream]);

  const handleScreenPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerRef.current) return;
    const point = getScreenPoint(event);
    if (!point) return;
    const canvas = focusedStream.canvasRef.current;
    if (!canvas || !canvas.width) return;
    focusedStream.sendControl(buildTouchMsg(A_MOVE, event.pointerId, point.x, point.y, canvas.width, canvas.height, event.pressure || 1, BTN_PRIMARY));
  }, [getScreenPoint, focusedStream]);

  const handleScreenPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = pointerRef.current;
    pointerRef.current = null;
    const end = getScreenPoint(event);
    const canvas = focusedStream.canvasRef.current;
    if (end && canvas && canvas.width) {
      focusedStream.sendControl(buildTouchMsg(A_UP, event.pointerId, end.x, end.y, canvas.width, canvas.height, 0, BTN_PRIMARY));
    }
    setScreenError(null);
    // Sync to other selected devices when Sync Control is on
    if (!syncControlEnabled || !start || !end) return;
    const otherDevices = controlDevices.filter((d) => d.id !== device.id);
    if (otherDevices.length === 0) return;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const sw = canvas?.width  || undefined;
    const sh = canvas?.height || undefined;
    if (distance < 12) {
      postMagSpotLiveControlToDevices(otherDevices, { type: "tap", x: end.x, y: end.y, streamW: sw, streamH: sh }).catch(() => {});
    } else {
      postMagSpotLiveControlToDevices(otherDevices, { type: "swipe", x: start.x, y: start.y, x2: end.x, y2: end.y, duration: Date.now() - start.at, streamW: sw, streamH: sh }).catch(() => {});
    }
  }, [controlDevices, device.id, getScreenPoint, focusedStream, syncControlEnabled]);

  const handleScreenWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const point = getScreenPoint(event as unknown as React.PointerEvent);
    if (!point) return;
    const canvas = focusedStream.canvasRef.current;
    if (!canvas || !canvas.width) return;
    const SCROLL_SCALE = 1 / 120;
    const hSteps = Math.round(event.deltaX * SCROLL_SCALE);
    const vSteps = Math.round(event.deltaY * SCROLL_SCALE);
    focusedStream.sendControl(buildScrollMsg(point.x, point.y, canvas.width, canvas.height, hSteps, vSteps));
    // Sync to other selected devices as swipe (adb doesn't have a dedicated scroll API)
    if (!syncControlEnabled) return;
    const otherDevices = controlDevices.filter((d) => d.id !== device.id);
    if (otherDevices.length === 0) return;
    const SCROLL_PX = 200;
    const x2 = Math.max(0, Math.min(canvas.width, point.x - hSteps * SCROLL_PX));
    const y2 = Math.max(0, Math.min(canvas.height, point.y - vSteps * SCROLL_PX));
    if (x2 === point.x && y2 === point.y) return;
    postMagSpotLiveControlToDevices(otherDevices, { type: "swipe", x: point.x, y: point.y, x2, y2, duration: 80, streamW: canvas.width, streamH: canvas.height }).catch(() => {});
  }, [controlDevices, device.id, getScreenPoint, focusedStream, syncControlEnabled]);

  const handleDragStart = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
  }, [position.x, position.y]);

  const handleResizeStart = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originWidth: size.width,
      originHeight: size.height,
    };
  }, [size.width, size.height]);

  useEffect(() => {
    const repeatCounter = new Map<number, number>();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      // Don't capture when a browser form element is focused
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      const keycode = BROWSER_KEYCODE_MAP.get(event.code);
      if (keycode === undefined) return;
      let repeatCount = 0;
      if (event.repeat) {
        repeatCount = (repeatCounter.get(keycode) ?? 0) + 1;
        repeatCounter.set(keycode, repeatCount);
      }
      focusedStream.sendControl(buildKeyMsg(KEY_DOWN, keycode, repeatCount, keyMetaState(event)));
      // Sync first press (not repeat) to other devices
      if (syncControlEnabled && !event.repeat) {
        const others = controlDevices.filter((d) => d.id !== device.id);
        if (others.length > 0) {
          if (isPrintableKey(event)) {
            // Use `input text` so shift/alt/case is preserved correctly on the other device
            postMagSpotSyncCommand(others, "shell", ["input", "text", event.key]).catch(() => {});
          } else {
            postMagSpotSyncCommand(others, "shell", ["input", "keyevent", String(keycode)]).catch(() => {});
          }
        }
      }
      event.preventDefault();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      const keycode = BROWSER_KEYCODE_MAP.get(event.code);
      if (keycode === undefined) return;
      repeatCounter.delete(keycode);
      focusedStream.sendControl(buildKeyMsg(KEY_UP, keycode, 0, keyMetaState(event)));
      event.preventDefault();
    };

    const onStorage = () => setRegistryRecords(safeLoadRecords());
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    const onMouseMove = (event: MouseEvent) => {
      if (resizeRef.current) {
        const deltaX = event.clientX - resizeRef.current.startX;
        const deltaY = event.clientY - resizeRef.current.startY;
        const widthFromX = resizeRef.current.originWidth + deltaX;
        const widthFromY = (resizeRef.current.originHeight + deltaY) / PHONE_ASPECT_HEIGHT_OVER_WIDTH;
        const nextWidth = Math.abs(deltaX) >= Math.abs(deltaY / PHONE_ASPECT_HEIGHT_OVER_WIDTH)
          ? widthFromX
          : widthFromY;
        const maxWidth = Math.min(window.innerWidth - 24, (window.innerHeight - 24) / PHONE_ASPECT_HEIGHT_OVER_WIDTH);
        const clampedWidth = Math.max(260, Math.min(maxWidth, nextWidth));
        setSize({
          width: clampedWidth,
          height: Math.round(clampedWidth * PHONE_ASPECT_HEIGHT_OVER_WIDTH),
        });
        return;
      }
      if (dragRef.current) {
        const nextX = dragRef.current.originX + event.clientX - dragRef.current.startX;
        const nextY = dragRef.current.originY + event.clientY - dragRef.current.startY;
        setPosition({
          x: Math.max(8, Math.min(window.innerWidth - 80, nextX)),
          y: Math.max(8, Math.min(window.innerHeight - 60, nextY)),
        });
      }
    };
    const onMouseUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, [onClose, focusedStream.sendControl, syncControlEnabled, controlDevices, device.id]);

  return createPortal(
    <div className="fixed inset-0 z-[10000] pointer-events-none">
      <div
        className="flex overflow-visible select-none pointer-events-auto"
        style={{
          position: "absolute",
          left: position.x,
          top: position.y,
          width: size.width + 44 + (infoOpen ? 392 : 0),
          height: size.height,
        }}
      >
        <div
          className="rounded-2xl flex flex-col overflow-hidden shrink-0 relative"
          style={{
            width: size.width,
            height: size.height,
            background: "#10121a",
            border: `1px solid ${ACCENT}`,
            boxShadow: "0 24px 80px rgba(0,0,0,0.72), 0 0 22px rgba(0,212,232,0.22)",
          }}
        >
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "#273945" }}
          />

          <div
            onMouseDown={handleDragStart}
            className="relative shrink-0 flex items-center justify-between cursor-move px-2.5"
            style={{
              height: "28px",
              borderBottom: "1px solid #25313a",
              background: "#17232b",
              userSelect: "none",
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: deviceStatusColor(device), boxShadow: `0 0 4px ${deviceStatusColor(device)}` }}
              />
              <span
                className="font-mono font-bold leading-none shrink-0"
                style={{ fontSize: "11px", color: ACCENT, minWidth: "2ch", textAlign: "right" }}
              >
                {isUsbDevice(device) ? (device.ip ?? "USB").split(":")[0].slice(0, 4) : (device.ip ?? "").split(":")[0].split(".").pop() ?? "—"}
              </span>
              <span className="font-mono leading-none truncate" style={{ fontSize: "8px", color: "#7f8791" }}>
                {adbDeviceName || deviceModel || device.ip}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {(adbDeviceName || deviceModel) && (
                <span
                  className="font-mono leading-none px-1.5 py-0.5 rounded max-w-[112px] truncate"
                  style={{
                    fontSize: "10px",
                    color: "rgba(255,255,255,0.4)",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  {device.ip}
                </span>
              )}
              {countryBadge && (
                <span
                  className="font-mono leading-none px-1.5 py-0.5 rounded"
                  style={{
                    fontSize: "10px",
                    color: "rgba(255,255,255,0.82)",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {countryBadge}
                </span>
              )}
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: planIndicator.bg, boxShadow: `0 0 5px ${planIndicator.glow}` }}
              />
              <button
                onMouseDown={(event) => event.stopPropagation()}
                onClick={onClose}
                className="w-5 h-5 rounded-sm flex items-center justify-center transition-colors hover:bg-white/10"
                style={{ color: "#8c939c" }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div
            onPointerDown={handleScreenPointerDown}
            onPointerMove={handleScreenPointerMove}
            onPointerUp={handleScreenPointerUp}
            onPointerCancel={(e) => {
              const canvas = focusedStream.canvasRef.current;
              if (pointerRef.current && canvas && canvas.width) {
                const pt = pointerRef.current;
                focusedStream.sendControl(buildTouchMsg(A_CANCEL, e.pointerId, pt.x, pt.y, canvas.width, canvas.height, 0, 0));
              }
              pointerRef.current = null;
            }}
            onWheel={handleScreenWheel}
            className="flex-1 relative overflow-hidden"
            style={{ cursor: "crosshair", background: "#05070c", touchAction: "none" }}
          >
            <canvas
              ref={focusedStream.canvasRef}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ opacity: focusedStream.connected ? 1 : 0 }}
            />
            {!focusedStream.connected && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[10px] font-mono tracking-widest" style={{ color: `rgba(${ACCENT_RGB},0.4)` }}>
                  {focusedStream.failed ? "NO STREAM" : "CONNECTING…"}
                </span>
              </div>
            )}
          </div>

          {keyboardOpen && (
            <div
              className="flex items-center gap-1.5 px-2 py-1.5 shrink-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)" }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                ref={keyboardInputRef}
                type="text"
                placeholder="Type text to send…"
                value={keyboardText}
                onChange={(e) => setKeyboardText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendKeyboardText();
                  }
                }}
                className="flex-1 h-7 px-2 rounded-md text-xs outline-none text-white placeholder-white/30"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: `1px solid rgba(${ORIGIN_ACCENT_RGB},0.3)`,
                  fontFamily: "var(--app-font-sans)",
                }}
              />
              <button
                onClick={sendKeyboardText}
                title="Send"
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors hover:opacity-80"
                style={{ background: `rgba(${ORIGIN_ACCENT_RGB},0.18)`, border: `1px solid rgba(${ORIGIN_ACCENT_RGB},0.35)`, color: ORIGIN_ACCENT }}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div
            className="absolute left-0 inset-y-0 w-0.5"
            style={{ background: `linear-gradient(180deg, transparent, ${ACCENT}, transparent)` }}
          />
          <div
            onMouseDown={handleResizeStart}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize"
            style={{
              background: `linear-gradient(135deg, transparent 0 48%, rgba(${ACCENT_RGB},0.55) 49% 56%, transparent 57% 100%)`,
            }}
          />
        </div>
        <DeviceActionRail
          infoOpen={infoOpen}
          keyboardOpen={keyboardOpen}
          actionState={actionState}
          height={size.height}
          onToggleInfo={() => setInfoOpen((current) => !current)}
          onToggleKeyboard={() => setKeyboardOpen((v) => !v)}
          onRunAction={runDeviceAction}
        />
        {infoOpen && (
          <DeviceInfoPanel
            record={registryRecord}
            hasRegistryData={hasRegistryData}
            height={size.height}
            onSave={saveRegistryRecord}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

function DeviceActionRail({
  infoOpen,
  keyboardOpen,
  actionState,
  height,
  onToggleInfo,
  onToggleKeyboard,
  onRunAction,
}: {
  infoOpen: boolean;
  keyboardOpen: boolean;
  actionState: { action: string; status: "running" | "ok" | "error" } | null;
  height: number;
  onToggleInfo: () => void;
  onToggleKeyboard: () => void;
  onRunAction: (action: string) => void;
}) {
  const { t } = useLang();
  const actions = [
    { action: "home", label: t.actionHome, icon: Home },
    { action: "back", label: t.actionBack, icon: ArrowLeft },
    { action: "volumeUp", label: t.actionVolumeUp, icon: Volume2 },
    { action: "volumeDown", label: t.actionVolumeDown, icon: Volume1 },
    { action: "lock", label: t.actionLockScreen, icon: Lock },
    { action: "restart", label: t.actionRestartDevice, icon: RotateCw },
  ];

  const colorForAction = (action: string) => {
    if (actionState?.action !== action) return "rgba(255,255,255,0.42)";
    if (actionState.status === "ok") return "#22c55e";
    if (actionState.status === "error") return "#ef4444";
    return ACCENT;
  };

  return (
    <div
      className="ml-2 rounded-2xl overflow-hidden flex flex-col shrink-0"
      style={{
        width: 36,
        height,
        background: "rgba(14,17,28,0.94)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
      }}
    >
      {actions.map(({ action, label, icon: Icon }) => (
        <button
          key={action}
          onClick={() => onRunAction(action)}
          title={label}
          className="w-full h-10 flex items-center justify-center transition-colors hover:bg-white/10"
          style={{
            color: colorForAction(action),
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
      <div className="flex-1" />
      <button
        onClick={onToggleKeyboard}
        title="Text input"
        className="w-full h-10 flex items-center justify-center transition-colors"
        style={{
          color: keyboardOpen ? ORIGIN_ACCENT : "rgba(255,255,255,0.42)",
          background: keyboardOpen ? `rgba(${ORIGIN_ACCENT_RGB},0.14)` : "transparent",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Keyboard className="w-4 h-4" />
      </button>
      <button
        onClick={onToggleInfo}
        title={t.info}
        className="w-full h-10 flex items-center justify-center transition-colors"
        style={{
          color: infoOpen ? ACCENT : "rgba(255,255,255,0.42)",
          background: infoOpen ? `rgba(${ACCENT_RGB},0.14)` : "transparent",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Info className="w-4 h-4" />
      </button>
    </div>
  );
}

function DeviceInfoPanel({
  record,
  hasRegistryData,
  height,
  onSave,
}: {
  record: DeviceRegistryRecord;
  hasRegistryData: boolean;
  height: number;
  onSave: (record: DeviceRegistryRecord) => void;
}) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DeviceRegistryRecord>(record);
  const [deviceModels, setDeviceModels] = useState(() => safeLoadDeviceModels());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!editing) setDraft(record);
  }, [editing, record]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const updateDraft = (patch: Partial<DeviceRegistryRecord>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const saveDraft = () => {
    onSave(draft);
    setEditing(false);
  };

  const addDraftModel = () => {
    const model = draft.deviceModel?.trim() ?? "";
    if (!model || deviceModels.some((option) => option.toLowerCase() === model.toLowerCase())) return;
    setDeviceModels(saveDeviceModels([...deviceModels, model]));
    updateDraft({ deviceModel: model });
  };

  const copyValue = (fieldKey: string, value: string | number) => {
    void navigator.clipboard?.writeText(String(value));
    setCopiedField(fieldKey);
    if (copiedTimerRef.current) {
      window.clearTimeout(copiedTimerRef.current);
    }
    copiedTimerRef.current = window.setTimeout(() => setCopiedField(null), 1200);
  };
  const Value = ({ label, value, mono = false, wide = false, copy = true }: { label: string; value?: string | number | null; mono?: boolean; wide?: boolean; copy?: boolean }) => {
    if (!value) return null;
    const fieldKey = `${label}:${value}`;
    const isCopied = copiedField === fieldKey;
    const content = (
      <>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.26)" }}>{label}</div>
          {copy && (
            <span
              className="shrink-0 h-4 px-1.5 rounded-full flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider"
              style={{
                color: isCopied ? "#22c55e" : ACCENT,
                background: isCopied ? "rgba(34,197,94,0.12)" : `rgba(${ACCENT_RGB},0.1)`,
                border: `1px solid ${isCopied ? "rgba(34,197,94,0.28)" : `rgba(${ACCENT_RGB},0.22)`}`,
              }}
            >
              {isCopied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
              {isCopied ? t.copied : t.copy}
            </span>
          )}
        </div>
        <div
          className={mono ? "font-mono text-[11px] whitespace-pre-wrap break-words" : "text-[11px] whitespace-pre-wrap break-words"}
          style={{ color: "rgba(255,255,255,0.74)" }}
        >
          {value}
        </div>
      </>
    );
    if (!copy) {
      return (
        <div className={wide ? "min-w-0 text-left col-span-2" : "min-w-0 text-left"}>
          {content}
        </div>
      );
    }
    return (
    <button
      type="button"
      onClick={() => copyValue(fieldKey, value)}
      title={t.copy}
      className={wide ? "min-w-0 text-left rounded-lg p-1.5 -m-1.5 hover:bg-white/5 col-span-2 transition-colors" : "min-w-0 text-left rounded-lg p-1.5 -m-1.5 hover:bg-white/5 transition-colors"}
      style={{ outline: isCopied ? "1px solid rgba(34,197,94,0.32)" : "1px solid rgba(255,255,255,0.06)" }}
    >
      {content}
    </button>
    );
  };
  const EditActionButton = () => (
    <button
      type="button"
      onClick={editing ? saveDraft : () => setEditing(true)}
      title={editing ? t.save : t.edit}
      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10"
      style={{ color: ACCENT, background: "rgba(10,14,22,0.72)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      {editing ? <Save className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
    </button>
  );
  const Section = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
    <section className="rounded-xl p-3 space-y-2.5" style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold" style={{ color: ACCENT }}>{title}</div>
        {action}
      </div>
      {children}
    </section>
  );
  const EditField = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) => (
    <label className="min-w-0 flex flex-col gap-1">
      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.26)" }}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete="off"
        className="h-8 rounded-lg px-2.5 text-[11px] outline-none text-white"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
      />
    </label>
  );
  const EditModelField = () => {
    const listId = "device-info-model-options";
    const model = draft.deviceModel ?? "";
    const trimmed = model.trim();
    const canAdd = Boolean(trimmed) && !deviceModels.some((option) => option.toLowerCase() === trimmed.toLowerCase());
    return (
      <label className="min-w-0 flex flex-col gap-1">
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.26)" }}>{t.deviceModel}</span>
        <div className="grid grid-cols-[1fr_32px] gap-1.5">
          <input
            value={model}
            onChange={(event) => updateDraft({ deviceModel: event.target.value })}
            list={listId}
            autoComplete="off"
            className="h-8 rounded-lg px-2.5 text-[11px] outline-none text-white"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button
            type="button"
            disabled={!canAdd}
            onClick={addDraftModel}
            title={t.addDeviceModel}
            className="h-8 rounded-lg text-[13px] font-bold"
            style={{
              color: canAdd ? ACCENT : "rgba(255,255,255,0.22)",
              background: canAdd ? `rgba(${ACCENT_RGB},0.12)` : "rgba(255,255,255,0.04)",
              border: `1px solid ${canAdd ? `rgba(${ACCENT_RGB},0.28)` : "rgba(255,255,255,0.08)"}`,
            }}
          >
            +
          </button>
          <datalist id={listId}>
            {deviceModels.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>
      </label>
    );
  };
  const EditTextArea = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
    <label className="min-w-0 flex flex-col gap-1 col-span-2">
      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.26)" }}>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="rounded-lg px-2.5 py-2 text-[11px] outline-none text-white resize-none"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
      />
    </label>
  );
  const EditCountryField = () => {
    const matches = matchCountries(draft.vpnCountry, 4);
    const isSelectedCountry = Boolean(draft.vpnCountryCode && draft.vpnCountryFlag && matches.some((country) => country.code === draft.vpnCountryCode && country.name === draft.vpnCountry));
    const visibleMatches = isSelectedCountry ? [] : matches;
    const applyCountry = (country: CountryOption) => {
      updateDraft({
        vpnCountry: country.name,
        vpnCountryCode: country.code,
        vpnCountryFlag: countryFlag(country.code),
      });
    };
    const updateCountryText = (value: string) => {
      const nextMatch = matchCountries(value, 1)[0];
      updateDraft({
        vpnCountry: value,
        vpnCountryCode: nextMatch ? nextMatch.code : "",
        vpnCountryFlag: nextMatch ? countryFlag(nextMatch.code) : "",
      });
    };
    return (
      <div className="min-w-0 flex flex-col gap-1">
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.26)" }}>{t.vpnCountry}</span>
        <div className="grid grid-cols-[1fr_74px] gap-1.5">
          <input
            value={draft.vpnCountry}
            onChange={(event) => updateCountryText(event.target.value)}
            autoComplete="off"
            className="h-8 rounded-lg px-2.5 text-[11px] outline-none text-white"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <div
            className="h-8 rounded-lg px-2 flex items-center justify-center gap-1 font-mono text-[11px] font-bold"
            style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)", color: draft.vpnCountryCode ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.22)" }}
          >
            <span>{draft.vpnCountryFlag}</span>
            <span>{draft.vpnCountryCode}</span>
          </div>
        </div>
        {visibleMatches.length > 0 && (
          <div className="rounded-lg overflow-hidden" style={{ background: "rgba(7,10,18,0.82)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {visibleMatches.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => applyCountry(country)}
                className="w-full h-7 px-2 flex items-center justify-between text-left hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.76)" }}
              >
                <span className="text-[11px] truncate">{country.name}</span>
                <span className="font-mono text-[11px] font-bold">{countryFlag(country.code)} {country.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className="ml-2 rounded-2xl overflow-hidden shrink-0 flex flex-col relative"
      style={{
        width: 384,
        height,
        background: "rgba(12,15,24,0.97)",
        border: "1px solid rgba(255,255,255,0.11)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
      }}
    >
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {editing ? (
          <>
            <Section title={t.deviceSection} action={<EditActionButton />}>
              <div className="grid grid-cols-1 gap-2.5">
                <EditField label={t.deviceNumber} value={draft.deviceNumber} onChange={(value) => updateDraft({ deviceNumber: value })} />
                <EditModelField />
                <EditCountryField />
              </div>
            </Section>
            <Section title={t.accountSection}>
              <div className="grid grid-cols-2 gap-2.5">
                <EditField label={t.firstName} value={draft.firstName} onChange={(value) => updateDraft({ firstName: value })} />
                <EditField label={t.lastName} value={draft.lastName} onChange={(value) => updateDraft({ lastName: value })} />
                <EditField label={t.gmailAddress} value={draft.gmailAddress} onChange={(value) => updateDraft({ gmailAddress: value })} />
                <EditField label={t.gmailPassword} value={draft.gmailPassword} onChange={(value) => updateDraft({ gmailPassword: value })} />
                <EditField label={t.secondEmail} value={draft.secondEmail} onChange={(value) => updateDraft({ secondEmail: value })} />
                <EditTextArea label={t.twoFactorNotes} value={draft.twoFactorNotes} onChange={(value) => updateDraft({ twoFactorNotes: value })} />
              </div>
            </Section>
            <Section title={t.paymentSection}>
              <div className="grid grid-cols-2 gap-2.5">
                <EditField label={t.cardHolder} value={draft.cardHolder} onChange={(value) => updateDraft({ cardHolder: value })} />
                <EditField label={t.cardType} value={draft.cardType} onChange={(value) => updateDraft({ cardType: value })} />
                <EditField label={t.cardNumber} value={draft.cardNumber} onChange={(value) => updateDraft({ cardNumber: value })} />
                <EditField label={t.expiryDate} value={draft.expiryDate} onChange={(value) => updateDraft({ expiryDate: value })} />
                <EditField label={t.cvv} value={draft.cvv} onChange={(value) => updateDraft({ cvv: value })} />
                <EditField label={t.billingDate} value={draft.billingDate} onChange={(value) => updateDraft({ billingDate: value })} />
              </div>
            </Section>
            <Section title={t.miscSection}>
              <div className="grid grid-cols-2 gap-2.5">
                <EditTextArea label={t.misc} value={draft.misc} onChange={(value) => updateDraft({ misc: value })} />
              </div>
            </Section>
          </>
        ) : (
          <>
        <Section title={t.deviceSection} action={<EditActionButton />}>
          <div className="grid grid-cols-1 gap-2.5">
            <Value label={t.deviceNumber} value={record.deviceNumber} mono copy={false} />
            <Value label={t.deviceModel} value={record.deviceModel} copy={false} />
            <Value
              label={t.vpnCountry}
              value={record.vpnCountry ? `${record.vpnCountryFlag ? `${record.vpnCountryFlag} ` : ""}${record.vpnCountryCode ? `${record.vpnCountryCode} · ` : ""}${record.vpnCountry}` : ""}
              copy={false}
            />
          </div>
        </Section>
        <Section title={t.accountSection}>
          <div className="grid grid-cols-1 gap-2.5">
            <Value label={t.firstName} value={record.firstName} />
            <Value label={t.lastName} value={record.lastName} />
            <Value label={t.gmailAddress} value={record.gmailAddress} />
            <Value label={t.gmailPassword} value={record.gmailPassword} />
            <Value label={t.secondEmail} value={record.secondEmail} />
          </div>
          <Value label={t.twoFactorNotes} value={record.twoFactorNotes} copy={false} />
        </Section>
        <Section title={t.paymentSection}>
          <div className="grid grid-cols-1 gap-2.5">
            <Value label={t.cardHolder} value={record.cardHolder} />
            <Value label={t.cardType} value={record.cardType} />
            <Value label={t.cardNumber} value={record.cardNumber} />
            <Value label={t.expiryDate} value={record.expiryDate} />
            <Value label={t.cvv} value={record.cvv} />
            <Value label={t.billingDate} value={record.billingDate} copy={false} />
          </div>
        </Section>
        <Section title={t.miscSection}>
          <Value label={t.misc} value={record.misc} copy={false} />
        </Section>
        {!hasRegistryData && (
          <div className="text-[11px] text-center py-3" style={{ color: "rgba(255,255,255,0.28)" }}>
            {t.noSavedDeviceInfo}
          </div>
        )}
          </>
        )}
      </div>
    </aside>
  );
}
