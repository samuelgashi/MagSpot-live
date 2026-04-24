import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { groups } from "./groups";

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ip: text("ip").notNull().unique(),
  status: text("status").notNull().default("offline"),
  model: text("model"),
  androidVersion: text("android_version"),
  batteryLevel: integer("battery_level"),
  groupId: integer("group_id").references(() => groups.id, { onDelete: "set null" }),
  sheetUrl: text("sheet_url"),
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devices).omit({ id: true, createdAt: true });
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;
