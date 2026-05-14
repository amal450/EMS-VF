import { pgTable, serial, text, integer, timestamp, doublePrecision, varchar, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("AGENT"),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
});

export const user_permissions = pgTable("user_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  permissionId: integer("permission_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), 
  parentId: integer("parent_id"), 
  webSocketLink: varchar("websocketlink", { length: 255 }),
  maxCurrent: doublePrecision("max_current").default(80.0),
});

export const measurements = pgTable("measurements", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  V1N: doublePrecision("v1n"), V2N: doublePrecision("v2n"), V3N: doublePrecision("v3n"),
  V12: doublePrecision("v12"), V23: doublePrecision("v23"), V31: doublePrecision("v31"),
  I1: doublePrecision("i1"), I2: doublePrecision("i2"), I3: doublePrecision("i3"),
  TKW: doublePrecision("tkw"), IKWH: doublePrecision("ikwh"), HZ: doublePrecision("hz"), 
  PF: doublePrecision("pf"), KVAH: doublePrecision("kvah"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  message: text("message").notNull(),
  value: doublePrecision("value").notNull(),
  threshold: doublePrecision("threshold").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Table des seuils d'alerte
export const thresholds = pgTable("thresholds", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  parameter: text("parameter").notNull(), // V1N, V2N, V3N, I1, I2, I3, TKW, HZ, PF
  minValue: doublePrecision("min_value"), // Seuil minimum
  maxValue: doublePrecision("max_value"), // Seuil maximum
  isActive: integer("is_active").default(1), // 1 = actif, 0 = inactif
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// NOUVELLE TABLE POUR LE SPRINT FINAL
export const facture = pgTable("facture", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  activeEnergy: doublePrecision("active_energy").notNull(),
  rateJour: doublePrecision("rate_jour").notNull(),
  ratePointeMatin: doublePrecision("rate_pointe_matin").notNull(),
  rateSoir: doublePrecision("rate_soir").notNull(),
  rateNuit: doublePrecision("rate_nuit").notNull(),
  primePuissance: doublePrecision("prime_puissance").notNull(),
  tva: doublePrecision("tva").notNull(),
  municipal: doublePrecision("municipal").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});
