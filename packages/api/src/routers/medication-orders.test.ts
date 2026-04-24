import { describe, expect, mock, test } from "bun:test";
import { createRouterClient } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface MedicationOrdersClient {
  medicationOrders: {
    create(input: unknown): Promise<unknown>;
    createAdministration(input: unknown): Promise<unknown>;
    list(input: unknown): Promise<unknown>;
    listAdministrations(input: unknown): Promise<unknown>;
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

const medicationOrderRecord = {
  atcCode: null,
  concentration: "500 mg",
  diagnosisId: null,
  dosageForm: "tablet",
  dose: "1",
  doseUnit: null,
  durationText: "7 days",
  encounterId: "encounter-id",
  frequencyText: "every 8 hours",
  genericName: "Paracetamol",
  id: "order-id",
  indications: null,
  patientId: "patient-id",
  prescriberId: "practitioner-id",
  quantityTotal: "21",
  routeCode: "oral",
  signedAt: new Date("2026-04-23T00:00:00.000Z"),
  status: "active",
  validUntil: null,
};

const administrationRecord = {
  administeredAt: new Date("2026-04-23T08:00:00.000Z"),
  administeredBy: "nurse-id",
  doseAdministered: "1 tablet",
  id: "admin-id",
  medicationOrderId: "order-id",
  reasonNotAdministered: null,
  status: "completed",
};

function createMockContext(db: MockDb): Context {
  return {
    auth: { api: {} },
    db,
    headers: new Headers(),
    session,
  } as unknown as Context;
}

function createMedicationOrdersClient(db: MockDb): MedicationOrdersClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as MedicationOrdersClient;
}

describe("medicationOrdersRouter", () => {
  test("creates a medication order", async () => {
    const returning = mock(async () => [medicationOrderRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createMedicationOrdersClient(db);

    const result = await client.medicationOrders.create({
      concentration: "500 mg",
      dosageForm: "tablet",
      dose: "1",
      durationText: "7 days",
      encounterId: "encounter-id",
      frequencyText: "every 8 hours",
      genericName: "Paracetamol",
      patientId: "patient-id",
      prescriberId: "practitioner-id",
      quantityTotal: "21",
      routeCode: "oral",
      signedAt: "2026-04-23T00:00:00.000Z",
    });

    expect(result).toEqual(medicationOrderRecord);
    expect(insert).toHaveBeenCalled();
  });

  test("lists medication orders with pagination", async () => {
    const offset = mock(async () => [medicationOrderRecord]);
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
    const client = createMedicationOrdersClient(db);

    const result = await client.medicationOrders.list({
      encounterId: "encounter-id",
      limit: 10,
      offset: 0,
    });

    expect(result).toEqual({
      items: [medicationOrderRecord],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });

  test("creates a medication administration", async () => {
    const returning = mock(async () => [administrationRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createMedicationOrdersClient(db);

    const result = await client.medicationOrders.createAdministration({
      administeredAt: "2026-04-23T08:00:00.000Z",
      administeredBy: "nurse-id",
      doseAdministered: "1 tablet",
      medicationOrderId: "order-id",
      status: "completed",
    });

    expect(result).toEqual(administrationRecord);
  });

  test("lists administrations by order", async () => {
    const offset = mock(async () => [administrationRecord]);
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
    const client = createMedicationOrdersClient(db);

    const result = await client.medicationOrders.listAdministrations({
      limit: 10,
      medicationOrderId: "order-id",
      offset: 0,
    });

    expect(result).toEqual({
      items: [administrationRecord],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });
});
