import { Router } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { proxyFlask } from "../lib/flaskProxy";

const router = Router();
const execFileAsync = promisify(execFile);

const DEVICE_ACTIONS: Record<string, string[]> = {
  home: ["shell", "input", "keyevent", "HOME"],
  back: ["shell", "input", "keyevent", "BACK"],
  volumeUp: ["shell", "input", "keyevent", "VOLUME_UP"],
  volumeDown: ["shell", "input", "keyevent", "VOLUME_DOWN"],
  lock: ["shell", "input", "keyevent", "POWER"],
  restart: ["reboot"],
};

const adbTargetForIp = (ip: string) => (ip.includes(":") ? ip : `${ip}:5555`);

router.get("/devices", (req, res) => proxyFlask(req, res, "/android_devices"));

router.post("/devices", (req, res) => proxyFlask(req, res, "/android_devices"));

router.post("/devices/scan", (req, res) => proxyFlask(req, res, "/devices/connect-range"));

router.get("/devices/stats", (req, res) => proxyFlask(req, res, "/android_devices"));

router.post("/devices/restart-adb", async (_req, res) => {
  try {
    await new Promise((r) => setTimeout(r, 800));
    res.json({ ok: true, message: "ADB server restarted" });
  } catch {
    res.status(500).json({ error: "Failed to restart ADB" });
  }
});

router.get("/devices/:id", (req, res) => proxyFlask(req, res, `/android_devices/${req.params.id}`));

router.put("/devices/:id", (req, res) => proxyFlask(req, res, `/android_devices/${req.params.id}`));

router.post("/devices/:id/control", async (req, res) => {
  const deviceId = req.params.id;
  const action = typeof req.body?.action === "string" ? req.body.action : "";
  const args = DEVICE_ACTIONS[action];
  if (!args) {
    res.status(400).json({ error: "Invalid device action" });
    return;
  }
  try {
    const apiKey = req.headers["x-api-key"];
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    if (apiKey) headers["x-api-key"] = String(apiKey);

    const FLASK_URL = (process.env.FLASK_BACKEND_URL || "http://localhost:9786").replace(/\/+$/, "");
    const upstream = await fetch(`${FLASK_URL}/api/android_devices/${deviceId}`, { method: "GET", headers });
    const deviceData = await upstream.json().catch(() => null) as Record<string, unknown> | null;
    const ip = (deviceData?.android_ip ?? deviceData?.ip ?? deviceId) as string;
    const target = adbTargetForIp(ip);
    await execFileAsync("adb", ["-s", target, ...args], { timeout: 15000 });
    res.json({ ok: true, action });
  } catch (err) {
    req.log?.error?.({ err, action }, "Failed to run device action");
    res.status(500).json({ error: "Device action failed" });
  }
});

router.delete("/devices/:id", (req, res) => proxyFlask(req, res, `/android_devices/${req.params.id}`));

export default router;
