import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { encounter } from "@wellfit-emr/db/schema/clinical";
import { and, asc, count, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const nonEmptyStringSchema = z.string().min(1);
const optionalNullableStringSchema = z.string().min(1).nullable().optional();

const encounterSchema = z.object({
  admissionSource: z.string().nullable(),
  careModality: z.string(),
  createdAt: z.date(),
  encounterClass: z.string(),
  endedAt: z.date().nullable(),
  id: z.string(),
  patientId: z.string(),
  reasonForVisit: z.string(),
  serviceUnitId: z.string(),
  siteId: z.string(),
  startedAt: z.date(),
  status: z.string(),
  updatedAt: z.date(),
  vidaCode: z.string().nullable(),
});

const createEncounterSchema = z.object({
  admissionSource: optionalNullableStringSchema,
  careModality: nonEmptyStringSchema,
  encounterClass: nonEmptyStringSchema,
  patientId: nonEmptyStringSchema,
  reasonForVisit: nonEmptyStringSchema,
  serviceUnitId: nonEmptyStringSchema,
  siteId: nonEmptyStringSchema,
  startedAt: z.coerce.date(),
  status: nonEmptyStringSchema.default("in-progress"),
  vidaCode: optionalNullableStringSchema,
});

const updateEncounterSchema = createEncounterSchema.partial().extend({
  id: nonEmptyStringSchema,
  endedAt: z.coerce.date().nullable().optional(),
});

const getEncounterSchema = z.object({
  id: nonEmptyStringSchema,
});

const listEncountersSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  patientId: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  siteId: z.string().min(1).optional(),
  sortBy: z.enum(["createdAt", "startedAt", "updatedAt"]).default("startedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  status: z.string().min(1).optional(),
});

const closeEncounterSchema = z.object({
  endedAt: z.coerce.date(),
  id: nonEmptyStringSchema,
  status: nonEmptyStringSchema.default("finished"),
});

const listEncountersResponseSchema = z.object({
  encounters: z.array(encounterSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

const createEncounterProcedure = protectedProcedure
  .input(createEncounterSchema)
  .output(encounterSchema)
  .handler(async ({ context, input }) => {
    const [createdEncounter] = await context.db
      .insert(encounter)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    if (!createdEncounter) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create encounter.",
      });
    }

    return createdEncounter;
  });

const getEncounterProcedure = protectedProcedure
  .input(getEncounterSchema)
  .output(encounterSchema)
  .handler(async ({ context, input }) => {
    const [foundEncounter] = await context.db
      .select()
      .from(encounter)
      .where(eq(encounter.id, input.id))
      .limit(1);

    if (!foundEncounter) {
      throw new ORPCError("NOT_FOUND", {
        message: "Encounter not found.",
      });
    }

    return foundEncounter;
  });

const listEncountersProcedure = protectedProcedure
  .input(listEncountersSchema)
  .output(listEncountersResponseSchema)
  .handler(async ({ context, input }) => {
    const filters = [
      input.patientId ? eq(encounter.patientId, input.patientId) : undefined,
      input.siteId ? eq(encounter.siteId, input.siteId) : undefined,
      input.status ? eq(encounter.status, input.status) : undefined,
      input.search
        ? or(
            like(encounter.reasonForVisit, `%${input.search}%`),
            like(encounter.vidaCode, `%${input.search}%`)
          )
        : undefined,
    ].filter((filter) => filter !== undefined);
    const where = filters.length > 0 ? and(...filters) : undefined;
    const sortColumn = encounter[input.sortBy];
    const orderBy =
      input.sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [encounters, totalRows] = await Promise.all([
      context.db
        .select()
        .from(encounter)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(encounter).where(where),
    ]);

    return {
      encounters,
      limit: input.limit,
      offset: input.offset,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

const updateEncounterProcedure = protectedProcedure
  .input(updateEncounterSchema)
  .output(encounterSchema)
  .handler(async ({ context, input }) => {
    const { id, ...data } = input;

    if (Object.keys(data).length === 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: "No encounter fields were provided to update.",
      });
    }

    const [updatedEncounter] = await context.db
      .update(encounter)
      .set(data)
      .where(eq(encounter.id, id))
      .returning();

    if (!updatedEncounter) {
      throw new ORPCError("NOT_FOUND", {
        message: "Encounter not found.",
      });
    }

    return updatedEncounter;
  });

const closeEncounterProcedure = protectedProcedure
  .input(closeEncounterSchema)
  .output(encounterSchema)
  .handler(async ({ context, input }) => {
    const [closedEncounter] = await context.db
      .update(encounter)
      .set({
        endedAt: input.endedAt,
        status: input.status,
      })
      .where(eq(encounter.id, input.id))
      .returning();

    if (!closedEncounter) {
      throw new ORPCError("NOT_FOUND", {
        message: "Encounter not found.",
      });
    }

    return closedEncounter;
  });

export interface EncountersRouter extends Record<string, AnyRouter> {
  close: typeof closeEncounterProcedure;
  create: typeof createEncounterProcedure;
  get: typeof getEncounterProcedure;
  list: typeof listEncountersProcedure;
  update: typeof updateEncounterProcedure;
}

export const encountersRouter: EncountersRouter = {
  close: closeEncounterProcedure,
  create: createEncounterProcedure,
  get: getEncounterProcedure,
  list: listEncountersProcedure,
  update: updateEncounterProcedure,
};
