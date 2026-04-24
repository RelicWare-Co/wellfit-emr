import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import {
  clinicalDocument,
  clinicalDocumentVersion,
  documentSection,
} from "@wellfit-emr/db/schema/clinical";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const nonEmptyStringSchema = z.string().min(1);
const optionalNullableStringSchema = z.string().min(1).nullable().optional();

const sectionSchema = z.object({
  id: z.string(),
  documentVersionId: z.string(),
  sectionCode: z.string(),
  sectionOrder: z.number(),
  sectionPayloadJson: z.record(z.string(), z.any()),
});

const documentVersionSchema = z.object({
  id: z.string(),
  authorPractitionerId: z.string(),
  authorUserId: z.string(),
  correctionReason: z.string().nullable(),
  createdAt: z.date(),
  documentId: z.string(),
  hashSha256: z.string(),
  isCurrent: z.boolean(),
  payloadJson: z.record(z.string(), z.any()),
  signedAt: z.date().nullable(),
  signedByUserId: z.string().nullable(),
  supersedesVersionId: z.string().nullable(),
  textRendered: z.string().nullable(),
  versionNo: z.number(),
});

const documentSchema = z.object({
  createdAt: z.date(),
  createdBy: z.string(),
  currentVersionId: z.string().nullable(),
  documentType: z.string(),
  encounterId: z.string(),
  id: z.string(),
  patientId: z.string(),
  status: z.string(),
});

const documentWithVersionSchema = z.object({
  document: documentSchema,
  sections: z.array(sectionSchema),
  version: documentVersionSchema.nullable(),
});

const createDocumentSchema = z.object({
  authorPractitionerId: nonEmptyStringSchema,
  documentType: nonEmptyStringSchema,
  encounterId: nonEmptyStringSchema,
  patientId: nonEmptyStringSchema,
  payloadJson: z.record(z.string(), z.any()),
  sections: z.array(
    z.object({
      sectionCode: nonEmptyStringSchema,
      sectionOrder: z.number().int(),
      sectionPayloadJson: z.record(z.string(), z.any()),
    })
  ),
  textRendered: optionalNullableStringSchema,
});

const getDocumentSchema = z.object({
  id: nonEmptyStringSchema,
});

