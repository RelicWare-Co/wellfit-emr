import { describe, expect, mock, test } from "bun:test";
import { createRouterClient } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface AuditEventsClient {
  auditEvents: {
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

const auditEventRecord = {
  actionCode: "read",
  channel: "web",
  encounterId: null,
  entityId: "patient-id",
  entityType: "patient",
  id: 1,
  ipHash: "abc123",
  occurredAt: new Date("2026-04-23T00:00:00.000Z"),
  patientId: "patient-id",
  reasonCode: null,
  resultCode: "success",
  userId: "clinician-id",
};

function createMockContext(db: MockDb): Context {
  return {
    auth: { api: {} },
    db,
    headers: new Headers(),
    session,
  } as unknown as Context;
}

function createAuditEventsClient(db: MockDb): AuditEventsClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as AuditEventsClient;
}

describe("auditEventsRouter", () => {
  test("creates an audit event", async () => {
    const returning = mock(async () => [auditEventRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createAuditEventsClient(db);

    const result = await client.auditEvents.create({
      actionCode: "read",
      channel: "web",
      entityId: "patient-id",
      entityType: "patient",
      ipHash: "abc123",
      occurredAt: "2026-04-23T00:00:00.000Z",
      patientId: "patient-id",
      resultCode: "success",
      userId: "clinician-id",
    });

    expect(result).toEqual(auditEventRecord);
    expect(insert).toHaveBeenCalled();
  });

  test("lists audit events with pagination", async () => {
    const offset = mock(async () => [auditEventRecord]);
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
    const client = createAuditEventsClient(db);

    const result = await client.auditEvents.list({
      limit: 10,
      offset: 0,
      patientId: "patient-id",
    });

    expect(result).toEqual({
      items: [auditEventRecord],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });
});
