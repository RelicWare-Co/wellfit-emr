import { describe, expect, mock, test } from "bun:test";
import { createRouterClient, ORPCError } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface InterconsultationsClient {
  interconsultations: {
    create(input: unknown): Promise<unknown>;
    list(input: unknown): Promise<unknown>;
    respond(input: unknown): Promise<unknown>;
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

const interconsultationRecord = {
  encounterId: "encounter-id",
  id: "interconsultation-id",
  reasonText: "Cardiology evaluation needed",
  requestedAt: new Date("2026-04-23T00:00:00.000Z"),
  requestedBy: "practitioner-id",
  requestedSpecialty: "cardiology",
  responseDocumentId: null,
  status: "requested",
};

function createMockContext(db: MockDb): Context {
  return {
    auth: { api: {} },
    db,
    headers: new Headers(),
    session,
  } as unknown as Context;
}

function createInterconsultationsClient(db: MockDb): InterconsultationsClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as InterconsultationsClient;
}

describe("interconsultationsRouter", () => {
  test("creates an interconsultation", async () => {
    const returning = mock(async () => [interconsultationRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createInterconsultationsClient(db);

    const result = await client.interconsultations.create({
      encounterId: "encounter-id",
      reasonText: "Cardiology evaluation needed",
      requestedAt: "2026-04-23T00:00:00.000Z",
      requestedBy: "practitioner-id",
      requestedSpecialty: "cardiology",
    });

    expect(result).toEqual(interconsultationRecord);
    expect(insert).toHaveBeenCalled();
  });

  test("lists interconsultations with pagination", async () => {
    const offset = mock(async () => [interconsultationRecord]);
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
    const client = createInterconsultationsClient(db);

    const result = await client.interconsultations.list({
      encounterId: "encounter-id",
      limit: 10,
      offset: 0,
    });

    expect(result).toEqual({
      items: [interconsultationRecord],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });

  test("responds to an interconsultation", async () => {
    const returning = mock(async () => [interconsultationRecord]);
    const where = mock(() => ({ returning }));
    const set = mock(() => ({ where }));
    const update = mock(() => ({ set }));
    const db = {
      insert: mock(),
      select: mock(),
      update,
    };
    const client = createInterconsultationsClient(db);

    const result = await client.interconsultations.respond({
      id: "interconsultation-id",
      responseDocumentId: "doc-id",
      status: "completed",
    });

    expect(result).toEqual(interconsultationRecord);
  });

  test("returns NOT_FOUND when interconsultation does not exist on respond", async () => {
    const returning = mock(async () => []);
    const where = mock(() => ({ returning }));
    const set = mock(() => ({ where }));
    const update = mock(() => ({ set }));
    const db = {
      insert: mock(),
      select: mock(),
      update,
    };
    const client = createInterconsultationsClient(db);

    try {
      await client.interconsultations.respond({
        id: "missing-id",
        status: "completed",
      });
      throw new Error("Expected respond to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<"NOT_FOUND", unknown>).code).toBe("NOT_FOUND");
    }
  });
});
