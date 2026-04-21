import { Router } from "express";
import { db, groups, devices } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateGroupBody,
  UpdateGroupBody,
  GetGroupParams,
  UpdateGroupParams,
  DeleteGroupParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/groups", async (req, res) => {
  try {
    const rows = await db.select().from(groups).orderBy(groups.createdAt);
    const withCounts = await Promise.all(
      rows.map(async (g) => {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(devices)
          .where(eq(devices.groupId, g.id));
        return {
          ...g,
          deviceCount: Number(count),
          createdAt: g.createdAt.toISOString(),
        };
      }),
    );
    res.json(withCounts);
  } catch (err) {
    req.log.error({ err }, "Failed to list groups");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/groups", async (req, res) => {
  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [row] = await db.insert(groups).values(parsed.data).returning();
    res.status(201).json({ ...row, deviceCount: 0, createdAt: row.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create group");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/groups/:id", async (req, res) => {
  const parsed = GetGroupParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [row] = await db.select().from(groups).where(eq(groups.id, parsed.data.id));
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(devices)
      .where(eq(devices.groupId, row.id));
    res.json({ ...row, deviceCount: Number(count), createdAt: row.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to get group");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/groups/:id", async (req, res) => {
  const paramsParsed = UpdateGroupParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = UpdateGroupBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  try {
    const [row] = await db
      .update(groups)
      .set(bodyParsed.data)
      .where(eq(groups.id, paramsParsed.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(devices)
      .where(eq(devices.groupId, row.id));
    res.json({ ...row, deviceCount: Number(count), createdAt: row.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to update group");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/groups/:id", async (req, res) => {
  const parsed = DeleteGroupParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db.delete(groups).where(eq(groups.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete group");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
