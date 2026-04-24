import { describe, expect, mock, test } from "bun:test";
import { createRouterClient, ORPCError } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface AppointmentsClient {
  appointments: {
    cancel(input: unknown): Promise<unknown>;
    checkConflicts(input: unknown): Promise<unknown>;
    create(input: unknown): Promise<unknown>;
    get(input: unknown): Promise<unknown>;
    list(input: unknown): Promise<unknown>;
    update(input: unknown): Promise<unknown>;
  };
}

interface MockDb {
  insert: ReturnType<typeof mock>;
  select: ReturnType<typeof mock>;
  update: ReturnType<typeof mock>;
}

interface MockWithCalls {
  mock: {
    calls: unknown[][];
  };
}

const session = {
  user: {
    email: "clinician@example.com",
    id: "clinician-id",
    name: "Clinician",
  },
};

const appointmentRecord = {
  cancelledAt: null,
  cancelledReason: null,
  createdAt: new Date("2026-04-24T00:00:00.000Z"),
  createdBy: "clinician-id",
  durationMinutes: 30,
  encounterId: null,
  id: "appointment-id",
  notes: null,
  patientId: "patient-id",
  practitionerId: "practitioner-id",
  reason: "Consulta general",
  scheduledAt: new Date("2026-04-25T10:00:00.000Z"),
  serviceUnitId: null,
  siteId: "site-id",
  status: "scheduled",
  updatedAt: new Date("2026-04-24T00:00:00.000Z"),
};

function createMockContext(db: MockDb): Context {
  return {
    auth: {
      api: {},
    },
    db,
    headers: new Headers(),
    session,
  } as unknown as Context;
}

function createAppointmentsClient(db: MockDb): AppointmentsClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as AppointmentsClient;
}

