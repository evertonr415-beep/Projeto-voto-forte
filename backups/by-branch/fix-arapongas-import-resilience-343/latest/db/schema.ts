import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["master", "admin", "user"] }).notNull().default("user"),
  status: text("status", { enum: ["active", "blocked"] }).notNull().default("active"),
  lastSeenAt: text("last_seen_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [index("audit_actor_idx").on(table.actorEmail), index("audit_created_idx").on(table.createdAt)]);

export const ownedRecords = sqliteTable("owned_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [index("owned_records_owner_idx").on(table.ownerEmail), index("owned_records_kind_idx").on(table.kind)]);
