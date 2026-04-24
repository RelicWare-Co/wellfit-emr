import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import {
  organization,
  practitioner,
  serviceUnit,
  site,
} from "@wellfit-emr/db/schema/clinical";
import { and, asc, count, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const nonEmptyStringSchema = z.string().min(1);
const optionalNullableStringSchema = z.string().min(1).nullable().optional();

const organizationSchema = z.object({
  createdAt: z.date(),
  id: z.string(),
  name: z.string(),
  repsCode: z.string().nullable(),
  status: z.string(),
  taxId: z.string().nullable(),
  updatedAt: z.date(),
});

const siteSchema = z.object({
  address: z.string().nullable(),
  createdAt: z.date(),
  id: z.string(),
  municipalityCode: z.string().nullable(),
  name: z.string(),
  organizationId: z.string(),
  siteCode: z.string(),
  updatedAt: z.date(),
});

const serviceUnitSchema = z.object({
  careSetting: z.string(),
  createdAt: z.date(),
  id: z.string(),
  name: z.string(),
  serviceCode: z.string(),
  siteId: z.string(),
  updatedAt: z.date(),
});

const practitionerSchema = z.object({
  active: z.boolean(),
  createdAt: z.date(),
  documentNumber: z.string(),
  documentType: z.string(),
  fullName: z.string(),
  id: z.string(),
  rethusNumber: z.string().nullable(),
  updatedAt: z.date(),
});

const createOrganizationSchema = z.object({
  name: nonEmptyStringSchema,
  repsCode: optionalNullableStringSchema,
  status: nonEmptyStringSchema.default("active"),
  taxId: optionalNullableStringSchema,
});

const createSiteSchema = z.object({
  address: optionalNullableStringSchema,
  municipalityCode: optionalNullableStringSchema,
  name: nonEmptyStringSchema,
  organizationId: nonEmptyStringSchema,
  siteCode: nonEmptyStringSchema,
});

const createServiceUnitSchema = z.object({
  careSetting: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  serviceCode: nonEmptyStringSchema,
  siteId: nonEmptyStringSchema,
});

const createPractitionerSchema = z.object({
  active: z.boolean().default(true),
  documentNumber: nonEmptyStringSchema,
  documentType: nonEmptyStringSchema,
  fullName: nonEmptyStringSchema,
  rethusNumber: optionalNullableStringSchema,
});

const listFacilitiesSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  search: z.string().min(1).optional(),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

const listSitesSchema = listFacilitiesSchema.extend({
  organizationId: z.string().min(1).optional(),
});

const listServiceUnitsSchema = listFacilitiesSchema.extend({
  siteId: z.string().min(1).optional(),
});

const listOrganizationsResponseSchema = z.object({
  limit: z.number(),
  offset: z.number(),
  organizations: z.array(organizationSchema),
  total: z.number(),
});

const listSitesResponseSchema = z.object({
  limit: z.number(),
  offset: z.number(),
  sites: z.array(siteSchema),
  total: z.number(),
});

const listServiceUnitsResponseSchema = z.object({
  limit: z.number(),
  offset: z.number(),
  serviceUnits: z.array(serviceUnitSchema),
  total: z.number(),
});

const listPractitionersResponseSchema = z.object({
  limit: z.number(),
  offset: z.number(),
  practitioners: z.array(practitionerSchema),
  total: z.number(),
});

function throwCreateError(recordName: string): never {
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    message: `Failed to create ${recordName}.`,
  });
}

const createOrganizationProcedure = protectedProcedure
  .input(createOrganizationSchema)
  .output(organizationSchema)
  .handler(async ({ context, input }) => {
    const [createdOrganization] = await context.db
      .insert(organization)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return createdOrganization ?? throwCreateError("organization");
  });

