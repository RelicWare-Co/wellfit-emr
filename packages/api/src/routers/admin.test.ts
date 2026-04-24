import { describe, expect, mock, test } from "bun:test";
import { createRouterClient, ORPCError } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface AdminClient {
  admin: {
    createUser(input: unknown): Promise<unknown>;
    hasPermission(input: unknown): Promise<unknown>;
    listUsers(input: unknown): Promise<unknown>;
  };
}

const headers = new Headers({
  cookie: "better-auth.session_token=test-token",
});

const session = {
  user: {
    id: "admin-id",
    email: "admin@example.com",
    name: "Admin",
  },
  session: {
    id: "session-id",
    token: "test-token",
    userId: "admin-id",
    expiresAt: new Date("2026-04-24T00:00:00.000Z"),
    createdAt: new Date("2026-04-23T00:00:00.000Z"),
    updatedAt: new Date("2026-04-23T00:00:00.000Z"),
  },
};

function createMockContext(api: Record<string, unknown>): Context {
  return {
    auth: {
      api,
    },
    headers,
    session,
  } as Context;
}

describe("adminRouter", () => {
  test("requires an authenticated session", async () => {
    const client = createRouterClient(appRouter, {
      context: {
        auth: {
          api: {},
        },
        headers,
        session: null,
      } as Context,
    }) as unknown as AdminClient;

    expect(client.admin).toBeDefined();

    try {
      await client.admin.listUsers({});
      throw new Error("Expected listUsers to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<"UNAUTHORIZED", unknown>).code).toBe(
        "UNAUTHORIZED"
      );
    }
  });

  test("forwards listUsers query and request headers to Better Auth", async () => {
    const listUsers = mock(async () => ({
      total: 1,
      users: [{ id: "user-id" }],
    }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ listUsers }),
    }) as unknown as AdminClient;

    const result = await client.admin.listUsers({
      limit: 10,
      offset: 20,
      searchField: "email",
      searchOperator: "contains",
      searchValue: "patient",
      sortBy: "name",
      sortDirection: "asc",
    });

    expect(result).toEqual({
      total: 1,
      users: [{ id: "user-id" }],
    });
    expect(listUsers).toHaveBeenCalledWith({
      headers,
      query: {
        limit: 10,
        offset: 20,
        searchField: "email",
        searchOperator: "contains",
        searchValue: "patient",
        sortBy: "name",
        sortDirection: "asc",
      },
    });
  });

  test("forwards createUser body to Better Auth", async () => {
    const createUser = mock(async () => ({
      user: { email: "new@example.com", id: "new-user-id" },
    }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ createUser }),
    }) as unknown as AdminClient;

    await client.admin.createUser({
      email: "new@example.com",
      name: "New User",
      password: "secure-password",
      role: "user",
    });

    expect(createUser).toHaveBeenCalledWith({
      body: {
        email: "new@example.com",
        name: "New User",
        password: "secure-password",
        role: "user",
      },
      headers,
    });
  });

  test("normalizes hasPermission permission alias", async () => {
    const userHasPermission = mock(async () => ({
      error: null,
      success: true,
    }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ userHasPermission }),
    }) as unknown as AdminClient;

    const result = await client.admin.hasPermission({
      permission: {
        user: ["delete"],
      },
      role: "admin",
    });

    expect(result).toEqual({
      error: null,
      success: true,
    });
    expect(userHasPermission).toHaveBeenCalledWith({
      body: {
        permissions: {
          user: ["delete"],
        },
        role: "admin",
        userId: undefined,
      },
      headers,
    });
  });
});
