import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import {
  consentRecord,
  dataDisclosureAuthorization,
} from "@wellfit-emr/db/schema/clinical";
import { asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const nonEmptyStringSchema = z.string().min(1);
const optionalNullableStringSchema = z.string().min(1).nullable().optional();
const optionalDateSchema = z.coerce.date().nullable().optional();

const consentSchema = z.object({
  consentType: z.string(),
  decision: z.string(),
  documentVersionId: z.string().nullable(),
  encounterId: z.string().nullable(),
  expiresAt: z.date().nullable(),
  grantedByPersonName: z.string(),
  id: z.string(),
  patientId: z.string(),
  procedureCode: z.string().nullable(),
  representativeRelationship: z.string().nullable(),
  revokedAt: z.date().nullable(),
  signedAt: z.date(),
});

const createConsentSchema = z.object({
  consentType: nonEmptyStringSchema,
  decision: nonEmptyStringSchema,
  documentVersionId: optionalNullableStringSchema,
  encounterId: optionalNullableStringSchema,
  expiresAt: optionalDateSchema,
  grantedByPersonName: nonEmptyStringSchema,
  patientId: nonEmptyStringSchema,
  procedureCode: optionalNullableStringSchema,
  representativeRelationship: optionalNullableStringSchema,
  signedAt: z.coerce.date(),
});

const listConsentsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  patientId: nonEmptyStringSchema,
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

const revokeConsentSchema = z.object({
  id: nonEmptyStringSchema,
  revokedAt: z.coerce.date(),
});

const dataDisclosureSchema = z.object({
  expiresAt: z.date().nullable(),
  grantedAt: z.date(),
  id: z.string(),
  legalBasis: z.string(),
  patientId: z.string(),
  purposeCode: z.string(),
  revokedAt: z.date().nullable(),
  scopeJson: z.record(z.string(), z.any()),
  thirdPartyName: z.string(),
});

const createDataDisclosureSchema = z.object({
  expiresAt: optionalDateSchema,
  grantedAt: z.coerce.date(),
  legalBasis: nonEmptyStringSchema,
  patientId: nonEmptyStringSchema,
  purposeCode: nonEmptyStringSchema,
  scopeJson: z.record(z.string(), z.any()),
  thirdPartyName: nonEmptyStringSchema,
});

const listDataDisclosuresSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  patientId: nonEmptyStringSchema,
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

const revokeDataDisclosureSchema = z.object({
  id: nonEmptyStringSchema,
  revokedAt: z.coerce.date(),
});

const listConsentsResponseSchema = z.object({
  items: z.array(consentSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

const listDataDisclosuresResponseSchema = z.object({
  items: z.array(dataDisclosureSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

function throwCreateError(recordName: string): never {
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    message: `Failed to create ${recordName}.`,
  });
}

const createConsentProcedure = protectedProcedure
  .input(createConsentSchema)
  .output(consentSchema)
  .handler(async ({ context, input }) => {
    const [created] = await context.db
      .insert(consentRecord)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return created ?? throwCreateError("consent record");
  });

const listConsentsProcedure = protectedProcedure
  .input(listConsentsSchema)
  .output(listConsentsResponseSchema)
  .handler(async ({ context, input }) => {
    const where = eq(consentRecord.patientId, input.patientId);
    const orderBy =
      input.sortDirection === "asc"
        ? asc(consentRecord.signedAt)
        : desc(consentRecord.signedAt);

    const [items, totalRows] = await Promise.all([
      context.db
        .select()
        .from(consentRecord)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(consentRecord).where(where),
    ]);

    return {
      items,
      limit: input.limit,
      offset: input.offset,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

const revokeConsentProcedure = protectedProcedure
  .input(revokeConsentSchema)
  .output(consentSchema)
  .handler(async ({ context, input }) => {
    const [updated] = await context.db
      .update(consentRecord)
      .set({ revokedAt: input.revokedAt })
      .where(eq(consentRecord.id, input.id))
      .returning();

    if (!updated) {
      throw new ORPCError("NOT_FOUND", {
        message: "Consent record not found.",
      });
    }

    return updated;
  });

const createDataDisclosureProcedure = protectedProcedure
  .input(createDataDisclosureSchema)
  .output(dataDisclosureSchema)
  .handler(async ({ context, input }) => {
    const [created] = await context.db
      .insert(dataDisclosureAuthorization)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return created ?? throwCreateError("data disclosure authorization");
  });

const listDataDisclosuresProcedure = protectedProcedure
  .input(listDataDisclosuresSchema)
  .output(listDataDisclosuresResponseSchema)
  .handler(async ({ context, input }) => {
    const where = eq(dataDisclosureAuthorization.patientId, input.patientId);
    const orderBy =
      input.sortDirection === "asc"
        ? asc(dataDisclosureAuthorization.grantedAt)
        : desc(dataDisclosureAuthorization.grantedAt);

    const [items, totalRows] = await Promise.all([
      context.db
        .select()
        .from(dataDisclosureAuthorization)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db
        .select({ value: count() })
        .from(dataDisclosureAuthorization)
        .where(where),
    ]);

    return {
      items,
      limit: input.limit,
      offset: input.offset,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

const revokeDataDisclosureProcedure = protectedProcedure
  .input(revokeDataDisclosureSchema)
  .output(dataDisclosureSchema)
  .handler(async ({ context, input }) => {
    const [updated] = await context.db
      .update(dataDisclosureAuthorization)
      .set({ revokedAt: input.revokedAt })
      .where(eq(dataDisclosureAuthorization.id, input.id))
      .returning();

    if (!updated) {
      throw new ORPCError("NOT_FOUND", {
        message: "Data disclosure authorization not found.",
      });
    }

    return updated;
  });

export interface ConsentsRouter extends Record<string, AnyRouter> {
  createConsent: typeof createConsentProcedure;
  createDataDisclosure: typeof createDataDisclosureProcedure;
  listConsents: typeof listConsentsProcedure;
  listDataDisclosures: typeof listDataDisclosuresProcedure;
  revokeConsent: typeof revokeConsentProcedure;
  revokeDataDisclosure: typeof revokeDataDisclosureProcedure;
}

export const consentsRouter: ConsentsRouter = {
  createConsent: createConsentProcedure,
  createDataDisclosure: createDataDisclosureProcedure,
  listConsents: listConsentsProcedure,
  listDataDisclosures: listDataDisclosuresProcedure,
  revokeConsent: revokeConsentProcedure,
  revokeDataDisclosure: revokeDataDisclosureProcedure,
};