const listDocumentsSchema = z.object({
  encounterId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  patientId: z.string().min(1).optional(),
  sortBy: z.enum(["createdAt"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

const signDocumentSchema = z.object({
  id: nonEmptyStringSchema,
});

const correctDocumentSchema = z.object({
  authorPractitionerId: nonEmptyStringSchema,
  correctionReason: nonEmptyStringSchema,
  id: nonEmptyStringSchema,
  payloadJson: z.record(z.string(), z.any()),
  sections: z.array(
    z.object({
      sectionCode: nonEmptyStringSchema,
      sectionOrder: z.number().int(),
      sectionPayloadJson: z.record(z.string(), z.any()),
    })
  ),
  textRendered: optionalNullableStringSchema,
});

const listDocumentsResponseSchema = z.object({
  documents: z.array(documentSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

async function computeSha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function throwCreateError(recordName: string): never {
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    message: `Failed to create ${recordName}.`,
  });
}

const createDocumentProcedure = protectedProcedure
  .input(createDocumentSchema)
  .output(documentSchema)
  .handler(async ({ context, input }) => {
    const { sections, ...documentInput } = input;
    const userId = context.session.user.id;
    const payloadString = JSON.stringify(documentInput.payloadJson);
    const hash = await computeSha256(payloadString);

    const created = await context.db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(clinicalDocument)
        .values({
          id: crypto.randomUUID(),
          patientId: documentInput.patientId,
          encounterId: documentInput.encounterId,
          documentType: documentInput.documentType,
          status: "draft",
          currentVersionId: null,
          createdBy: userId,
        })
        .returning();

      if (!doc) {
        throwCreateError("clinical document");
      }

      const [version] = await tx
        .insert(clinicalDocumentVersion)
        .values({
          id: crypto.randomUUID(),
          documentId: doc.id,
          versionNo: 1,
          authorPractitionerId: documentInput.authorPractitionerId,
          authorUserId: userId,
          payloadJson: documentInput.payloadJson,
          textRendered: documentInput.textRendered ?? null,
          hashSha256: hash,
          isCurrent: true,
        })
        .returning();

      if (!version) {
        throwCreateError("document version");
      }

      if (sections.length > 0) {
        await tx.insert(documentSection).values(
          sections.map((section) => ({
            id: crypto.randomUUID(),
            ...section,
            documentVersionId: version.id,
          }))
        );
      }

      const [updatedDoc] = await tx
        .update(clinicalDocument)
        .set({ currentVersionId: version.id })
        .where(eq(clinicalDocument.id, doc.id))
        .returning();

      return updatedDoc ?? throwCreateError("clinical document");
    });

    return created;
  });

const getDocumentProcedure = protectedProcedure
  .input(getDocumentSchema)
  .output(documentWithVersionSchema)
  .handler(async ({ context, input }) => {
    const [doc] = await context.db
      .select()
      .from(clinicalDocument)
      .where(eq(clinicalDocument.id, input.id))
      .limit(1);

    if (!doc) {
      throw new ORPCError("NOT_FOUND", {
        message: "Clinical document not found.",
      });
    }

    let version: z.infer<typeof documentVersionSchema> | null = null;
    let sections: z.infer<typeof sectionSchema>[] = [];

    if (doc.currentVersionId) {
      const [v] = await context.db
        .select()
        .from(clinicalDocumentVersion)
        .where(eq(clinicalDocumentVersion.id, doc.currentVersionId))
        .limit(1);

      if (v) {
        version = v;
        sections = await context.db
          .select()
          .from(documentSection)
          .where(eq(documentSection.documentVersionId, v.id))
          .orderBy(asc(documentSection.sectionOrder));
      }
    }

    return { document: doc, version, sections };
  });

const listDocumentsProcedure = protectedProcedure
  .input(listDocumentsSchema)
  .output(listDocumentsResponseSchema)
  .handler(async ({ context, input }) => {
    const filters = [
      input.patientId
        ? eq(clinicalDocument.patientId, input.patientId)
        : undefined,
      input.encounterId
        ? eq(clinicalDocument.encounterId, input.encounterId)
        : undefined,
    ].filter((filter) => filter !== undefined);

    const where = filters.length > 0 ? and(...filters) : undefined;
    const orderBy =
      input.sortDirection === "asc"
        ? asc(clinicalDocument.createdAt)
        : desc(clinicalDocument.createdAt);

    const [documents, totalRows] = await Promise.all([
      context.db
        .select()
        .from(clinicalDocument)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(clinicalDocument).where(where),
    ]);

    return {
      documents,
      limit: input.limit,
      offset: input.offset,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

const signDocumentProcedure = protectedProcedure
  .input(signDocumentSchema)
  .output(documentVersionSchema)
  .handler(async ({ context, input }) => {
    const [doc] = await context.db
      .select()
      .from(clinicalDocument)
      .where(eq(clinicalDocument.id, input.id))
      .limit(1);

    if (!doc) {
      throw new ORPCError("NOT_FOUND", {
        message: "Clinical document not found.",
      });
    }

    if (!doc.currentVersionId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Document has no version to sign.",
      });
    }

    const [version] = await context.db
      .update(clinicalDocumentVersion)
      .set({
        signedByUserId: context.session.user.id,
        signedAt: new Date(),
      })
      .where(
        and(
          eq(clinicalDocumentVersion.id, doc.currentVersionId),
          eq(clinicalDocumentVersion.isCurrent, true)
        )
      )
      .returning();

    if (!version) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to sign document.",
      });
    }

    return version;
  });

const correctDocumentProcedure = protectedProcedure
  .input(correctDocumentSchema)
  .output(documentVersionSchema)
  .handler(async ({ context, input }) => {
    const [doc] = await context.db
      .select()
      .from(clinicalDocument)
      .where(eq(clinicalDocument.id, input.id))
      .limit(1);

    if (!doc) {
      throw new ORPCError("NOT_FOUND", {
        message: "Clinical document not found.",
      });
    }

    if (!doc.currentVersionId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Document has no version to correct.",
      });
    }

    const [currentVersion] = await context.db
      .select()
      .from(clinicalDocumentVersion)
      .where(
        and(
          eq(clinicalDocumentVersion.id, doc.currentVersionId),
          eq(clinicalDocumentVersion.isCurrent, true)
        )
      )
      .limit(1);

    if (!currentVersion) {
      throw new ORPCError("NOT_FOUND", {
        message: "Current document version not found.",
      });
    }

    const userId = context.session.user.id;
    const payloadString = JSON.stringify(input.payloadJson);
    const hash = await computeSha256(payloadString);

    const created = await context.db.transaction(async (tx) => {
      await tx
        .update(clinicalDocumentVersion)
        .set({ isCurrent: false })
        .where(eq(clinicalDocumentVersion.id, currentVersion.id));

      const [newVersion] = await tx
        .insert(clinicalDocumentVersion)
        .values({
          id: crypto.randomUUID(),
          documentId: doc.id,
          versionNo: currentVersion.versionNo + 1,
          supersedesVersionId: currentVersion.id,
          authorPractitionerId: input.authorPractitionerId,
          authorUserId: userId,
          payloadJson: input.payloadJson,
          textRendered: input.textRendered ?? null,
          hashSha256: hash,
          correctionReason: input.correctionReason,
          isCurrent: true,
        })
        .returning();

      if (!newVersion) {
        throwCreateError("document version");
      }

      if (input.sections.length > 0) {
        await tx.insert(documentSection).values(
          input.sections.map((section) => ({
            id: crypto.randomUUID(),
            ...section,
            documentVersionId: newVersion.id,
          }))
        );
      }

      await tx
        .update(clinicalDocument)
        .set({ currentVersionId: newVersion.id })
        .where(eq(clinicalDocument.id, doc.id));

      return newVersion;
    });

    return created;
  });

export interface ClinicalDocumentsRouter extends Record<string, AnyRouter> {
  correct: typeof correctDocumentProcedure;
  create: typeof createDocumentProcedure;
  get: typeof getDocumentProcedure;
  list: typeof listDocumentsProcedure;
  sign: typeof signDocumentProcedure;
}

export const clinicalDocumentsRouter: ClinicalDocumentsRouter = {
  correct: correctDocumentProcedure,
  create: createDocumentProcedure,
  get: getDocumentProcedure,
  list: listDocumentsProcedure,
  sign: signDocumentProcedure,
};
