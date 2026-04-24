import { describe, expect, mock, test } from "bun:test";
import { createRouterClient } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface IncapacityCertificatesClient {
  incapacityCertificates: {
    create(input: unknown): Promise<unknown>;
    list(input: unknown): Promise<unknown>;
  };
}

interface MockDb {
  insert: ReturnType<typeof mock>;
  select: ReturnType<typeof mock>;
  update: ReturnType<typeof mock>;
}

const session = {
  user: {
    email: "clinician@example.com",
    id: "clinician-id",
    name: "Clinician",
  },
};

const incapacityRecord = {
  conceptText: "Acute respiratory infection",
  destinationEntity: "EPS Example",
  encounterId: "encounter-id",
  endDate: new Date("2026-04-30T00:00:00.000Z"),
  id: "incapacity-id",
  issuedAt: new Date("2026-04-23T00:00:00.000Z"),
  issuedBy: "practitioner-id",
  patientId: "patient-id",
  signedAt: new Date("2026-04-23T00:00:00.000Z"),
  startDate: new Date("2026-04-23T00:00:00.000Z"),
};

function createMockContext(db: MockDb): Context {
  return {
    auth: { api: {} },
    db,
    headers: new Headers(),
    session,
  } as unknown as Context;
}

function createIncapacityCertificatesClient(
  db: MockDb
): IncapacityCertificatesClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as IncapacityCertificatesClient;
}

describe("incapacityCertificatesRouter", () => {
  test("creates an incapacity certificate", async () => {
    const returning = mock(async () => [incapacityRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createIncapacityCertificatesClient(db);

    const result = await client.incapacityCertificates.create({
      conceptText: "Acute respiratory infection",
      destinationEntity: "EPS Example",
      encounterId: "encounter-id",
      endDate: "2026-04-30T00:00:00.000Z",
      issuedAt: "2026-04-23T00:00:00.000Z",
      issuedBy: "practitioner-id",
      patientId: "patient-id",
      signedAt: "2026-04-23T00:00:00.000Z",
      startDate: "2026-04-23T00:00:00.000Z",
    });

    expect(result).toEqual(incapacityRecord);
    expect(insert).toHaveBeenCalled();
  });

  test("lists incapacity certificates with pagination", async () => {
    const offset = mock(async () => [incapacityRecord]);
    const limit = mock(() => ({ offset }));
    const orderBy = mock(() => ({ limit }));
    const where = mock(() => ({ orderBy }));
    const from = mock(() => ({ where }));

    const totalWhere = mock(async () => [{ value: 1 }]);
    const totalFrom = mock(() => ({ where: totalWhere }));

    const select = mock((projection?: unknown) => {
      if (projection) {
        return { from: totalFrom };
      }
      return { from };
    });

    const db = {
      insert: mock(),
      select,
      update: mock(),
    };
    const client = createIncapacityCertificatesClient(db);

    const result = await client.incapacityCertificates.list({
      limit: 10,
      offset: 0,
      patientId: "patient-id",
    });

    expect(result).toEqual({
      items: [incapacityRecord],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });
});
