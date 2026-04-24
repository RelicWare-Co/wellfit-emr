import { describe, expect, mock, test } from "bun:test";
import { createRouterClient } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface FacilitiesClient {
  facilities: {
    createOrganization(input: unknown): Promise<unknown>;
    createPractitioner(input: unknown): Promise<unknown>;
    listPractitioners(input: unknown): Promise<unknown>;
    listServiceUnits(input: unknown): Promise<unknown>;
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

const organizationRecord = {
  createdAt: new Date("2026-04-23T00:00:00.000Z"),
  id: "organization-id",
  name: "Wellfit IPS",
  repsCode: "123456",
  status: "active",
  taxId: "900123456",
  updatedAt: new Date("2026-04-23T00:00:00.000Z"),
};

const practitionerRecord = {
  active: true,
  createdAt: new Date("2026-04-23T00:00:00.000Z"),
  documentNumber: "123456789",
  documentType: "CC",
  fullName: "Ada Lovelace",
  id: "practitioner-id",
  rethusNumber: "RETHUS-1",
  updatedAt: new Date("2026-04-23T00:00:00.000Z"),
};

function createMockContext(db: MockDb): Context {
  return {
    auth: {
      api: {},
    },
    db,
    headers: new Headers(),
    session: {
      user: {
        id: "admin-id",
      },
    },
  } as unknown as Context;
}

function createFacilitiesClient(db: MockDb): FacilitiesClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as FacilitiesClient;
}

function createInsertDb(returnedRows: unknown[]) {
  const returning = mock(async () => returnedRows);
  const values = mock(() => ({ returning }));
  const insert = mock(() => ({ values }));

  return {
    db: {
      insert,
      select: mock(),
      update: mock(),
    },
    values,
  };
}

describe("facilitiesRouter", () => {
  test("creates organizations with default active status", async () => {
    const { db, values } = createInsertDb([organizationRecord]);
    const client = createFacilitiesClient(db);

    const result = await client.facilities.createOrganization({
      name: "Wellfit IPS",
      repsCode: "123456",
      taxId: "900123456",
    });
    const insertedValue = (values as MockWithCalls).mock.calls.at(0)?.at(0) as
      | { id?: unknown }
      | undefined;

    expect(result).toEqual(organizationRecord);
    expect(insertedValue).toMatchObject({
      name: "Wellfit IPS",
      repsCode: "123456",
      status: "active",
      taxId: "900123456",
    });
    expect(typeof insertedValue?.id).toBe("string");
  });

  test("creates practitioners", async () => {
    const { db, values } = createInsertDb([practitionerRecord]);
    const client = createFacilitiesClient(db);

    const result = await client.facilities.createPractitioner({
      documentNumber: "123456789",
      documentType: "CC",
      fullName: "Ada Lovelace",
      rethusNumber: "RETHUS-1",
    });
    const insertedValue = (values as MockWithCalls).mock.calls.at(0)?.at(0);

    expect(result).toEqual(practitionerRecord);
    expect(insertedValue).toMatchObject({
      active: true,
      documentNumber: "123456789",
      documentType: "CC",
      fullName: "Ada Lovelace",
      rethusNumber: "RETHUS-1",
    });
  });

  test("lists practitioners with pagination metadata", async () => {
    const practitionerOffset = mock(async () => [practitionerRecord]);
    const practitionerLimit = mock(() => ({ offset: practitionerOffset }));
    const orderBy = mock(() => ({ limit: practitionerLimit }));
    const practitionerWhere = mock(() => ({ orderBy }));
    const practitionerFrom = mock(() => ({ where: practitionerWhere }));
    const totalWhere = mock(async () => [{ value: 1 }]);
    const totalFrom = mock(() => ({ where: totalWhere }));
    const select = mock((projection?: unknown) => {
      if (projection) {
        return { from: totalFrom };
      }

      return { from: practitionerFrom };
    });
    const client = createFacilitiesClient({
      insert: mock(),
      select,
      update: mock(),
    });

    const result = await client.facilities.listPractitioners({
      limit: 10,
      offset: 20,
      search: "Ada",
    });

    expect(result).toEqual({
      limit: 10,
      offset: 20,
      practitioners: [practitionerRecord],
      total: 1,
    });
    expect(practitionerLimit).toHaveBeenCalledWith(10);
    expect(practitionerOffset).toHaveBeenCalledWith(20);
    expect(totalWhere).toHaveBeenCalled();
  });

  test("lists service units scoped by site", async () => {
    const offset = mock(async () => []);
    const limit = mock(() => ({ offset }));
    const orderBy = mock(() => ({ limit }));
    const where = mock(() => ({ orderBy }));
    const from = mock(() => ({ where }));
    const totalWhere = mock(async () => [{ value: 0 }]);
    const totalFrom = mock(() => ({ where: totalWhere }));
    const select = mock((projection?: unknown) => {
      if (projection) {
        return { from: totalFrom };
      }

      return { from };
    });
    const client = createFacilitiesClient({
      insert: mock(),
      select,
      update: mock(),
    });

    const result = await client.facilities.listServiceUnits({
      siteId: "site-id",
    });

    expect(result).toEqual({
      limit: 50,
      offset: 0,
      serviceUnits: [],
      total: 0,
    });
    expect(where).toHaveBeenCalled();
  });
});
