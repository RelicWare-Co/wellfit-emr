import { describe, expect, mock, test } from "bun:test";
import { createRouterClient, ORPCError } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface EncountersClient {
  encounters: {
    close(input: unknown): Promise<unknown>;
    create(input: unknown): Promise<unknown>;
    get(input: unknown): Promise<unknown>;
    list(input: unknown): Promise<unknown>;
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

const encounterRecord = {
  admissionSource: null,
  careModality: "presential",
  causeExternalCode: null,
  condicionDestinoCode: null,
  createdAt: new Date("2026-04-23T00:00:00.000Z"),
  encounterClass: "ambulatory",
  endedAt: null,
  finalidadConsultaCode: null,
  id: "encounter-id",
  modalidadAtencionCode: null,
  patientId: "patient-id",
  reasonForVisit: "Consulta de control",
  serviceUnitId: "service-unit-id",
  siteId: "site-id",
  startedAt: new Date("2026-04-23T15:00:00.000Z"),
  status: "in-progress",
  updatedAt: new Date("2026-04-23T00:00:00.000Z"),
  vidaCode: null,
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
        id: "clinician-id",
      },
    },
  } as unknown as Context;
}

function createEncountersClient(db: MockDb): EncountersClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as EncountersClient;
}

describe("encountersRouter", () => {
  test("creates an encounter with a generated id", async () => {
    const returning = mock(async () => [encounterRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const ripsLimit = mock(async () => [
      { code: "01", name: "Valid", enabled: true, extraData: null },
    ]);
    const ripsWhere = mock(() => ({ limit: ripsLimit }));
    const ripsFrom = mock(() => ({ where: ripsWhere }));
    const client = createEncountersClient({
      insert,
      select: mock(() => ({ from: ripsFrom })),
      update: mock(),
    });

    const result = await client.encounters.create({
      careModality: "presential",
      encounterClass: "ambulatory",
      patientId: "patient-id",
      reasonForVisit: "Consulta de control",
      serviceUnitId: "service-unit-id",
      siteId: "site-id",
      startedAt: "2026-04-23T15:00:00.000Z",
    });
    const insertedValue = (values as MockWithCalls).mock.calls.at(0)?.at(0) as
      | { id?: unknown }
      | undefined;

    expect(result).toEqual(encounterRecord);
    expect(insertedValue).toMatchObject({
      careModality: "presential",
      encounterClass: "ambulatory",
      patientId: "patient-id",
      reasonForVisit: "Consulta de control",
      serviceUnitId: "service-unit-id",
      siteId: "site-id",
      startedAt: new Date("2026-04-23T15:00:00.000Z"),
      status: "in-progress",
    });
    expect(typeof insertedValue?.id).toBe("string");
  });

  test("returns NOT_FOUND when an encounter does not exist", async () => {
    const limit = mock(async () => []);
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const client = createEncountersClient({
      insert: mock(),
      select,
      update: mock(),
    });

    try {
      await client.encounters.get({ id: "missing-encounter-id" });
      throw new Error("Expected get to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<"NOT_FOUND", unknown>).code).toBe("NOT_FOUND");
    }
  });

  test("lists encounters with filters and pagination metadata", async () => {
    const encounterOffset = mock(async () => [encounterRecord]);
    const encounterLimit = mock(() => ({ offset: encounterOffset }));
    const orderBy = mock(() => ({ limit: encounterLimit }));
    const encounterWhere = mock(() => ({ orderBy }));
    const encounterFrom = mock(() => ({ where: encounterWhere }));
    const totalWhere = mock(async () => [{ value: 1 }]);
    const totalFrom = mock(() => ({ where: totalWhere }));
    const select = mock((projection?: unknown) => {
      if (projection) {
        return { from: totalFrom };
      }

      return { from: encounterFrom };
    });
    const client = createEncountersClient({
      insert: mock(),
      select,
      update: mock(),
    });

    const result = await client.encounters.list({
      limit: 10,
      offset: 20,
      patientId: "patient-id",
      search: "control",
      status: "in-progress",
    });

    expect(result).toEqual({
      encounters: [encounterRecord],
      limit: 10,
      offset: 20,
      total: 1,
    });
    expect(encounterWhere).toHaveBeenCalled();
    expect(encounterLimit).toHaveBeenCalledWith(10);
    expect(encounterOffset).toHaveBeenCalledWith(20);
    expect(totalWhere).toHaveBeenCalled();
  });

  test("closes an encounter", async () => {
    const closedEncounter = {
      ...encounterRecord,
      endedAt: new Date("2026-04-23T16:00:00.000Z"),
      status: "finished",
    };
    const returning = mock(async () => [closedEncounter]);
    const where = mock(() => ({ returning }));
    const set = mock(() => ({ where }));
    const update = mock(() => ({ set }));
    const client = createEncountersClient({
      insert: mock(),
      select: mock(),
      update,
    });

    const result = await client.encounters.close({
      endedAt: "2026-04-23T16:00:00.000Z",
      id: "encounter-id",
    });

    expect(result).toEqual(closedEncounter);
    expect(set).toHaveBeenCalledWith({
      endedAt: new Date("2026-04-23T16:00:00.000Z"),
      status: "finished",
    });
  });
});
