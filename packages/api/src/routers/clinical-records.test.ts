import { describe, expect, mock, test } from "bun:test";
import { createRouterClient, ORPCError } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface ClinicalRecordsClient {
  clinicalRecords: {
    createAllergy(input: unknown): Promise<unknown>;
    createDiagnosis(input: unknown): Promise<unknown>;
    createObservation(input: unknown): Promise<unknown>;
    listDiagnoses(input: unknown): Promise<unknown>;
    listObservations(input: unknown): Promise<unknown>;
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

const diagnosisRecord = {
  certainty: "confirmed",
  code: "I10X",
  codeSystem: "CIE10",
  description: "Hipertension esencial",
  diagnosisType: "01",
  documentVersionId: null,
  encounterId: "encounter-id",
  id: "diagnosis-id",
  onsetAt: null,
  rank: 1,
  ripsReferenceName: null,
};

const observationRecord = {
  code: "8480-6",
  codeSystem: "LOINC",
  documentVersionId: null,
  encounterId: "encounter-id",
  id: "observation-id",
  observationType: "vital-sign",
  observedAt: new Date("2026-04-23T15:10:00.000Z"),
  patientId: "patient-id",
  status: "final",
  valueNum: 120,
  valueText: null,
  valueUnit: "mmHg",
};

const allergyRecord = {
  codeSystem: "SNOMED",
  criticality: "high",
  id: "allergy-id",
  patientId: "patient-id",
  reactionText: "Rash",
  recordedAt: new Date("2026-04-23T15:00:00.000Z"),
  recordedBy: "clinician-id",
  status: "active",
  substanceCode: "227493005",
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

function createClinicalRecordsClient(db: MockDb): ClinicalRecordsClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as ClinicalRecordsClient;
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

describe("clinicalRecordsRouter", () => {
  test("creates diagnoses with generated ids", async () => {
    const ripsLimit = mock(async () => [
      { code: "01", name: "Confirmado nuevo", enabled: true, extraData: null },
    ]);
    const ripsWhere = mock(() => ({ limit: ripsLimit }));
    const ripsFrom = mock(() => ({ where: ripsWhere }));
    const { db, values } = createInsertDb([diagnosisRecord]);
    const client = createClinicalRecordsClient({
      ...db,
      select: mock(() => ({ from: ripsFrom })),
    });

    const result = await client.clinicalRecords.createDiagnosis({
      certainty: "confirmed",
      code: "I10X",
      codeSystem: "CIE10",
      description: "Hipertension esencial",
      diagnosisType: "01",
      encounterId: "encounter-id",
      rank: 1,
    });
    const insertedValue = (values as MockWithCalls).mock.calls.at(0)?.at(0) as
      | { id?: unknown }
      | undefined;

    expect(result).toEqual(diagnosisRecord);
    expect(insertedValue).toMatchObject({
      code: "I10X",
      codeSystem: "CIE10",
      description: "Hipertension esencial",
      diagnosisType: "01",
      encounterId: "encounter-id",
      rank: 1,
    });
    expect(typeof insertedValue?.id).toBe("string");
  });

  test("lists observations for an encounter", async () => {
    const orderBy = mock(async () => [observationRecord]);
    const where = mock(() => ({ orderBy }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const client = createClinicalRecordsClient({
      insert: mock(),
      select,
      update: mock(),
    });

    const result = await client.clinicalRecords.listObservations({
      encounterId: "encounter-id",
      sortDirection: "desc",
    });

    expect(result).toEqual([observationRecord]);
    expect(where).toHaveBeenCalled();
    expect(orderBy).toHaveBeenCalled();
  });

  test("creates allergies", async () => {
    const { db, values } = createInsertDb([allergyRecord]);
    const client = createClinicalRecordsClient(db);

    const result = await client.clinicalRecords.createAllergy({
      codeSystem: "SNOMED",
      criticality: "high",
      patientId: "patient-id",
      reactionText: "Rash",
      recordedAt: "2026-04-23T15:00:00.000Z",
      recordedBy: "clinician-id",
      status: "active",
      substanceCode: "227493005",
    });
    const insertedValue = (values as MockWithCalls).mock.calls.at(0)?.at(0);

    expect(result).toEqual(allergyRecord);
    expect(insertedValue).toMatchObject({
      patientId: "patient-id",
      recordedAt: new Date("2026-04-23T15:00:00.000Z"),
      recordedBy: "clinician-id",
      status: "active",
    });
  });

  test("returns an internal error when creation yields no row", async () => {
    const { db } = createInsertDb([]);
    const client = createClinicalRecordsClient(db);

    try {
      await client.clinicalRecords.createObservation({
        encounterId: "encounter-id",
        observationType: "vital-sign",
        observedAt: "2026-04-23T15:10:00.000Z",
        patientId: "patient-id",
        status: "final",
        valueNum: 120,
      });
      throw new Error("Expected createObservation to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<"INTERNAL_SERVER_ERROR", unknown>).code).toBe(
        "INTERNAL_SERVER_ERROR"
      );
    }
  });
});