const listOrganizationsProcedure = protectedProcedure
  .input(listFacilitiesSchema)
  .output(listOrganizationsResponseSchema)
  .handler(async ({ context, input }) => {
    const where = input.search
      ? or(
          like(organization.name, `%${input.search}%`),
          like(organization.repsCode, `%${input.search}%`),
          like(organization.taxId, `%${input.search}%`)
        )
      : undefined;
    const orderBy =
      input.sortDirection === "asc"
        ? asc(organization.name)
        : desc(organization.name);
    const [organizations, totalRows] = await Promise.all([
      context.db
        .select()
        .from(organization)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(organization).where(where),
    ]);

    return {
      limit: input.limit,
      offset: input.offset,
      organizations,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

const createSiteProcedure = protectedProcedure
  .input(createSiteSchema)
  .output(siteSchema)
  .handler(async ({ context, input }) => {
    const [createdSite] = await context.db
      .insert(site)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return createdSite ?? throwCreateError("site");
  });

const listSitesProcedure = protectedProcedure
  .input(listSitesSchema)
  .output(listSitesResponseSchema)
  .handler(async ({ context, input }) => {
    const filters = [
      input.organizationId
        ? eq(site.organizationId, input.organizationId)
        : undefined,
      input.search
        ? or(
            like(site.name, `%${input.search}%`),
            like(site.siteCode, `%${input.search}%`),
            like(site.address, `%${input.search}%`),
            like(site.municipalityCode, `%${input.search}%`)
          )
        : undefined,
    ].filter((filter) => filter !== undefined);
    const where = filters.length > 0 ? and(...filters) : undefined;
    const orderBy =
      input.sortDirection === "asc" ? asc(site.name) : desc(site.name);
    const [sites, totalRows] = await Promise.all([
      context.db
        .select()
        .from(site)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(site).where(where),
    ]);

    return {
      limit: input.limit,
      offset: input.offset,
      sites,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

const createServiceUnitProcedure = protectedProcedure
  .input(createServiceUnitSchema)
  .output(serviceUnitSchema)
  .handler(async ({ context, input }) => {
    const [createdServiceUnit] = await context.db
      .insert(serviceUnit)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return createdServiceUnit ?? throwCreateError("service unit");
  });

const listServiceUnitsProcedure = protectedProcedure
  .input(listServiceUnitsSchema)
  .output(listServiceUnitsResponseSchema)
  .handler(async ({ context, input }) => {
    const filters = [
      input.siteId ? eq(serviceUnit.siteId, input.siteId) : undefined,
      input.search
        ? or(
            like(serviceUnit.name, `%${input.search}%`),
            like(serviceUnit.serviceCode, `%${input.search}%`),
            like(serviceUnit.careSetting, `%${input.search}%`)
          )
        : undefined,
    ].filter((filter) => filter !== undefined);
    const where = filters.length > 0 ? and(...filters) : undefined;
    const orderBy =
      input.sortDirection === "asc"
        ? asc(serviceUnit.name)
        : desc(serviceUnit.name);
    const [serviceUnits, totalRows] = await Promise.all([
      context.db
        .select()
        .from(serviceUnit)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(serviceUnit).where(where),
    ]);

    return {
      limit: input.limit,
      offset: input.offset,
      serviceUnits,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

const createPractitionerProcedure = protectedProcedure
  .input(createPractitionerSchema)
  .output(practitionerSchema)
  .handler(async ({ context, input }) => {
    const [createdPractitioner] = await context.db
      .insert(practitioner)
      .values({
        ...input,
        id: crypto.randomUUID(),
      })
      .returning();

    return createdPractitioner ?? throwCreateError("practitioner");
  });

const listPractitionersProcedure = protectedProcedure
  .input(listFacilitiesSchema)
  .output(listPractitionersResponseSchema)
  .handler(async ({ context, input }) => {
    const where = input.search
      ? or(
          like(practitioner.fullName, `%${input.search}%`),
          like(practitioner.documentNumber, `%${input.search}%`),
          like(practitioner.rethusNumber, `%${input.search}%`)
        )
      : undefined;
    const orderBy =
      input.sortDirection === "asc"
        ? asc(practitioner.fullName)
        : desc(practitioner.fullName);
    const [practitioners, totalRows] = await Promise.all([
      context.db
        .select()
        .from(practitioner)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(practitioner).where(where),
    ]);

    return {
      limit: input.limit,
      offset: input.offset,
      practitioners,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

export interface FacilitiesRouter extends Record<string, AnyRouter> {
  createOrganization: typeof createOrganizationProcedure;
  createPractitioner: typeof createPractitionerProcedure;
  createServiceUnit: typeof createServiceUnitProcedure;
  createSite: typeof createSiteProcedure;
  listOrganizations: typeof listOrganizationsProcedure;
  listPractitioners: typeof listPractitionersProcedure;
  listServiceUnits: typeof listServiceUnitsProcedure;
  listSites: typeof listSitesProcedure;
}

export const facilitiesRouter: FacilitiesRouter = {
  createOrganization: createOrganizationProcedure,
  createPractitioner: createPractitionerProcedure,
  createServiceUnit: createServiceUnitProcedure,
  createSite: createSiteProcedure,
  listOrganizations: listOrganizationsProcedure,
  listPractitioners: listPractitionersProcedure,
  listServiceUnits: listServiceUnitsProcedure,
  listSites: listSitesProcedure,
};
