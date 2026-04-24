import { describe, expect, mock, test } from "bun:test";
import { createRouterClient } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface RipsExportsClient {
  ripsExports: {
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

const ripsExportRecord = {
  generatedAt: new Date("2026-04-23T00:00:00.000Z"),
  id: "rips-id",
  payloadJson: null,
  payerId: "payer-id",
  periodFrom: new Date("2026-04-01T00:00:00.000Z"),
  periodTo: new Date("2026-04-30T00:00:00.000Z"),
  status: "draft",
  validationResultJson: null,
};

function createMockContext(db: MockDb): Context {
  return {
    auth: { api: {} },
    db,
    headers: new Headers(),
    session,
  } as unknown as Context;
}

function createRipsExportsClient(db: MockDb): RipsExportsClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as RipsExportsClient;
}

describe("ripsExportsRouter", () => {
  test("creates a RIPS export", async () => {
    const returning = mock(async () => [ripsExportRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createRipsExportsClient(db);

    const result = await client.ripsExports.create({
      generatedAt: "2026-04-23T00:00:00.000Z",
      payerId: "payer-id",
      periodFrom: "2026-04-01T00:00:00.000Z",
      periodTo: "2026-04-30T00:00:00.000Z",
      status: "draft",
    });

    expect(result).toEqual(ripsExportRecord);
    expect(insert).toHaveBeenCalled();
  });

  test("lists RIPS exports with pagination", async () => {
    const offset = mock(async () => [ripsExportRecord]);
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
    const client = createRipsExportsClient(db);

    const result = await client.ripsExports.list({
      limit: 10,
      offset: 0,
      status: "draft",
    });

    expect(result).toEqual({
      items: [ripsExportRecord],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });
});