describe("appointmentsRouter", () => {
  test("creates an appointment with generated id and scheduled status", async () => {
    const returning = mock(async () => [appointmentRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createAppointmentsClient(db);

    const result = await client.appointments.create({
      durationMinutes: 30,
      patientId: "patient-id",
      practitionerId: "practitioner-id",
      reason: "Consulta general",
      scheduledAt: "2026-04-25T10:00:00.000Z",
      siteId: "site-id",
    });

    expect(result).toEqual(appointmentRecord);
    expect(insert).toHaveBeenCalled();

    const insertedValue = (values as MockWithCalls).mock.calls.at(0)?.at(0) as
      | { id?: unknown; status?: unknown; createdBy?: unknown }
      | undefined;

    expect(insertedValue).toMatchObject({
      durationMinutes: 30,
      patientId: "patient-id",
      practitionerId: "practitioner-id",
      reason: "Consulta general",
      scheduledAt: new Date("2026-04-25T10:00:00.000Z"),
      siteId: "site-id",
      status: "scheduled",
    });
    expect(typeof insertedValue?.id).toBe("string");
    expect(insertedValue?.createdBy).toBe("clinician-id");
  });

  test("returns NOT_FOUND when appointment does not exist", async () => {
    const limit = mock(async () => []);
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const db = {
      insert: mock(),
      select,
      update: mock(),
    };
    const client = createAppointmentsClient(db);

    try {
      await client.appointments.get({ id: "missing-id" });
      throw new Error("Expected get to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<"NOT_FOUND", unknown>).code).toBe("NOT_FOUND");
    }
  });

  test("lists appointments with pagination and date filters", async () => {
    const appointmentOffset = mock(async () => [appointmentRecord]);
    const appointmentLimit = mock(() => ({ offset: appointmentOffset }));
    const orderBy = mock(() => ({ limit: appointmentLimit }));
    const appointmentWhere = mock(() => ({ orderBy }));
    const appointmentFrom = mock(() => ({ where: appointmentWhere }));

    const totalWhere = mock(async () => [{ value: 1 }]);
    const totalFrom = mock(() => ({ where: totalWhere }));

    const select = mock((projection?: unknown) => {
      if (projection) {
        return { from: totalFrom };
      }

      return { from: appointmentFrom };
    });
    const db = {
      insert: mock(),
      select,
      update: mock(),
    };
    const client = createAppointmentsClient(db);

    const fromDate = new Date("2026-04-24T00:00:00.000Z");
    const toDate = new Date("2026-04-30T23:59:59.999Z");

    const result = await client.appointments.list({
      fromDate: fromDate.toISOString(),
      limit: 10,
      offset: 0,
      practitionerId: "practitioner-id",
      sortBy: "scheduledAt",
      sortDirection: "asc",
      toDate: toDate.toISOString(),
    });

    expect(result).toEqual({
      appointments: [appointmentRecord],
      limit: 10,
      offset: 0,
      total: 1,
    });
    expect(appointmentLimit).toHaveBeenCalledWith(10);
    expect(appointmentOffset).toHaveBeenCalledWith(0);
    expect(totalWhere).toHaveBeenCalled();
  });

  test("rejects empty updates", async () => {
    const existingLimit = mock(async () => [appointmentRecord]);
    const existingWhere = mock(() => ({ limit: existingLimit }));
    const existingFrom = mock(() => ({ where: existingWhere }));
    const db = {
      insert: mock(),
      select: mock(() => ({ from: existingFrom })),
      update: mock(),
    };
    const client = createAppointmentsClient(db);

    try {
      await client.appointments.update({ id: "appointment-id" });
      throw new Error("Expected update to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<"BAD_REQUEST", unknown>).code).toBe(
        "BAD_REQUEST"
      );
      expect(db.update).not.toHaveBeenCalled();
    }
  });

  test("rejects update on cancelled appointment", async () => {
    const cancelledRecord = { ...appointmentRecord, status: "cancelled" };
    const existingLimit = mock(async () => [cancelledRecord]);
    const existingWhere = mock(() => ({ limit: existingLimit }));
    const existingFrom = mock(() => ({ where: existingWhere }));
    const db = {
      insert: mock(),
      select: mock(() => ({ from: existingFrom })),
      update: mock(),
    };
    const client = createAppointmentsClient(db);

    try {
      await client.appointments.update({
        id: "appointment-id",
        reason: "Nueva razón",
      });
      throw new Error("Expected update to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<"BAD_REQUEST", unknown>).code).toBe(
        "BAD_REQUEST"
      );
    }
  });

  test("cancels an appointment with reason", async () => {
    const existingLimit = mock(async () => [appointmentRecord]);
    const existingWhere = mock(() => ({ limit: existingLimit }));
    const existingFrom = mock(() => ({ where: existingWhere }));

    const returning = mock(async () => [
      {
        ...appointmentRecord,
        cancelledAt: new Date("2026-04-24T12:00:00.000Z"),
        cancelledReason: "Paciente solicita reprogramar",
        status: "cancelled",
      },
    ]);
    const where = mock(() => ({ returning }));
    const set = mock(() => ({ where }));
    const update = mock(() => ({ set }));
    const db = {
      insert: mock(),
      select: mock(() => ({ from: existingFrom })),
      update,
    };
    const client = createAppointmentsClient(db);

    const result = await client.appointments.cancel({
      cancelledReason: "Paciente solicita reprogramar",
      id: "appointment-id",
    });

    expect((result as { status: string }).status).toBe("cancelled");
    expect((result as { cancelledReason: string }).cancelledReason).toBe(
      "Paciente solicita reprogramar"
    );
  });

  test("rejects cancelling already cancelled appointment", async () => {
    const cancelledRecord = { ...appointmentRecord, status: "cancelled" };
    const existingLimit = mock(async () => [cancelledRecord]);
    const existingWhere = mock(() => ({ limit: existingLimit }));
    const existingFrom = mock(() => ({ where: existingWhere }));
    const db = {
      insert: mock(),
      select: mock(() => ({ from: existingFrom })),
      update: mock(),
    };
    const client = createAppointmentsClient(db);

    try {
      await client.appointments.cancel({
        cancelledReason: "Doble cancelación",
        id: "appointment-id",
      });
      throw new Error("Expected cancel to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<"BAD_REQUEST", unknown>).code).toBe(
        "BAD_REQUEST"
      );
    }
  });

  test("detects scheduling conflicts", async () => {
    const existingAppointment = {
      ...appointmentRecord,
      durationMinutes: 45,
      scheduledAt: new Date("2026-04-25T10:15:00.000Z"),
    };
    const existingResult = mock(async () => [existingAppointment]);
    const existingWhere = mock(() => existingResult());
    const existingFrom = mock(() => ({ where: existingWhere }));
    const select = mock(() => ({ from: existingFrom }));
    const db = {
      insert: mock(),
      select,
      update: mock(),
    };
    const client = createAppointmentsClient(db);

    const result = await client.appointments.checkConflicts({
      durationMinutes: 30,
      practitionerId: "practitioner-id",
      scheduledAt: "2026-04-25T10:00:00.000Z",
    });

    expect((result as { hasConflict: boolean }).hasConflict).toBe(true);
    expect(
      (result as { conflicts: unknown[] }).conflicts.length
    ).toBeGreaterThan(0);
  });
});
