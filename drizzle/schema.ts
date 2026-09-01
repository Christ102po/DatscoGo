import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const routes = mysqlTable("routes", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["ferry", "bus"]).default("bus").notNull(),
  eta: varchar("eta", { length: 64 }).notNull(),
  fare: varchar("fare", { length: 64 }).notNull(),
  durationBadge: varchar("durationBadge", { length: 64 }).notNull(),
  polylineCoords: text("polylineCoords").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RouteItem = typeof routes.$inferSelect;
export type InsertRouteItem = typeof routes.$inferInsert;

export const schedules = mysqlTable("schedules", {
  id: int("id").autoincrement().primaryKey(),
  routeTitle: varchar("routeTitle", { length: 255 }).notNull(),
  period: mysqlEnum("period", ["morning", "afternoon"]).notNull(),
  timeSlot: varchar("timeSlot", { length: 64 }).notNull(),
  operatingDays: varchar("operatingDays", { length: 128 }).default("Monday – Saturday only").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScheduleItem = typeof schedules.$inferSelect;
export type InsertScheduleItem = typeof schedules.$inferInsert;

export const terminals = mysqlTable("terminals", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  details: varchar("details", { length: 255 }).notNull(),
  lat: decimal("lat", { precision: 10, scale: 6 }).notNull(),
  lng: decimal("lng", { precision: 10, scale: 6 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TerminalItem = typeof terminals.$inferSelect;
export type InsertTerminalItem = typeof terminals.$inferInsert;
