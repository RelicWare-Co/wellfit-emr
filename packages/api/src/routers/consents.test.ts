import { describe, expect, mock, test } from "bun:test";
import { createRouterClient } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface ConsentsClient {
  consents: {
    createConsent(input: unknown): Promise<unknown>;
    createDataDisclosure(input: unknown): Promise<unknown>;
    listConsents(input: unknown): Promise<unknown>;
    listDataDisclosures(input: unknown): Promise<unknown>;
    revokeConsent(input: unknown): Promise<unknown>;
    revokeDataDisclosure(input: unknown): Promise<unknown>;
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

const consentRecord = {
  consentType: "procedimiento_quirurgico",
  decision: "accepted",
  documentVersionId: null,
  encounterId: "encounter-id",
  expiresAt: null,
  grantedByPersonName: "Patient Name",
  id: "consent-id",
  patientId: "patient-id",
  procedureCode: "123456",
  representativeRelationship: null,
  revokedAt: null,
  signedAt: new Date("2026-04-23T00:00:00.000Z"),
};

const dataDisclosureRecord = {
  expiresAt: null,
  grantedAt: new Date("2026-04-23T00:00:00.000Z"),
  id: "disclosure-id",
  legalBasis: "consentimiento",
  patientId: "patient-id",
  purposeCode: "audit",
  revokedAt: null,
  scopeJson: { fields: ["diagnoses"] },
  thirdPartyName: "EPS Example",
};

function createMockContext(db: MockDb): Context {
  return {
    auth: { api: {} },
    db,
    headers: new Headers(),
    session,
  } as unknown as Context;
}

function createConsentsClient(db: MockDb): ConsentsClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as ConsentsClient;
}

describe("consentsRouter", () => {
  test("creates a consent record", async () => {
    const returning = mock(async () => [consentRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createConsentsClient(db);

    const result = await client.consents.createConsent({
      consentType: "procedimiento_quirurgico",
      decision: "accepted",
      encounterId: "encounter-id",
      grantedByPersonName: "Patient Name",
      patientId: "patient-id",
      procedureCode: "123456",
      signedAt: "2026-04-23T00:00:00.000Z",
    });

    expect(result).toEqual(consentRecord);
    expect(insert).toHaveBeenCalled();
  });

  test("lists consents with pagination", async () => {
    const offset = mock(async () => [consentRecord]);
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
    const client = createConsentsClient(db);

    const result = await client.consents.listConsents({
      limit: 10,
      offset: 0,
      patientId: "patient-id",
    });

    expect(result).toEqual({
      items: [consentRecord],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });

  test("revokes a consent record", async () => {
    const returning = mock(async () => [consentRecord]);
    const where = mock(() => ({ returning }));
    const set = mock(() => ({ where }));
    const update = mock(() => ({ set }));
    const db = {
      insert: mock(),
      select: mock(),
      update,
    };
    const client = createConsentsClient(db);

    const result = await client.consents.revokeConsent({
      id: "consent-id",
      revokedAt: "2026-04-24T00:00:00.000Z",
    });

    expect(result).toEqual(consentRecord);
  });

  test("creates a data disclosure authorization", async () => {
    const returning = mock(async () => [dataDisclosureRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createConsentsClient(db);

    const result = await client.consents.createDataDisclosure({
      grantedAt: "2026-04-23T00:00:00.000Z",
      legalBasis: "consentimiento",
      patientId: "patient-id",
      purposeCode: "audit",
      scopeJson: { fields: ["diagnoses"] },
      thirdPartyName: "EPS Example",
    });

    expect(result).toEqual(dataDisclosureRecord);
  });

  test("revokes a data disclosure authorization", async () => {
    const returning = mock(async () => [dataDisclosureRecord]);
    const where = mock(() => ({ returning }));
    const set = mock(() => ({ where }));
    const update = mock(() => ({ set }));
    const db = {
      insert: mock(),
      select: mock(),
      update,
    };
    const client = createConsentsClient(db);

    const result = await client.consents.revokeDataDisclosure({
      id: "disclosure-id",
      revokedAt: "2026-04-24T00:00:00.000Z",
    });

    expect(result).toEqual(dataDisclosureRecord);
  });
});
