import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { ripsExport } from "@wellfit-emr/db/schema/clinical";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const nonEmptyStringSchema = z.string().min(1);

const ripsExportSchema = z.object({
  generatedAt: z.date(),
  id: z.string(),
  payloadJson: z.record(z.string(), z.any()).nullable(),
  payerId: z.string(),
  periodFrom: z.date(),
  periodTo: z.date(),
  status: z.string(),
  validationResultJson: z.record(z.string(), z.any()).nullable(),
});

const createRipsExportSchema = z.object({
  generatedAt: z.coerce.date(),
  payerId: nonEmptyStringSchema,
  payloadJson: z.record(z.string(), z.any()).nullable().optional(),
  periodFrom: z.coerce.date(),
  periodTo: z.coerce.date(),
  status: nonEmptyStringSchema.default("draft"),
  validationResultJson: z.record(z.string(), z.any()).nullable().optional(),
});

const listRipsExportsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  payerId: z.string().min(1).optional(),
  sortBy: z.enum(["generatedAt"]).default("generatedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  status: z.string().min(1).optional(),
});

const listResponseSchema = z.object({
  items: z.array(ripsExportSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

function throwCreateError(recordName: string): never {
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    message: `Failed to create ${recordName}.`,
  });
}

const createRipsExportProcedure = protectedProcedure
  .input(createRipsExportSchema)
  .output(ripsExportSchema)
  .handler(async ({ context, input }) => {
    const [created] = await context.db
      .insert(ripsExport)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return created ?? throwCreateError("RIPS export");
  });

const listRipsExportsProcedure = protectedProcedure
  .input(listRipsExportsSchema)
  .output(listResponseSchema)
  .handler(async ({ context, input }) => {
    const filters = [
      input.payerId ? eq(ripsExport.payerId, input.payerId) : undefined,
      input.status ? eq(ripsExport.status, input.status) : undefined,
    ].filter((filter) => filter !== undefined);

    const where = filters.length > 0 ? and(...filters) : undefined;
    const orderBy =
      input.sortDirection === "asc"
        ? asc(ripsExport.generatedAt)
        : desc(ripsExport.generatedAt);

    const [items, totalRows] = await Promise.all([
      context.db
        .select()
        .from(ripsExport)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(ripsExport).where(where),
    ]);

    return {
      items,
      limit: input.limit,
      offset: input.offset,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

export interface RipsExportsRouter extends Record<string, AnyRouter> {
  create: typeof createRipsExportProcedure;
  list: typeof listRipsExportsProcedure;
}

export const ripsExportsRouter: RipsExportsRouter = {
  create: createRipsExportProcedure,
  list: listRipsExportsProcedure,
};
