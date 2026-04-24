import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import {
  ripsReferenceEntry,
  ripsReferenceTable,
} from "@wellfit-emr/db/schema/rips-reference";
import { and, asc, count, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
  fetchSisproTableState,
  syncRipsReferenceTables,
  syncSingleTable,
} from "../services/rips-sync";

const tableSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  sisproDbName: z.string().nullable(),
  sisproUrl: z.string(),
  sisproLastUpdate: z.date().nullable(),
  lastSyncedAt: z.date().nullable(),
  entryCount: z.number(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const entrySchema = z.object({
  id: z.number(),
  tableId: z.number(),
  tableName: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  enabled: z.boolean(),
  extraData: z.record(z.string(), z.string()).nullable(),
  sourceId: z.number().nullable(),
  sourceUpdatedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const listTablesSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  search: z.string().min(1).optional(),
  onlyActive: z.boolean().default(true),
  sortBy: z.enum(["name", "lastSyncedAt", "entryCount"]).default("name"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

const listTablesResponseSchema = z.object({
  limit: z.number(),
  offset: z.number(),
  tables: z.array(tableSchema),
  total: z.number(),
});

const listEntriesSchema = z.object({
  tableName: z.string().min(1),
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
  search: z.string().min(1).optional(),
  onlyEnabled: z.boolean().default(true),
  sortBy: z.enum(["code", "name"]).default("code"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

const listEntriesResponseSchema = z.object({
  limit: z.number(),
  offset: z.number(),
  entries: z.array(entrySchema),
  total: z.number(),
});

const syncTableSchema = z.object({
  tableName: z.string().min(1),
});

const syncResultSchema = z.object({
  tableName: z.string(),
  inserted: z.number(),
  updated: z.number(),
});

const syncAllResultSchema = z.object({
  synced: z.number(),
  errors: z.array(z.string()),
});

const getEntrySchema = z.object({
  tableName: z.string().min(1),
  code: z.string().min(1),
});

const listTablesProcedure = protectedProcedure
  .input(listTablesSchema)
  .output(listTablesResponseSchema)
  .handler(async ({ context, input }) => {
    const whereConditions: ReturnType<typeof eq>[] = [];

    if (input.onlyActive) {
      whereConditions.push(eq(ripsReferenceTable.isActive, true));
    }

    if (input.search) {
      whereConditions.push(like(ripsReferenceTable.name, `%${input.search}%`));
    }

    const whereClause =
      whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const orderBy =
      input.sortDirection === "asc"
        ? asc(ripsReferenceTable[input.sortBy])
        : desc(ripsReferenceTable[input.sortBy]);

    const [totalResult, tables] = await Promise.all([
      context.db
        .select({ count: count() })
        .from(ripsReferenceTable)
        .where(whereClause),
      context.db
        .select()
        .from(ripsReferenceTable)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
    ]);

    return {
      limit: input.limit,
      offset: input.offset,
      tables,
      total: totalResult[0]?.count ?? 0,
    };
  });

const listEntriesProcedure = protectedProcedure
  .input(listEntriesSchema)
  .output(listEntriesResponseSchema)
  .handler(async ({ context, input }) => {
    const table = await context.db
      .select()
      .from(ripsReferenceTable)
      .where(eq(ripsReferenceTable.name, input.tableName))
      .limit(1);

    const [foundTable] = table;
    if (!foundTable) {
      throw new ORPCError("NOT_FOUND", {
        message: `Reference table '${input.tableName}' not found.`,
      });
    }

    const tableId = foundTable.id;
    const whereConditions = [eq(ripsReferenceEntry.tableId, tableId)];

    if (input.onlyEnabled) {
      whereConditions.push(eq(ripsReferenceEntry.enabled, true));
    }

    if (input.search) {
      const searchCondition = or(
        like(ripsReferenceEntry.code, `%${input.search}%`),
        like(ripsReferenceEntry.name, `%${input.search}%`)
      );

      if (searchCondition) {
        whereConditions.push(searchCondition);
      }
    }

    const whereClause = and(...whereConditions);

    const orderBy =
      input.sortDirection === "asc"
        ? asc(ripsReferenceEntry[input.sortBy])
        : desc(ripsReferenceEntry[input.sortBy]);

    const [totalResult, entries] = await Promise.all([
      context.db
        .select({ count: count() })
        .from(ripsReferenceEntry)
        .where(whereClause),
      context.db
        .select()
        .from(ripsReferenceEntry)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
    ]);

    return {
      limit: input.limit,
      offset: input.offset,
      entries,
      total: totalResult[0]?.count ?? 0,
    };
  });

const getEntryProcedure = protectedProcedure
  .input(getEntrySchema)
  .output(entrySchema)
  .handler(async ({ context, input }) => {
    const [entry] = await context.db
      .select()
      .from(ripsReferenceEntry)
      .where(
        and(
          eq(ripsReferenceEntry.tableName, input.tableName),
          eq(ripsReferenceEntry.code, input.code)
        )
      )
      .limit(1);

    if (!entry) {
      throw new ORPCError("NOT_FOUND", {
        message: `Entry '${input.code}' not found in table '${input.tableName}'.`,
      });
    }

    return entry;
  });

const syncTableProcedure = protectedProcedure
  .input(syncTableSchema)
  .output(syncResultSchema)
  .handler(async ({ context, input }) => {
    const states = await fetchSisproTableState();
    const state = states.find((s) => s.nombre === input.tableName);

    if (!state) {
      throw new ORPCError("NOT_FOUND", {
        message: `Table '${input.tableName}' not found in SISPRO.`,
      });
    }

    const { inserted, updated } = await syncSingleTable(context.db, state);

    return { tableName: input.tableName, inserted, updated };
  });

const syncAllProcedure = protectedProcedure
  .input(z.void().optional())
  .output(syncAllResultSchema)
  .handler(async ({ context }) => {
    const result = await syncRipsReferenceTables(context.db);
    return result;
  });

export const ripsReferenceRouter = {
  listTables: listTablesProcedure,
  listEntries: listEntriesProcedure,
  getEntry: getEntryProcedure,
  syncTable: syncTableProcedure,
  syncAll: syncAllProcedure,
} satisfies AnyRouter;
