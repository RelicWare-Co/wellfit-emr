import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import {
  allergyIntolerance,
  diagnosis,
  observation,
  procedureRecord,
} from "@wellfit-emr/db/schema/clinical";
import type { AnyColumn } from "drizzle-orm";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const nonEmptyStringSchema = z.string().min(1);
const optionalNullableStringSchema = z.string().min(1).nullable().optional();

const diagnosisSchema = z.object({
  certainty: z.string().nullable(),
  code: z.string(),
  codeSystem: z.string(),
  description: z.string(),
  diagnosisType: z.string(),
  documentVersionId: z.string().nullable(),
  encounterId: z.string(),
  id: z.string(),
  onsetAt: z.date().nullable(),
  rank: z.number().nullable(),
});

const allergySchema = z.object({
  codeSystem: z.string(),
  criticality: z.string().nullable(),
  id: z.string(),
  patientId: z.string(),
  reactionText: z.string().nullable(),
  recordedAt: z.date(),
  recordedBy: z.string(),
  status: z.string(),
  substanceCode: z.string(),
});

const observationSchema = z.object({
  code: z.string().nullable(),
  codeSystem: z.string().nullable(),
  documentVersionId: z.string().nullable(),
  encounterId: z.string(),
  id: z.string(),
  observationType: z.string(),
  observedAt: z.date(),
  patientId: z.string(),
  status: z.string(),
  valueNum: z.number().nullable(),
  valueText: z.string().nullable(),
  valueUnit: z.string().nullable(),
});

const procedureSchema = z.object({
  cupsCode: z.string(),
  description: z.string(),
  encounterId: z.string(),
  id: z.string(),
  patientId: z.string(),
  performedAt: z.date().nullable(),
  performerId: z.string().nullable(),
  status: z.string(),
});

const createDiagnosisSchema = z.object({
  certainty: optionalNullableStringSchema,
  code: nonEmptyStringSchema,
  codeSystem: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  diagnosisType: nonEmptyStringSchema,
  documentVersionId: optionalNullableStringSchema,
  encounterId: nonEmptyStringSchema,
  onsetAt: z.coerce.date().nullable().optional(),
  rank: z.number().int().nullable().optional(),
});

const createAllergySchema = z.object({
  codeSystem: nonEmptyStringSchema,
  criticality: optionalNullableStringSchema,
  patientId: nonEmptyStringSchema,
  reactionText: optionalNullableStringSchema,
  recordedAt: z.coerce.date(),
  recordedBy: nonEmptyStringSchema,
  status: nonEmptyStringSchema,
  substanceCode: nonEmptyStringSchema,
});

const createObservationSchema = z.object({
  code: optionalNullableStringSchema,
  codeSystem: optionalNullableStringSchema,
  documentVersionId: optionalNullableStringSchema,
  encounterId: nonEmptyStringSchema,
  observationType: nonEmptyStringSchema,
  observedAt: z.coerce.date(),
  patientId: nonEmptyStringSchema,
  status: nonEmptyStringSchema,
  valueNum: z.number().nullable().optional(),
  valueText: optionalNullableStringSchema,
  valueUnit: optionalNullableStringSchema,
});

const createProcedureSchema = z.object({
  cupsCode: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  encounterId: nonEmptyStringSchema,
  patientId: nonEmptyStringSchema,
  performedAt: z.coerce.date().nullable().optional(),
  performerId: optionalNullableStringSchema,
  status: nonEmptyStringSchema,
});

const encounterListSchema = z.object({
  encounterId: nonEmptyStringSchema,
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

const patientListSchema = z.object({
  patientId: nonEmptyStringSchema,
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

function orderByDirection(column: AnyColumn, direction: "asc" | "desc") {
  return direction === "asc" ? asc(column) : desc(column);
}

function throwCreateError(recordName: string): never {
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    message: `Failed to create ${recordName}.`,
  });
}

const createDiagnosisProcedure = protectedProcedure
  .input(createDiagnosisSchema)
  .output(diagnosisSchema)
  .handler(async ({ context, input }) => {
    const [createdDiagnosis] = await context.db
      .insert(diagnosis)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return createdDiagnosis ?? throwCreateError("diagnosis");
  });

const listDiagnosesProcedure = protectedProcedure
  .input(encounterListSchema)
  .output(z.array(diagnosisSchema))
  .handler(({ context, input }) =>
    context.db
      .select()
      .from(diagnosis)
      .where(eq(diagnosis.encounterId, input.encounterId))
      .orderBy(orderByDirection(diagnosis.rank, input.sortDirection))
  );

const createAllergyProcedure = protectedProcedure
  .input(createAllergySchema)
  .output(allergySchema)
  .handler(async ({ context, input }) => {
    const [createdAllergy] = await context.db
      .insert(allergyIntolerance)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return createdAllergy ?? throwCreateError("allergy");
  });

const listAllergiesProcedure = protectedProcedure
  .input(patientListSchema)
  .output(z.array(allergySchema))
  .handler(({ context, input }) =>
    context.db
      .select()
      .from(allergyIntolerance)
      .where(eq(allergyIntolerance.patientId, input.patientId))
      .orderBy(
        orderByDirection(allergyIntolerance.recordedAt, input.sortDirection)
      )
  );

const createObservationProcedure = protectedProcedure
  .input(createObservationSchema)
  .output(observationSchema)
  .handler(async ({ context, input }) => {
    const [createdObservation] = await context.db
      .insert(observation)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return createdObservation ?? throwCreateError("observation");
  });

const listObservationsProcedure = protectedProcedure
  .input(encounterListSchema)
  .output(z.array(observationSchema))
  .handler(({ context, input }) =>
    context.db
      .select()
      .from(observation)
      .where(eq(observation.encounterId, input.encounterId))
      .orderBy(orderByDirection(observation.observedAt, input.sortDirection))
  );

const createProcedureProcedure = protectedProcedure
  .input(createProcedureSchema)
  .output(procedureSchema)
  .handler(async ({ context, input }) => {
    const [createdProcedure] = await context.db
      .insert(procedureRecord)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return createdProcedure ?? throwCreateError("procedure");
  });

const listProceduresProcedure = protectedProcedure
  .input(encounterListSchema)
  .output(z.array(procedureSchema))
  .handler(({ context, input }) =>
    context.db
      .select()
      .from(procedureRecord)
      .where(eq(procedureRecord.encounterId, input.encounterId))
      .orderBy(
        orderByDirection(procedureRecord.performedAt, input.sortDirection)
      )
  );

export interface ClinicalRecordsRouter extends Record<string, AnyRouter> {
  createAllergy: typeof createAllergyProcedure;
  createDiagnosis: typeof createDiagnosisProcedure;
  createObservation: typeof createObservationProcedure;
  createProcedure: typeof createProcedureProcedure;
  listAllergies: typeof listAllergiesProcedure;
  listDiagnoses: typeof listDiagnosesProcedure;
  listObservations: typeof listObservationsProcedure;
  listProcedures: typeof listProceduresProcedure;
}

export const clinicalRecordsRouter: ClinicalRecordsRouter = {
  createAllergy: createAllergyProcedure,
  createDiagnosis: createDiagnosisProcedure,
  createObservation: createObservationProcedure,
  createProcedure: createProcedureProcedure,
  listAllergies: listAllergiesProcedure,
  listDiagnoses: listDiagnosesProcedure,
  listObservations: listObservationsProcedure,
  listProcedures: listProceduresProcedure,
};
