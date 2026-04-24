import { describe, expect, mock, test } from "bun:test";
import { createRouterClient, ORPCError } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface PatientsClient {
  patients: {
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

const patientRecord = {
  birthDate: new Date("1990-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-04-23T00:00:00.000Z"),
  deceasedAt: null,
  firstName: "Ada",
  genderIdentity: null,
  id: "patient-id",
  lastName1: "Lovelace",
  lastName2: null,
  middleName: null,
  primaryDocumentNumber: "123456789",
  primaryDocumentType: "CC",
  sexAtBirth: "F",
  updatedAt: new Date("2026-04-23T00:00:00.000Z"),
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

function createPatientsClient(db: MockDb): PatientsClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as PatientsClient;
}

describe("patientsRouter", () => {
  test("creates a patient with a generated id", async () => {
    const returning = mock(async () => [patientRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createPatientsClient(db);

    const result = await client.patients.create({
      birthDate: "1990-01-01T00:00:00.000Z",
      firstName: "Ada",
      lastName1: "Lovelace",
      primaryDocumentNumber: "123456789",
      primaryDocumentType: "CC",
      sexAtBirth: "F",
    });

    expect(result).toEqual(patientRecord);
    expect(insert).toHaveBeenCalled();
    const insertedValue = (values as MockWithCalls).mock.calls.at(0)?.at(0) as
      | { id?: unknown }
      | undefined;

    expect(insertedValue).toMatchObject({
      birthDate: new Date("1990-01-01T00:00:00.000Z"),
      firstName: "Ada",
      lastName1: "Lovelace",
      primaryDocumentNumber: "123456789",
      primaryDocumentType: "CC",
      sexAtBirth: "F",
    });
    expect(typeof insertedValue?.id).toBe("string");
  });

  test("returns NOT_FOUND when a patient does not exist", async () => {
    const limit = mock(async () => []);
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const db = {
      insert: mock(),
      select,
      update: mock(),
    };
    const client = createPatientsClient(db);

    try {
      await client.patients.get({ id: "missing-patient-id" });
      throw new Error("Expected get to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<"NOT_FOUND", unknown>).code).toBe("NOT_FOUND");
    }
  });

  test("lists patients with pagination metadata", async () => {
    const patientOffset = mock(async () => [patientRecord]);
    const patientLimit = mock(() => ({ offset: patientOffset }));
    const orderBy = mock(() => ({ limit: patientLimit }));
    const patientWhere = mock(() => ({ orderBy }));
    const patientFrom = mock(() => ({ where: patientWhere }));

    const totalWhere = mock(async () => [{ value: 1 }]);
    const totalFrom = mock(() => ({ where: totalWhere }));

    const select = mock((projection?: unknown) => {
      if (projection) {
        return { from: totalFrom };
      }

      return { from: patientFrom };
    });
    const db = {
      insert: mock(),
      select,
      update: mock(),
    };
    const client = createPatientsClient(db);

    const result = await client.patients.list({
      limit: 10,
      offset: 20,
      search: "Ada",
      sortBy: "firstName",
      sortDirection: "asc",
    });

    expect(result).toEqual({
      limit: 10,
      offset: 20,
      patients: [patientRecord],
      total: 1,
    });
    expect(patientLimit).toHaveBeenCalledWith(10);
    expect(patientOffset).toHaveBeenCalledWith(20);
    expect(totalWhere).toHaveBeenCalled();
  });

  test("rejects empty updates", async () => {
    const db = {
      insert: mock(),
      select: mock(),
      update: mock(),
    };
    const client = createPatientsClient(db);

    try {
      await client.patients.update({ id: "patient-id" });
      throw new Error("Expected update to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<"BAD_REQUEST", unknown>).code).toBe(
        "BAD_REQUEST"
      );
      expect(db.update).not.toHaveBeenCalled();
    }
  });
});
