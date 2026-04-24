import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { interconsultation } from "@wellfit-emr/db/schema/clinical";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const nonEmptyStringSchema = z.string().min(1);
const optionalNullableStringSchema = z.string().min(1).nullable().optional();

const interconsultationSchema = z.object({
  encounterId: z.string(),
  id: z.string(),
  reasonText: z.string(),
  requestedAt: z.date(),
  requestedBy: z.string(),
  requestedSpecialty: z.string(),
  responseDocumentId: z.string().nullable(),
  status: z.string(),
});

const createInterconsultationSchema = z.object({
  encounterId: nonEmptyStringSchema,
  reasonText: nonEmptyStringSchema,
  requestedAt: z.coerce.date(),
  requestedBy: nonEmptyStringSchema,
  requestedSpecialty: nonEmptyStringSchema,
  status: nonEmptyStringSchema.default("requested"),
});

const listInterconsultationsSchema = z.object({
  encounterId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(["requestedAt"]).default("requestedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  status: z.string().min(1).optional(),
});

const respondInterconsultationSchema = z.object({
  id: nonEmptyStringSchema,
  responseDocumentId: optionalNullableStringSchema,
  status: nonEmptyStringSchema,
});

const listResponseSchema = z.object({
  items: z.array(z.unknown()),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

function throwCreateError(recordName: string): never {
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    message: `Failed to create ${recordName}.`,
  });
}

const createInterconsultationProcedure = protectedProcedure
  .input(createInterconsultationSchema)
  .output(interconsultationSchema)
  .handler(async ({ context, input }) => {
    const [created] = await context.db
      .insert(interconsultation)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return created ?? throwCreateError("interconsultation");
  });

const listInterconsultationsProcedure = protectedProcedure
  .input(listInterconsultationsSchema)
  .output(listResponseSchema)
  .handler(async ({ context, input }) => {
    const filters = [
      input.encounterId
        ? eq(interconsultation.encounterId, input.encounterId)
        : undefined,
      input.status ? eq(interconsultation.status, input.status) : undefined,
    ].filter((filter) => filter !== undefined);

    const where = filters.length > 0 ? and(...filters) : undefined;
    const orderBy =
      input.sortDirection === "asc"
        ? asc(interconsultation.requestedAt)
        : desc(interconsultation.requestedAt);

    const [items, totalRows] = await Promise.all([
      context.db
        .select()
        .from(interconsultation)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db
        .select({ value: count() })
        .from(interconsultation)
        .where(where),
    ]);

    return {
      items,
      limit: input.limit,
      offset: input.offset,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

const respondInterconsultationProcedure = protectedProcedure
  .input(respondInterconsultationSchema)
  .output(interconsultationSchema)
  .handler(async ({ context, input }) => {
    const { id, ...data } = input;

    const [updated] = await context.db
      .update(interconsultation)
      .set(data)
      .where(eq(interconsultation.id, id))
      .returning();

    if (!updated) {
      throw new ORPCError("NOT_FOUND", {
        message: "Interconsultation not found.",
      });
    }

    return updated;
  });

export interface InterconsultationsRouter extends Record<string, AnyRouter> {
  create: typeof createInterconsultationProcedure;
  list: typeof listInterconsultationsProcedure;
  respond: typeof respondInterconsultationProcedure;
}

export const interconsultationsRouter: InterconsultationsRouter = {
  create: createInterconsultationProcedure,
  list: listInterconsultationsProcedure,
  respond: respondInterconsultationProcedure,
};
