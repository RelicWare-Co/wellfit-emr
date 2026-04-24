import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import {
  medicationAdministration,
  medicationOrder,
} from "@wellfit-emr/db/schema/clinical";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const nonEmptyStringSchema = z.string().min(1);
const optionalNullableStringSchema = z.string().min(1).nullable().optional();
const optionalDateSchema = z.coerce.date().nullable().optional();

const medicationOrderSchema = z.object({
  atcCode: z.string().nullable(),
  concentration: z.string(),
  diagnosisId: z.string().nullable(),
  dosageForm: z.string(),
  dose: z.string(),
  doseUnit: z.string().nullable(),
  durationText: z.string(),
  encounterId: z.string(),
  frequencyText: z.string(),
  genericName: z.string(),
  id: z.string(),
  indications: z.string().nullable(),
  patientId: z.string(),
  prescriberId: z.string(),
  quantityTotal: z.string(),
  routeCode: z.string(),
  signedAt: z.date(),
  status: z.string(),
  validUntil: z.date().nullable(),
});

const createMedicationOrderSchema = z.object({
  atcCode: optionalNullableStringSchema,
  concentration: nonEmptyStringSchema,
  diagnosisId: optionalNullableStringSchema,
  dosageForm: nonEmptyStringSchema,
  dose: nonEmptyStringSchema,
  doseUnit: optionalNullableStringSchema,
  durationText: nonEmptyStringSchema,
  encounterId: nonEmptyStringSchema,
  frequencyText: nonEmptyStringSchema,
  genericName: nonEmptyStringSchema,
  indications: optionalNullableStringSchema,
  patientId: nonEmptyStringSchema,
  prescriberId: nonEmptyStringSchema,
  quantityTotal: nonEmptyStringSchema,
  routeCode: nonEmptyStringSchema,
  signedAt: z.coerce.date(),
  status: nonEmptyStringSchema.default("active"),
  validUntil: optionalDateSchema,
});

const listMedicationOrdersSchema = z.object({
  encounterId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  patientId: z.string().min(1).optional(),
  sortBy: z.enum(["signedAt"]).default("signedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

const medicationAdministrationSchema = z.object({
  administeredAt: z.date(),
  administeredBy: z.string(),
  doseAdministered: z.string().nullable(),
  id: z.string(),
  medicationOrderId: z.string(),
  reasonNotAdministered: z.string().nullable(),
  status: z.string(),
});

const createAdministrationSchema = z.object({
  administeredAt: z.coerce.date(),
  administeredBy: nonEmptyStringSchema,
  doseAdministered: optionalNullableStringSchema,
  medicationOrderId: nonEmptyStringSchema,
  reasonNotAdministered: optionalNullableStringSchema,
  status: nonEmptyStringSchema,
});

const listAdministrationsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  medicationOrderId: nonEmptyStringSchema,
  offset: z.number().int().min(0).default(0),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

const listMedicationOrdersResponseSchema = z.object({
  items: z.array(medicationOrderSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

const listAdministrationsResponseSchema = z.object({
  items: z.array(medicationAdministrationSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

function throwCreateError(recordName: string): never {
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    message: `Failed to create ${recordName}.`,
  });
}

const createMedicationOrderProcedure = protectedProcedure
  .input(createMedicationOrderSchema)
  .output(medicationOrderSchema)
  .handler(async ({ context, input }) => {
    const [created] = await context.db
      .insert(medicationOrder)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return created ?? throwCreateError("medication order");
  });

const listMedicationOrdersProcedure = protectedProcedure
  .input(listMedicationOrdersSchema)
  .output(listMedicationOrdersResponseSchema)
  .handler(async ({ context, input }) => {
    const filters = [
      input.patientId
        ? eq(medicationOrder.patientId, input.patientId)
        : undefined,
      input.encounterId
        ? eq(medicationOrder.encounterId, input.encounterId)
        : undefined,
    ].filter((filter) => filter !== undefined);

    const where = filters.length > 0 ? and(...filters) : undefined;
    const orderBy =
      input.sortDirection === "asc"
        ? asc(medicationOrder.signedAt)
        : desc(medicationOrder.signedAt);

    const [items, totalRows] = await Promise.all([
      context.db
        .select()
        .from(medicationOrder)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(medicationOrder).where(where),
    ]);

    return {
      items,
      limit: input.limit,
      offset: input.offset,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

const createAdministrationProcedure = protectedProcedure
  .input(createAdministrationSchema)
  .output(medicationAdministrationSchema)
  .handler(async ({ context, input }) => {
    const [created] = await context.db
      .insert(medicationAdministration)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return created ?? throwCreateError("medication administration");
  });

const listAdministrationsProcedure = protectedProcedure
  .input(listAdministrationsSchema)
  .output(listAdministrationsResponseSchema)
  .handler(async ({ context, input }) => {
    const where = eq(
      medicationAdministration.medicationOrderId,
      input.medicationOrderId
    );
    const orderBy =
      input.sortDirection === "asc"
        ? asc(medicationAdministration.administeredAt)
        : desc(medicationAdministration.administeredAt);

    const [items, totalRows] = await Promise.all([
      context.db
        .select()
        .from(medicationAdministration)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db
        .select({ value: count() })
        .from(medicationAdministration)
        .where(where),
    ]);

    return {
      items,
      limit: input.limit,
      offset: input.offset,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

export interface MedicationOrdersRouter extends Record<string, AnyRouter> {
  create: typeof createMedicationOrderProcedure;
  createAdministration: typeof createAdministrationProcedure;
  list: typeof listMedicationOrdersProcedure;
  listAdministrations: typeof listAdministrationsProcedure;
}

export const medicationOrdersRouter: MedicationOrdersRouter = {
  create: createMedicationOrderProcedure,
  createAdministration: createAdministrationProcedure,
  list: listMedicationOrdersProcedure,
  listAdministrations: listAdministrationsProcedure,
};
