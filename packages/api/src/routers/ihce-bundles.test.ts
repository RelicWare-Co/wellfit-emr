import { describe, expect, mock, test } from "bun:test";
import { createRouterClient } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface IhceBundlesClient {
  ihceBundles: {
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

const ihceBundleRecord = {
  bundleJson: { resourceType: "Bundle" },
  bundleType: "document",
  encounterId: "encounter-id",
  generatedAt: new Date("2026-04-23T00:00:00.000Z"),
  id: "bundle-id",
  responseCode: null,
  sentAt: null,
  status: "generated",
  vidaCode: null,
};

function createMockContext(db: MockDb): Context {
  return {
    auth: { api: {} },
    db,
    headers: new Headers(),
    session,
  } as unknown as Context;
}

function createIhceBundlesClient(db: MockDb): IhceBundlesClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as IhceBundlesClient;
}

describe("ihceBundlesRouter", () => {
  test("creates an IHCE bundle", async () => {
    const returning = mock(async () => [ihceBundleRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createIhceBundlesClient(db);

    const result = await client.ihceBundles.create({
      bundleJson: { resourceType: "Bundle" },
      bundleType: "document",
      encounterId: "encounter-id",
      generatedAt: "2026-04-23T00:00:00.000Z",
      status: "generated",
    });

    expect(result).toEqual(ihceBundleRecord);
    expect(insert).toHaveBeenCalled();
  });

  test("lists IHCE bundles with pagination", async () => {
    const offset = mock(async () => [ihceBundleRecord]);
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
    const client = createIhceBundlesClient(db);

    const result = await client.ihceBundles.list({
      encounterId: "encounter-id",
      limit: 10,
      offset: 0,
    });

    expect(result).toEqual({
      items: [ihceBundleRecord],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });
});
