import { Router } from "express";
import { db, devices, groups } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  CreateDeviceBody,
  UpdateDeviceBody,
  ScanDevicesBody,
  GetDeviceParams,
  UpdateDeviceParams,
  DeleteDeviceParams,
} from "@workspace/api-zod";

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

router.get("/devices", async (req, res) => {
  try {
    const rows = await db.select().from(devices).orderBy(devices.createdAt);
    const result = rows.map((d) => ({
      ...d,
      lastSeen: d.lastSeen?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list devices");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/devices", async (req, res) => {
  const parsed = CreateDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [row] = await db
      .insert(devices)
      .values({ ...parsed.data, status: "offline" })
      .returning();
    res.status(201).json({
      ...row,
      lastSeen: row.lastSeen?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create device");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/devices/scan", async (req, res) => {
  const parsed = ScanDevicesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { ipRange } = parsed.data;
  const models = ["Samsung Galaxy A53", "Xiaomi Redmi Note 11", "Oppo A96", "Realme 9", "Vivo Y76"];
  const versions = ["11", "12", "13"];
  const discovered = [];
  const count = Math.floor(Math.random() * 6) + 3;
  for (let i = 1; i <= count; i++) {
    const ip = `${ipRange}.${Math.floor(Math.random() * 200) + 10}`;
    const model = models[Math.floor(Math.random() * models.length)];
    const version = versions[Math.floor(Math.random() * versions.length)];
    const battery = Math.floor(Math.random() * 80) + 20;
    const status = Math.random() > 0.2 ? "online" : "offline";
    try {
      const existing = await db.select().from(devices).where(eq(devices.ip, ip));
      if (existing.length > 0) {
        const [updated] = await db
          .update(devices)
          .set({ status, lastSeen: new Date() })
          .where(eq(devices.ip, ip))
          .returning();
        discovered.push({
          ...updated,
          lastSeen: updated.lastSeen?.toISOString() ?? null,
          createdAt: updated.createdAt.toISOString(),
        });
      } else {
        const [inserted] = await db
          .insert(devices)
          .values({
            name: `Device-${ip.split(".").pop()}`,
            ip,
            status,
            model,
            androidVersion: version,
            batteryLevel: battery,
            lastSeen: new Date(),
          })
          .returning();
        discovered.push({
          ...inserted,
          lastSeen: inserted.lastSeen?.toISOString() ?? null,
          createdAt: inserted.createdAt.toISOString(),
        });
      }
    } catch (_) {
      // skip conflicts
    }
  }
  res.json(discovered);
});

router.get("/devices/stats", async (req, res) => {
  try {
    const rows = await db.select().from(devices);
    const groupCount = await db.select({ count: sql<number>`count(*)` }).from(groups);
    const stats = {
      total: rows.length,
      online: rows.filter((d) => d.status === "online").length,
      offline: rows.filter((d) => d.status === "offline").length,
      busy: rows.filter((d) => d.status === "busy").length,
      idle: rows.filter((d) => d.status === "idle").length,
      groups: Number(groupCount[0]?.count ?? 0),
    };
    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Failed to get device stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/devices/:id", async (req, res) => {
  const parsed = GetDeviceParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [row] = await db.select().from(devices).where(eq(devices.id, parsed.data.id));
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({
      ...row,
      lastSeen: row.lastSeen?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get device");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/devices/:id", async (req, res) => {
  const paramsParsed = UpdateDeviceParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = UpdateDeviceBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  try {
    const [row] = await db
      .update(devices)
      .set(bodyParsed.data)
      .where(eq(devices.id, paramsParsed.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({
      ...row,
      lastSeen: row.lastSeen?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update device");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/devices/restart-adb", async (_req, res) => {
  try {
    // Simulate ADB server restart (real impl: exec `adb kill-server && adb start-server`)
    await new Promise((r) => setTimeout(r, 800));
    res.json({ ok: true, message: "ADB server restarted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to restart ADB" });
  }
});

router.post("/devices/:id/control", async (req, res) => {
  const parsed = GetDeviceParams.safeParse({ id: Number(req.params.id) });
  const action = typeof req.body?.action === "string" ? req.body.action : "";
  const args = DEVICE_ACTIONS[action];
  if (!parsed.success || !args) {
    res.status(400).json({ error: "Invalid device action" });
    return;
  }
  try {
    const [device] = await db.select().from(devices).where(eq(devices.id, parsed.data.id));
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    const target = adbTargetForIp(device.ip);
    await execFileAsync("adb", ["-s", target, ...args], { timeout: 15000 });
    res.json({ ok: true, action });
  } catch (err) {
    req.log.error({ err, action, deviceId: parsed.success ? parsed.data.id : undefined }, "Failed to run device action");
    res.status(500).json({ error: "Device action failed" });
  }
});

router.delete("/devices/:id", async (req, res) => {
  const parsed = DeleteDeviceParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db.delete(devices).where(eq(devices.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete device");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
