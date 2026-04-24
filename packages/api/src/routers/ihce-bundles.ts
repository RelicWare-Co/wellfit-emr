import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { ihceBundle } from "@wellfit-emr/db/schema/clinical";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const nonEmptyStringSchema = z.string().min(1);
const optionalNullableStringSchema = z.string().min(1).nullable().optional();
const optionalDateSchema = z.coerce.date().nullable().optional();

const ihceBundleSchema = z.object({
  bundleJson: z.record(z.string(), z.any()),
  bundleType: z.string(),
  encounterId: z.string(),
  generatedAt: z.date(),
  id: z.string(),
  responseCode: z.string().nullable(),
  sentAt: z.date().nullable(),
  status: z.string(),
  vidaCode: z.string().nullable(),
});

const createIhceBundleSchema = z.object({
  bundleJson: z.record(z.string(), z.any()),
  bundleType: nonEmptyStringSchema,
  encounterId: nonEmptyStringSchema,
  generatedAt: z.coerce.date(),
  responseCode: optionalNullableStringSchema,
  sentAt: optionalDateSchema,
  status: nonEmptyStringSchema.default("generated"),
  vidaCode: optionalNullableStringSchema,
});

const listIhceBundlesSchema = z.object({
  encounterId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(["generatedAt"]).default("generatedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  status: z.string().min(1).optional(),
});

const listResponseSchema = z.object({
  items: z.array(ihceBundleSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

function throwCreateError(recordName: string): never {
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    message: `Failed to create ${recordName}.`,
  });
}

const createIhceBundleProcedure = protectedProcedure
  .input(createIhceBundleSchema)
  .output(ihceBundleSchema)
  .handler(async ({ context, input }) => {
    const [created] = await context.db
      .insert(ihceBundle)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return created ?? throwCreateError("IHCE bundle");
  });

const listIhceBundlesProcedure = protectedProcedure
  .input(listIhceBundlesSchema)
  .output(listResponseSchema)
  .handler(async ({ context, input }) => {
    const filters = [
      input.encounterId
        ? eq(ihceBundle.encounterId, input.encounterId)
        : undefined,
      input.status ? eq(ihceBundle.status, input.status) : undefined,
    ].filter((filter) => filter !== undefined);

    const where = filters.length > 0 ? and(...filters) : undefined;
    const orderBy =
      input.sortDirection === "asc"
        ? asc(ihceBundle.generatedAt)
        : desc(ihceBundle.generatedAt);

    const [items, totalRows] = await Promise.all([
      context.db
        .select()
        .from(ihceBundle)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(ihceBundle).where(where),
    ]);

    return {
      items,
      limit: input.limit,
      offset: input.offset,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

export interface IhceBundlesRouter extends Record<string, AnyRouter> {
  create: typeof createIhceBundleProcedure;
  list: typeof listIhceBundlesProcedure;
}

export const ihceBundlesRouter: IhceBundlesRouter = {
  create: createIhceBundleProcedure,
  list: listIhceBundlesProcedure,
};
