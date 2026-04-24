import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { patient } from "@wellfit-emr/db/schema/clinical";
import { asc, count, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const nonEmptyStringSchema = z.string().min(1);
const optionalNullableStringSchema = z.string().min(1).nullable().optional();

const patientSchema = z.object({
  birthDate: z.date(),
  createdAt: z.date(),
  deceasedAt: z.date().nullable(),
  firstName: z.string(),
  genderIdentity: z.string().nullable(),
  id: z.string(),
  lastName1: z.string(),
  lastName2: z.string().nullable(),
  middleName: z.string().nullable(),
  primaryDocumentNumber: z.string(),
  primaryDocumentType: z.string(),
  sexAtBirth: z.string(),
  updatedAt: z.date(),
});

const createPatientSchema = z.object({
  birthDate: z.coerce.date(),
  deceasedAt: z.coerce.date().nullable().optional(),
  firstName: nonEmptyStringSchema,
  genderIdentity: optionalNullableStringSchema,
  lastName1: nonEmptyStringSchema,
  lastName2: optionalNullableStringSchema,
  middleName: optionalNullableStringSchema,
  primaryDocumentNumber: nonEmptyStringSchema,
  primaryDocumentType: nonEmptyStringSchema,
  sexAtBirth: nonEmptyStringSchema,
});

const updatePatientSchema = createPatientSchema.partial().extend({
  id: nonEmptyStringSchema,
});

const getPatientSchema = z.object({
  id: nonEmptyStringSchema,
});

const listPatientsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  search: z.string().min(1).optional(),
  sortBy: z
    .enum(["createdAt", "birthDate", "firstName", "lastName1"])
    .default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

const listPatientsResponseSchema = z.object({
  limit: z.number(),
  offset: z.number(),
  patients: z.array(patientSchema),
  total: z.number(),
});

const createPatientProcedure = protectedProcedure
  .input(createPatientSchema)
  .output(patientSchema)
  .handler(async ({ context, input }) => {
    const [createdPatient] = await context.db
      .insert(patient)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    if (!createdPatient) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create patient.",
      });
    }

    return createdPatient;
  });

const getPatientProcedure = protectedProcedure
  .input(getPatientSchema)
  .output(patientSchema)
  .handler(async ({ context, input }) => {
    const [foundPatient] = await context.db
      .select()
      .from(patient)
      .where(eq(patient.id, input.id))
      .limit(1);

    if (!foundPatient) {
      throw new ORPCError("NOT_FOUND", {
        message: "Patient not found.",
      });
    }

    return foundPatient;
  });

const listPatientsProcedure = protectedProcedure
  .input(listPatientsSchema)
  .output(listPatientsResponseSchema)
  .handler(async ({ context, input }) => {
    const where = input.search
      ? or(
          like(patient.primaryDocumentNumber, `%${input.search}%`),
          like(patient.firstName, `%${input.search}%`),
          like(patient.lastName1, `%${input.search}%`),
          like(patient.lastName2, `%${input.search}%`)
        )
      : undefined;
    const sortColumn = patient[input.sortBy];
    const orderBy =
      input.sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [patients, totalRows] = await Promise.all([
      context.db
        .select()
        .from(patient)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(patient).where(where),
    ]);

    return {
      limit: input.limit,
      offset: input.offset,
      patients,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

const updatePatientProcedure = protectedProcedure
  .input(updatePatientSchema)
  .output(patientSchema)
  .handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const hasUpdates = Object.keys(data).length > 0;

    if (!hasUpdates) {
      throw new ORPCError("BAD_REQUEST", {
        message: "No patient fields were provided to update.",
      });
    }

    const [updatedPatient] = await context.db
      .update(patient)
      .set(data)
      .where(eq(patient.id, id))
      .returning();

    if (!updatedPatient) {
      throw new ORPCError("NOT_FOUND", {
        message: "Patient not found.",
      });
    }

    return updatedPatient;
  });

export interface PatientsRouter extends Record<string, AnyRouter> {
  create: typeof createPatientProcedure;
  get: typeof getPatientProcedure;
  list: typeof listPatientsProcedure;
  update: typeof updatePatientProcedure;
}

export const patientsRouter: PatientsRouter = {
  create: createPatientProcedure,
  get: getPatientProcedure,
  list: listPatientsProcedure,
  update: updatePatientProcedure,
};
