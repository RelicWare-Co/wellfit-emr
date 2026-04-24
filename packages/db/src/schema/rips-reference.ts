import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull();

export const ripsReferenceTable = sqliteTable(
  "rips_reference_table",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description"),
    sisproDbName: text("sispro_db_name"),
    sisproUrl: text("sispro_url").notNull(),
    sisproLastUpdate: integer("sispro_last_update", { mode: "timestamp_ms" }),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
    entryCount: integer("entry_count").default(0).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("rips_ref_table_active_idx").on(table.isActive),
    index("rips_ref_table_name_idx").on(table.name),
  ]
);

export const ripsReferenceEntry = sqliteTable(
  "rips_reference_entry",
  {
    id: integer("id").primaryKey(),
    tableId: integer("table_id")
      .notNull()
      .references(() => ripsReferenceTable.id),
    tableName: text("table_name").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
    extraData: text("extra_data", { mode: "json" }).$type<
      Record<string, string>
    >(),
    sourceId: integer("source_id"),
    sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("rips_ref_entry_table_code_idx").on(table.tableId, table.code),
    index("rips_ref_entry_table_name_idx").on(table.tableId, table.name),
    index("rips_ref_entry_table_enabled_idx").on(table.tableId, table.enabled),
    uniqueIndex("rips_ref_entry_table_name_code_unique_idx").on(
      table.tableName,
      table.code
    ),
  ]
);
