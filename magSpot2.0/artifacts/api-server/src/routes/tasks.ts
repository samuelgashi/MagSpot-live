import { Router } from "express";
import { db, tasks } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateTaskBody,
  UpdateTaskBody,
  GetTaskParams,
  UpdateTaskParams,
  DeleteTaskParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/tasks", async (req, res) => {
  try {
    const rows = await db.select().from(tasks).orderBy(tasks.createdAt);
    res.json(rows.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to list tasks");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tasks", async (req, res) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [row] = await db.insert(tasks).values(parsed.data).returning();
    res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create task");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tasks/:id", async (req, res) => {
  const parsed = GetTaskParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [row] = await db.select().from(tasks).where(eq(tasks.id, parsed.data.id));
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to get task");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/tasks/:id", async (req, res) => {
  const paramsParsed = UpdateTaskParams.safeParse({ id: Number(req.params.id) });
  const bodyParsed = UpdateTaskBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  try {
    const [row] = await db
      .update(tasks)
      .set(bodyParsed.data)
      .where(eq(tasks.id, paramsParsed.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to update task");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  const parsed = DeleteTaskParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db.delete(tasks).where(eq(tasks.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete task");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
