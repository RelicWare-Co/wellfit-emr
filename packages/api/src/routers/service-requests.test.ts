import { describe, expect, mock, test } from "bun:test";
import { createRouterClient, ORPCError } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface ServiceRequestsClient {
  serviceRequests: {
    create(input: unknown): Promise<unknown>;
    createReport(input: unknown): Promise<unknown>;
    getReport(input: unknown): Promise<unknown>;
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

const serviceRequestRecord = {
  encounterId: "encounter-id",
  id: "request-id",
  patientId: "patient-id",
  priority: "routine",
  requestCode: "85025",
  requestType: "laboratory",
  requestedAt: new Date("2026-04-23T00:00:00.000Z"),
  requestedBy: "practitioner-id",
  status: "active",
};

const diagnosticReportRecord = {
  conclusionText: "Normal",
  encounterId: "encounter-id",
  id: "report-id",
  issuedAt: new Date("2026-04-23T10:00:00.000Z"),
  performerOrgId: null,
  reportType: "laboratory",
  requestId: "request-id",
  status: "final",
};

function createMockContext(db: MockDb): Context {
  return {
    auth: { api: {} },
    db,
    headers: new Headers(),
    session,
  } as unknown as Context;
}

function createServiceRequestsClient(db: MockDb): ServiceRequestsClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as ServiceRequestsClient;
}

describe("serviceRequestsRouter", () => {
  test("creates a service request", async () => {
    const returning = mock(async () => [serviceRequestRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createServiceRequestsClient(db);

    const result = await client.serviceRequests.create({
      encounterId: "encounter-id",
      patientId: "patient-id",
      priority: "routine",
      requestCode: "85025",
      requestType: "laboratory",
      requestedAt: "2026-04-23T00:00:00.000Z",
      requestedBy: "practitioner-id",
    });

    expect(result).toEqual(serviceRequestRecord);
    expect(insert).toHaveBeenCalled();
  });

  test("lists service requests with pagination", async () => {
    const offset = mock(async () => [serviceRequestRecord]);
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
    const client = createServiceRequestsClient(db);

    const result = await client.serviceRequests.list({
      encounterId: "encounter-id",
      limit: 10,
      offset: 0,
    });

    expect(result).toEqual({
      items: [serviceRequestRecord],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });

  test("creates a diagnostic report", async () => {
    const returning = mock(async () => [diagnosticReportRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createServiceRequestsClient(db);

    const result = await client.serviceRequests.createReport({
      encounterId: "encounter-id",
      issuedAt: "2026-04-23T10:00:00.000Z",
      reportType: "laboratory",
      requestId: "request-id",
      status: "final",
    });

    expect(result).toEqual(diagnosticReportRecord);
  });

  test("returns NOT_FOUND when diagnostic report does not exist", async () => {
    const limit = mock(async () => []);
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const db = {
      insert: mock(),
      select,
      update: mock(),
    };
    const client = createServiceRequestsClient(db);

    try {
      await client.serviceRequests.getReport({ requestId: "missing-id" });
      throw new Error("Expected getReport to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<"NOT_FOUND", unknown>).code).toBe("NOT_FOUND");
    }
  });
});
