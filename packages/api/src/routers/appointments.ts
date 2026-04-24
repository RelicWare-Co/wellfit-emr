import type { AnyRouter } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import { appointment } from "@wellfit-emr/db/schema/clinical";
import { and, asc, count, desc, eq, gte, like, lte, ne, or } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const nonEmptyStringSchema = z.string().min(1);
const optionalNullableStringSchema = z.string().min(1).nullable().optional();

const appointmentStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "cancelled",
  "completed",
  "no-show",
]);

const appointmentSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  practitionerId: z.string().nullable(),
  siteId: z.string(),
  serviceUnitId: z.string().nullable(),
  scheduledAt: z.date(),
  durationMinutes: z.number(),
  status: z.string(),
  reason: z.string(),
  notes: z.string().nullable(),
  encounterId: z.string().nullable(),
  createdBy: z.string(),
  cancelledAt: z.date().nullable(),
  cancelledReason: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const createAppointmentSchema = z.object({
  patientId: nonEmptyStringSchema,
  practitionerId: z.string().min(1).nullable().optional(),
  siteId: nonEmptyStringSchema,
  serviceUnitId: z.string().min(1).nullable().optional(),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  reason: nonEmptyStringSchema,
  notes: optionalNullableStringSchema,
});

const updateAppointmentSchema = z
  .object({
    durationMinutes: z.number().int().min(5).max(480).optional(),
    notes: optionalNullableStringSchema,
    patientId: nonEmptyStringSchema.optional(),
    practitionerId: z.string().min(1).nullable().optional(),
    reason: nonEmptyStringSchema.optional(),
    scheduledAt: z.coerce.date().optional(),
    serviceUnitId: z.string().min(1).nullable().optional(),
    siteId: nonEmptyStringSchema.optional(),
  })
  .extend({
    id: nonEmptyStringSchema,
  });

const getAppointmentSchema = z.object({
  id: nonEmptyStringSchema,
});

const cancelAppointmentSchema = z.object({
  id: nonEmptyStringSchema,
  cancelledReason: nonEmptyStringSchema,
});

const listAppointmentsSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(25),
  offset: z.number().int().min(0).default(0),
  patientId: z.string().min(1).optional(),
  practitionerId: z.string().min(1).optional(),
  siteId: z.string().min(1).optional(),
  status: appointmentStatusSchema.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  search: z.string().min(1).optional(),
  sortBy: z
    .enum(["scheduledAt", "createdAt", "updatedAt"])
    .default("scheduledAt"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

const listAppointmentsResponseSchema = z.object({
  appointments: z.array(appointmentSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

const checkConflictsSchema = z.object({
  practitionerId: nonEmptyStringSchema,
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  excludeAppointmentId: z.string().min(1).optional(),
});

const conflictSchema = z.object({
  appointmentId: z.string(),
  scheduledAt: z.date(),
  durationMinutes: z.number(),
  reason: z.string(),
});

const checkConflictsResponseSchema = z.object({
  hasConflict: z.boolean(),
  conflicts: z.array(conflictSchema),
});

function buildListWhere(input: z.infer<typeof listAppointmentsSchema>) {
  const conditions = [
    input.patientId ? eq(appointment.patientId, input.patientId) : undefined,
    input.practitionerId
      ? eq(appointment.practitionerId, input.practitionerId)
      : undefined,
    input.siteId ? eq(appointment.siteId, input.siteId) : undefined,
    input.status ? eq(appointment.status, input.status) : undefined,
    input.fromDate ? gte(appointment.scheduledAt, input.fromDate) : undefined,
    input.toDate ? lte(appointment.scheduledAt, input.toDate) : undefined,
    input.search
      ? or(
          like(appointment.reason, `%${input.search}%`),
          like(appointment.notes, `%${input.search}%`)
        )
      : undefined,
  ].filter((c) => c !== undefined);

  return conditions.length > 0 ? and(...conditions) : undefined;
}

const createAppointmentProcedure = protectedProcedure
  .input(createAppointmentSchema)
  .output(appointmentSchema)
  .handler(async ({ context, input }) => {
    const [created] = await context.db
      .insert(appointment)
      .values({
        ...input,
        id: crypto.randomUUID(),
        status: "scheduled",
        createdBy: context.session.user.id,
      })
      .returning();

    if (!created) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create appointment.",
      });
    }

    return created;
  });

const getAppointmentProcedure = protectedProcedure
  .input(getAppointmentSchema)
  .output(appointmentSchema)
  .handler(async ({ context, input }) => {
    const [found] = await context.db
      .select()
      .from(appointment)
      .where(eq(appointment.id, input.id))
      .limit(1);

    if (!found) {
      throw new ORPCError("NOT_FOUND", {
        message: "Appointment not found.",
      });
    }

    return found;
  });

const listAppointmentsProcedure = protectedProcedure
  .input(listAppointmentsSchema)
  .output(listAppointmentsResponseSchema)
  .handler(async ({ context, input }) => {
    const where = buildListWhere(input);
    const sortColumn = appointment[input.sortBy];
    const orderBy =
      input.sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [appointments, totalRows] = await Promise.all([
      context.db
        .select()
        .from(appointment)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset),
      context.db.select({ value: count() }).from(appointment).where(where),
    ]);

    return {
      appointments,
      limit: input.limit,
      offset: input.offset,
      total: totalRows.at(0)?.value ?? 0,
    };
  });

