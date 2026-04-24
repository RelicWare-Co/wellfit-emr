import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { auditEvent } from "@wellfit-emr/db/schema/clinical";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const nonEmptyStringSchema = z.string().min(1);
const optionalNullableStringSchema = z.string().min(1).nullable().optional();

const auditEventSchema = z.object({
  actionCode: z.string(),
  channel: z.string(),
  encounterId: z.string().nullable(),
  entityId: z.string().nullable(),
  entityType: z.string(),
  id: z.number(),
  ipHash: z.string().nullable(),
  occurredAt: z.date(),
  patientId: z.string().nullable(),
  reasonCode: z.string().nullable(),
  resultCode: z.string(),
  userId: z.string(),
});

const createAuditEventSchema = z.object({
  actionCode: nonEmptyStringSchema,
  channel: nonEmptyStringSchema,
  encounterId: optionalNullableStringSchema,
  entityId: optionalNullableStringSchema,
  entityType: nonEmptyStringSchema,
  ipHash: optionalNullableStringSchema,
  occurredAt: z.coerce.date(),
  patientId: optionalNullableStringSchema,
  reasonCode: optionalNullableStringSchema,
  resultCode: nonEmptyStringSchema,
  userId: nonEmptyStringSchema,
});

const listAuditEventsSchema = z.object({
  actionCode: z.string().min(1).optional(),
  encounterId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  patientId: z.string().min(1).optional(),
  sortBy: z.enum(["occurredAt"]).default("occurredAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  userId: z.string().min(1).optional(),
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

const createAuditEventProcedure = protectedProcedure
  .input(createAuditEventSchema)
  .output(auditEventSchema)
  .handler(async ({ context, input }) => {
    const [created] = await context.db
      .insert(auditEvent)
      .values(input)
      .returning();

    return created ?? throwCreateError("audit event");
  });

const listAuditEventsProcedure = protectedProcedure
  .input(listAuditEventsSchema)
  .output(listResponseSchema)
  .handler(async ({ context, input }) => {
    const filters = [
      input.patientId ? eq(auditEvent.patientId, input.patientId) : undefined,
      input.encounterId
        ? eq(auditEvent.encounterId, input.encounterId)
        : undefined,
      input.userId ? eq(auditEvent.userId, input.userId) : undefined,
      input.actionCode
        ? eq(auditEvent.actionCode, input.actionCode)
        : undefined,
    ].filter((filter) => filter !== undefined);

    const where = filters.length > 0 ? and(...filters) : undefined;
    const orderBy =
      input.sortDirection === "asc"
        ? asc(auditEvent.occurredAt)
        : desc(auditEvent.occurredAt);

    const [items, totalRows] = await Promise.all([
      context.db
        .select()
        .from(auditEvent)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(auditEvent).where(where),
    ]);

    return {
      items,
      limit: input.limit,
      offset: input.offset,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

export interface AuditEventsRouter extends Record<string, AnyRouter> {
  create: typeof createAuditEventProcedure;
  list: typeof listAuditEventsProcedure;
}

export const auditEventsRouter: AuditEventsRouter = {
  create: createAuditEventProcedure,
  list: listAuditEventsProcedure,
};
