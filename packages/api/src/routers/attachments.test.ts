import { describe, expect, mock, test } from "bun:test";
import { createRouterClient } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface AttachmentsClient {
  attachments: {
    createBinaryObject(input: unknown): Promise<unknown>;
    createLink(input: unknown): Promise<unknown>;
    listLinks(input: unknown): Promise<unknown>;
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

const binaryObjectRecord = {
  createdAt: new Date("2026-04-23T00:00:00.000Z"),
  encryptedKeyRef: "key-ref-1",
  hashSha256: "abc123",
  id: "binary-id",
  mimeType: "application/pdf",
  retentionClass: "clinical",
  sizeBytes: 1024,
  storageLocator: "s3://bucket/file.pdf",
};

const attachmentLinkRecord = {
  binaryId: "binary-id",
  capturedAt: new Date("2026-04-23T00:00:00.000Z"),
  classification: "support",
  id: "link-id",
  linkedEntityId: "encounter-id",
  linkedEntityType: "encounter",
  title: "Lab results",
};

function createMockContext(db: MockDb): Context {
  return {
    auth: { api: {} },
    db,
    headers: new Headers(),
    session,
  } as unknown as Context;
}

function createAttachmentsClient(db: MockDb): AttachmentsClient {
  return createRouterClient(appRouter, {
    context: createMockContext(db),
  }) as unknown as AttachmentsClient;
}

describe("attachmentsRouter", () => {
  test("creates a binary object", async () => {
    const returning = mock(async () => [binaryObjectRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createAttachmentsClient(db);

    const result = await client.attachments.createBinaryObject({
      encryptedKeyRef: "key-ref-1",
      hashSha256: "abc123",
      mimeType: "application/pdf",
      retentionClass: "clinical",
      sizeBytes: 1024,
      storageLocator: "s3://bucket/file.pdf",
    });

    expect(result).toEqual(binaryObjectRecord);
    expect(insert).toHaveBeenCalled();
  });

  test("creates an attachment link", async () => {
    const returning = mock(async () => [attachmentLinkRecord]);
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const db = {
      insert,
      select: mock(),
      update: mock(),
    };
    const client = createAttachmentsClient(db);

    const result = await client.attachments.createLink({
      binaryId: "binary-id",
      capturedAt: "2026-04-23T00:00:00.000Z",
      classification: "support",
      linkedEntityId: "encounter-id",
      linkedEntityType: "encounter",
      title: "Lab results",
    });

    expect(result).toEqual(attachmentLinkRecord);
  });

  test("lists attachment links with pagination", async () => {
    const offset = mock(async () => [attachmentLinkRecord]);
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
    const client = createAttachmentsClient(db);

    const result = await client.attachments.listLinks({
      limit: 10,
      linkedEntityId: "encounter-id",
      linkedEntityType: "encounter",
      offset: 0,
    });

    expect(result).toEqual({
      items: [attachmentLinkRecord],
      limit: 10,
      offset: 0,
      total: 1,
    });
  });
});
