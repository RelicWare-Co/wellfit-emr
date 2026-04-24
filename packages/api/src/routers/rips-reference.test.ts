import { describe, expect, mock, test } from "bun:test";
import { createRouterClient } from "@orpc/server";
import type { SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";

import type { Context } from "../context";
import { appRouter } from "./index";

interface RipsReferenceClient {
  ripsReference: {
    listEntries(input: unknown): Promise<unknown>;
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

const referenceEntry = {
  code: "ABC",
  createdAt: new Date("2026-04-23T00:00:00.000Z"),
  description: null,
  enabled: true,
  extraData: null,
  id: 10,
  name: "Resultado ABC",
  sourceId: null,
  sourceUpdatedAt: null,
  tableId: 1,
  tableName: "CUPS",
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
        id: "clinician-id",
      },
    },
  } as unknown as Context;
}

function createRipsReferenceClient(db: MockDb): RipsReferenceClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as RipsReferenceClient;
}

describe("ripsReferenceRouter", () => {
  test("groups entry search conditions under the selected table filter", async () => {
    const tableLimit = mock(async () => [{ id: 1, name: "CUPS" }]);
    const tableWhere = mock(() => ({ limit: tableLimit }));
    const tableFrom = mock(() => ({ where: tableWhere }));

    const countWhere = mock(async () => [{ count: 1 }]);
    const countFrom = mock(() => ({ where: countWhere }));

    const entriesOffset = mock(async () => [referenceEntry]);
    const entriesLimit = mock(() => ({ offset: entriesOffset }));
    const entriesOrderBy = mock(() => ({ limit: entriesLimit }));
    const entriesWhere = mock(() => ({ orderBy: entriesOrderBy }));
    const entriesFrom = mock(() => ({ where: entriesWhere }));

    let selectWithoutProjectionCalls = 0;
    const select = mock((projection?: unknown) => {
      if (projection) {
        return { from: countFrom };
      }

      selectWithoutProjectionCalls++;
      if (selectWithoutProjectionCalls === 1) {
        return { from: tableFrom };
      }

      return { from: entriesFrom };
    });
    const client = createRipsReferenceClient({
      insert: mock(),
      select,
      update: mock(),
    });

    const result = await client.ripsReference.listEntries({
      search: "ABC",
      tableName: "CUPS",
    });

    const whereSql = (entriesWhere as MockWithCalls).mock.calls.at(0)?.at(0);
    const query = new SQLiteSyncDialect().sqlToQuery(whereSql as SQL);

    expect(result).toEqual({
      entries: [referenceEntry],
      limit: 50,
      offset: 0,
      total: 1,
    });
    expect(query.sql).toContain('"rips_reference_entry"."table_id" = ?');
    expect(query.sql).toContain('"rips_reference_entry"."enabled" = ?');
    expect(query.sql).toContain(
      'and ("rips_reference_entry"."code" like ? or "rips_reference_entry"."name" like ?)'
    );
    expect(query.params).toEqual([1, 1, "%ABC%", "%ABC%"]);
  });
});
