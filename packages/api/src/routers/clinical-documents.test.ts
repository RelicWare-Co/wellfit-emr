import { describe, expect, mock, test } from "bun:test";
import { createRouterClient, ORPCError } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface ClinicalDocumentsClient {
  clinicalDocuments: {
    create(input: unknown): Promise<unknown>;
    get(input: unknown): Promise<unknown>;
    list(input: unknown): Promise<unknown>;
    sign(input: unknown): Promise<unknown>;
    correct(input: unknown): Promise<unknown>;
  };
}

interface MockDb {
  insert: ReturnType<typeof mock>;
  select: ReturnType<typeof mock>;
  transaction: ReturnType<typeof mock>;
  update: ReturnType<typeof mock>;
}

const session = {
  user: {
    email: "clinician@example.com",
    id: "clinician-id",
    name: "Clinician",
  },
};

const documentRecord = {
  createdAt: new Date("2026-04-23T00:00:00.000Z"),
  createdBy: "clinician-id",
  currentVersionId: "version-id",
  documentType: "evolucion_medica",
  encounterId: "encounter-id",
  id: "document-id",
  patientId: "patient-id",
  status: "draft",
};

const versionRecord = {
  authorPractitionerId: "practitioner-id",
  authorUserId: "clinician-id",
  correctionReason: null,
  createdAt: new Date("2026-04-23T00:00:00.000Z"),
  documentId: "document-id",
  hashSha256: "abc123",
  id: "version-id",
  isCurrent: true,
  payloadJson: { note: "content" },
  signedAt: null,
  signedByUserId: null,
  supersedesVersionId: null,
  textRendered: null,
  versionNo: 1,
};

function createMockContext(db: MockDb): Context {
  return {
    auth: { api: {} },
    db,
    headers: new Headers(),
    session,
  } as unknown as Context;
}

function createClinicalDocumentsClient(db: MockDb): ClinicalDocumentsClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as ClinicalDocumentsClient;
}

describe("clinicalDocumentsRouter", () => {
  test("creates a document with a generated id", async () => {
    let returningCallCount = 0;
    const txReturning = mock(() => {
      returningCallCount++;
      if (returningCallCount === 1) {
        return Promise.resolve([documentRecord]);
      }
      if (returningCallCount === 2) {
        return Promise.resolve([versionRecord]);
      }
      if (returningCallCount === 3) {
        return Promise.resolve([documentRecord]);
      }
      return Promise.resolve([]);
    });
    const txValues = mock(() => ({ returning: txReturning }));
    const txInsert = mock(() => ({ values: txValues }));

    const txUpdateReturning = mock(async () => [documentRecord]);
    const txUpdateWhere = mock(() => ({ returning: txUpdateReturning }));
    const txUpdateSet = mock(() => ({ where: txUpdateWhere }));
    const txUpdate = mock(() => ({ set: txUpdateSet }));

    const tx = {
      insert: txInsert,
      select: mock(),
      update: txUpdate,
    };

    const transaction = mock(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(tx)
    );

    const db = {
      insert: mock(),
      select: mock(),
      transaction,
      update: mock(),
    };

    const client = createClinicalDocumentsClient(db);

    const result = await client.clinicalDocuments.create({
      authorPractitionerId: "practitioner-id",
      documentType: "evolucion_medica",
      encounterId: "encounter-id",
      patientId: "patient-id",
      payloadJson: { note: "content" },
      sections: [
        {
          sectionCode: "subjective",
          sectionOrder: 1,
          sectionPayloadJson: { text: "Patient feels better" },
        },
      ],
    });

    expect(result).toEqual(documentRecord);
    expect(transaction).toHaveBeenCalled();
  });

  test("returns NOT_FOUND when document does not exist", async () => {
    const limit = mock(async () => []);
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const db = {
      insert: mock(),
      select,
      transaction: mock(),
      update: mock(),
    };
    const client = createClinicalDocumentsClient(db);

    try {
      await client.clinicalDocuments.get({ id: "missing-doc-id" });
      throw new Error("Expected get to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<"NOT_FOUND", unknown>).code).toBe("NOT_FOUND");
    }
  });

  test("lists documents with pagination metadata", async () => {
    const docOffset = mock(async () => [documentRecord]);
    const docLimit = mock(() => ({ offset: docOffset }));
    const orderBy = mock(() => ({ limit: docLimit }));
    const docWhere = mock(() => ({ orderBy }));
    const docFrom = mock(() => ({ where: docWhere }));

    const totalWhere = mock(async () => [{ value: 1 }]);
    const totalFrom = mock(() => ({ where: totalWhere }));

    const select = mock((projection?: unknown) => {
      if (projection) {
        return { from: totalFrom };
      }
      return { from: docFrom };
    });

    const db = {
      insert: mock(),
      select,
      transaction: mock(),
      update: mock(),
    };
    const client = createClinicalDocumentsClient(db);

    const result = await client.clinicalDocuments.list({
      limit: 10,
      offset: 20,
      patientId: "patient-id",
      sortDirection: "desc",
    });

    expect(result).toEqual({
      documents: [documentRecord],
      limit: 10,
      offset: 20,
      total: 1,
    });
  });

  test("signs a document version", async () => {
    const docLimit = mock(async () => [documentRecord]);
    const docWhere = mock(() => ({ limit: docLimit }));
    const docFrom = mock(() => ({ where: docWhere }));

    const signedVersion = { ...versionRecord, signedAt: new Date() };
    const versionReturning = mock(async () => [signedVersion]);
    const versionWhere = mock(() => ({ returning: versionReturning }));
    const versionSet = mock(() => ({ where: versionWhere }));
    const update = mock(() => ({ set: versionSet }));

    const select = mock(() => ({ from: docFrom }));
    const db = {
      insert: mock(),
      select,
      transaction: mock(),
      update,
    };
    const client = createClinicalDocumentsClient(db);

    const result = await client.clinicalDocuments.sign({
      id: "document-id",
    });

    expect(result).toEqual(signedVersion);
  });

  test("rejects sign when document has no current version", async () => {
    const noVersionDoc = { ...documentRecord, currentVersionId: null };
    const docLimit = mock(async () => [noVersionDoc]);
    const docWhere = mock(() => ({ limit: docLimit }));
    const docFrom = mock(() => ({ where: docWhere }));
    const select = mock(() => ({ from: docFrom }));

    const db = {
      insert: mock(),
      select,
      transaction: mock(),
      update: mock(),
    };
    const client = createClinicalDocumentsClient(db);

    try {
      await client.clinicalDocuments.sign({ id: "document-id" });
      throw new Error("Expected sign to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<"BAD_REQUEST", unknown>).code).toBe(
        "BAD_REQUEST"
      );
    }
  });
});