const updateAppointmentProcedure = protectedProcedure
  .input(updateAppointmentSchema)
  .output(appointmentSchema)
  .handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const hasUpdates = Object.values(data).some((v) => v !== undefined);

    if (!hasUpdates) {
      throw new ORPCError("BAD_REQUEST", {
        message: "No appointment fields were provided to update.",
      });
    }

    const [existing] = await context.db
      .select()
      .from(appointment)
      .where(eq(appointment.id, id))
      .limit(1);

    if (!existing) {
      throw new ORPCError("NOT_FOUND", {
        message: "Appointment not found.",
      });
    }

    if (existing.status === "cancelled" || existing.status === "completed") {
      throw new ORPCError("BAD_REQUEST", {
        message: `Cannot update a ${existing.status} appointment.`,
      });
    }

    const [updated] = await context.db
      .update(appointment)
      .set(data)
      .where(eq(appointment.id, id))
      .returning();

    if (!updated) {
      throw new ORPCError("NOT_FOUND", {
        message: "Appointment not found.",
      });
    }

    return updated;
  });

const cancelAppointmentProcedure = protectedProcedure
  .input(cancelAppointmentSchema)
  .output(appointmentSchema)
  .handler(async ({ context, input }) => {
    const [existing] = await context.db
      .select()
      .from(appointment)
      .where(eq(appointment.id, input.id))
      .limit(1);

    if (!existing) {
      throw new ORPCError("NOT_FOUND", {
        message: "Appointment not found.",
      });
    }

    if (existing.status === "cancelled") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Appointment is already cancelled.",
      });
    }

    if (existing.status === "completed") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Cannot cancel a completed appointment.",
      });
    }

    const [cancelled] = await context.db
      .update(appointment)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledReason: input.cancelledReason,
      })
      .where(eq(appointment.id, input.id))
      .returning();

    if (!cancelled) {
      throw new ORPCError("NOT_FOUND", {
        message: "Appointment not found.",
      });
    }

    return cancelled;
  });

const checkConflictsProcedure = protectedProcedure
  .input(checkConflictsSchema)
  .output(checkConflictsResponseSchema)
  .handler(async ({ context, input }) => {
    const requestedStart = input.scheduledAt.getTime();
    const requestedEnd = requestedStart + input.durationMinutes * 60_000;

    const existingAppointments = await context.db
      .select()
      .from(appointment)
      .where(
        and(
          eq(appointment.practitionerId, input.practitionerId),
          eq(appointment.status, "scheduled"),
          input.excludeAppointmentId
            ? ne(appointment.id, input.excludeAppointmentId)
            : undefined
        )
      );

    const conflicts = existingAppointments
      .filter((a) => {
        if (input.excludeAppointmentId && a.id === input.excludeAppointmentId) {
          return false;
        }

        const existingStart = a.scheduledAt.getTime();
        const existingEnd = existingStart + a.durationMinutes * 60_000;

        return requestedStart < existingEnd && requestedEnd > existingStart;
      })
      .map((a) => ({
        appointmentId: a.id,
        scheduledAt: a.scheduledAt,
        durationMinutes: a.durationMinutes,
        reason: a.reason,
      }));

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  });

export interface AppointmentsRouter extends Record<string, AnyRouter> {
  cancel: typeof cancelAppointmentProcedure;
  checkConflicts: typeof checkConflictsProcedure;
  create: typeof createAppointmentProcedure;
  get: typeof getAppointmentProcedure;
  list: typeof listAppointmentsProcedure;
  update: typeof updateAppointmentProcedure;
}

export const appointmentsRouter: AppointmentsRouter = {
  cancel: cancelAppointmentProcedure,
  checkConflicts: checkConflictsProcedure,
  create: createAppointmentProcedure,
  get: getAppointmentProcedure,
  list: listAppointmentsProcedure,
  update: updateAppointmentProcedure,
};
