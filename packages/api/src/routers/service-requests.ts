import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import {
  diagnosticReport,
  serviceRequest,
} from "@wellfit-emr/db/schema/clinical";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const nonEmptyStringSchema = z.string().min(1);
const optionalNullableStringSchema = z.string().min(1).nullable().optional();

const serviceRequestSchema = z.object({
  encounterId: z.string(),
  id: z.string(),
  patientId: z.string(),
  priority: z.string(),
  requestCode: z.string(),
  requestType: z.string(),
  requestedAt: z.date(),
  requestedBy: z.string(),
  status: z.string(),
});

const createServiceRequestSchema = z.object({
  encounterId: nonEmptyStringSchema,
  patientId: nonEmptyStringSchema,
  priority: nonEmptyStringSchema,
  requestCode: nonEmptyStringSchema,
  requestType: nonEmptyStringSchema,
  requestedAt: z.coerce.date(),
  requestedBy: nonEmptyStringSchema,
  status: nonEmptyStringSchema.default("active"),
});

const listServiceRequestsSchema = z.object({
  encounterId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  patientId: z.string().min(1).optional(),
  sortBy: z.enum(["requestedAt"]).default("requestedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

const diagnosticReportSchema = z.object({
  conclusionText: z.string().nullable(),
  encounterId: z.string(),
  id: z.string(),
  issuedAt: z.date(),
  performerOrgId: z.string().nullable(),
  reportType: z.string(),
  requestId: z.string(),
  status: z.string(),
});

const createDiagnosticReportSchema = z.object({
  conclusionText: optionalNullableStringSchema,
  encounterId: nonEmptyStringSchema,
  issuedAt: z.coerce.date(),
  performerOrgId: optionalNullableStringSchema,
  reportType: nonEmptyStringSchema,
  requestId: nonEmptyStringSchema,
  status: nonEmptyStringSchema.default("final"),
});

const getDiagnosticReportSchema = z.object({
  requestId: nonEmptyStringSchema,
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

const createServiceRequestProcedure = protectedProcedure
  .input(createServiceRequestSchema)
  .output(serviceRequestSchema)
  .handler(async ({ context, input }) => {
    const [created] = await context.db
      .insert(serviceRequest)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return created ?? throwCreateError("service request");
  });

const listServiceRequestsProcedure = protectedProcedure
  .input(listServiceRequestsSchema)
  .output(listResponseSchema)
  .handler(async ({ context, input }) => {
    const filters = [
      input.patientId
        ? eq(serviceRequest.patientId, input.patientId)
        : undefined,
      input.encounterId
        ? eq(serviceRequest.encounterId, input.encounterId)
        : undefined,
    ].filter((filter) => filter !== undefined);

    const where = filters.length > 0 ? and(...filters) : undefined;
    const orderBy =
      input.sortDirection === "asc"
        ? asc(serviceRequest.requestedAt)
        : desc(serviceRequest.requestedAt);

    const [items, totalRows] = await Promise.all([
      context.db
        .select()
        .from(serviceRequest)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(serviceRequest).where(where),
    ]);

    return {
      items,
      limit: input.limit,
      offset: input.offset,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

const createDiagnosticReportProcedure = protectedProcedure
  .input(createDiagnosticReportSchema)
  .output(diagnosticReportSchema)
  .handler(async ({ context, input }) => {
    const [created] = await context.db
      .insert(diagnosticReport)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return created ?? throwCreateError("diagnostic report");
  });

const getDiagnosticReportProcedure = protectedProcedure
  .input(getDiagnosticReportSchema)
  .output(diagnosticReportSchema)
  .handler(async ({ context, input }) => {
    const [found] = await context.db
      .select()
      .from(diagnosticReport)
      .where(eq(diagnosticReport.requestId, input.requestId))
      .limit(1);

    if (!found) {
      throw new ORPCError("NOT_FOUND", {
        message: "Diagnostic report not found.",
      });
    }

    return found;
  });

export interface ServiceRequestsRouter extends Record<string, AnyRouter> {
  create: typeof createServiceRequestProcedure;
  createReport: typeof createDiagnosticReportProcedure;
  getReport: typeof getDiagnosticReportProcedure;
  list: typeof listServiceRequestsProcedure;
}

export const serviceRequestsRouter: ServiceRequestsRouter = {
  create: createServiceRequestProcedure,
  createReport: createDiagnosticReportProcedure,
  getReport: getDiagnosticReportProcedure,
  list: listServiceRequestsProcedure,
};
