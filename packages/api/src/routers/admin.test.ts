import { describe, expect, mock, test } from "bun:test";
import { createRouterClient, ORPCError } from "@orpc/server";

import type { Context } from "../context";
import { appRouter } from "./index";

interface AdminClient {
  admin: {
    banUser(input: unknown): Promise<unknown>;
    createUser(input: unknown): Promise<unknown>;
    getUser(input: unknown): Promise<unknown>;
    hasPermission(input: unknown): Promise<unknown>;
    impersonateUser(input: unknown): Promise<unknown>;
    listUserSessions(input: unknown): Promise<unknown>;
    listUsers(input: unknown): Promise<unknown>;
    removeUser(input: unknown): Promise<unknown>;
    revokeUserSession(input: unknown): Promise<unknown>;
    revokeUserSessions(input: unknown): Promise<unknown>;
    setRole(input: unknown): Promise<unknown>;
    setUserPassword(input: unknown): Promise<unknown>;
    stopImpersonating(): Promise<unknown>;
    unbanUser(input: unknown): Promise<unknown>;
    updateUser(input: unknown): Promise<unknown>;
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

  test("forwards getUser query to Better Auth", async () => {
    const getUser = mock(async () => ({
      id: "user-id",
      email: "user@example.com",
    }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ getUser }),
    }) as unknown as AdminClient;

    const result = await client.admin.getUser({ id: "user-id" });

    expect(result).toEqual({ id: "user-id", email: "user@example.com" });
    expect(getUser).toHaveBeenCalledWith({
      headers,
      query: { id: "user-id" },
    });
  });

  test("forwards setRole body to Better Auth", async () => {
    const setRole = mock(async () => ({
      user: { id: "user-id", role: "admin" },
    }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ setRole }),
    }) as unknown as AdminClient;

    const result = await client.admin.setRole({
      userId: "user-id",
      role: "admin",
    });

    expect(result).toEqual({ user: { id: "user-id", role: "admin" } });
    expect(setRole).toHaveBeenCalledWith({
      body: { userId: "user-id", role: "admin" },
      headers,
    });
  });

  test("forwards setUserPassword body to Better Auth", async () => {
    const setUserPassword = mock(async () => ({ status: true }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ setUserPassword }),
    }) as unknown as AdminClient;

    const result = await client.admin.setUserPassword({
      userId: "user-id",
      newPassword: "new-password",
    });

    expect(result).toEqual({ status: true });
    expect(setUserPassword).toHaveBeenCalledWith({
      body: { userId: "user-id", newPassword: "new-password" },
      headers,
    });
  });

  test("forwards updateUser body to Better Auth", async () => {
    const updateUser = mock(async () => ({
      id: "user-id",
      name: "Updated Name",
    }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ updateUser }),
    }) as unknown as AdminClient;

    const result = await client.admin.updateUser({
      userId: "user-id",
      data: { name: "Updated Name" },
    });

    expect(result).toEqual({ id: "user-id", name: "Updated Name" });
    expect(updateUser).toHaveBeenCalledWith({
      body: { userId: "user-id", data: { name: "Updated Name" } },
      headers,
    });
  });

  test("forwards banUser body to Better Auth", async () => {
    const banUser = mock(async () => ({
      user: { id: "user-id", banned: true },
    }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ banUser }),
    }) as unknown as AdminClient;

    const result = await client.admin.banUser({
      userId: "user-id",
      banReason: "Spamming",
      banExpiresIn: 86_400,
    });

    expect(result).toEqual({ user: { id: "user-id", banned: true } });
    expect(banUser).toHaveBeenCalledWith({
      body: { userId: "user-id", banReason: "Spamming", banExpiresIn: 86_400 },
      headers,
    });
  });

  test("forwards unbanUser body to Better Auth", async () => {
    const unbanUser = mock(async () => ({
      user: { id: "user-id", banned: false },
    }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ unbanUser }),
    }) as unknown as AdminClient;

    const result = await client.admin.unbanUser({ userId: "user-id" });

    expect(result).toEqual({ user: { id: "user-id", banned: false } });
    expect(unbanUser).toHaveBeenCalledWith({
      body: { userId: "user-id" },
      headers,
    });
  });

  test("forwards listUserSessions body to Better Auth", async () => {
    const listUserSessions = mock(async () => ({
      sessions: [{ id: "session-id" }],
    }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ listUserSessions }),
    }) as unknown as AdminClient;

    const result = await client.admin.listUserSessions({ userId: "user-id" });

    expect(result).toEqual({ sessions: [{ id: "session-id" }] });
    expect(listUserSessions).toHaveBeenCalledWith({
      body: { userId: "user-id" },
      headers,
    });
  });

  test("forwards revokeUserSession body to Better Auth", async () => {
    const revokeUserSession = mock(async () => ({ success: true }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ revokeUserSession }),
    }) as unknown as AdminClient;

    const result = await client.admin.revokeUserSession({
      sessionToken: "token-to-revoke",
    });

    expect(result).toEqual({ success: true });
    expect(revokeUserSession).toHaveBeenCalledWith({
      body: { sessionToken: "token-to-revoke" },
      headers,
    });
  });

  test("forwards revokeUserSessions body to Better Auth", async () => {
    const revokeUserSessions = mock(async () => ({ success: true }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ revokeUserSessions }),
    }) as unknown as AdminClient;

    const result = await client.admin.revokeUserSessions({ userId: "user-id" });

    expect(result).toEqual({ success: true });
    expect(revokeUserSessions).toHaveBeenCalledWith({
      body: { userId: "user-id" },
      headers,
    });
  });

  test("forwards impersonateUser body to Better Auth", async () => {
    const impersonateUser = mock(async () => ({
      session: { token: "impersonated-token" },
      user: { id: "user-id" },
    }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ impersonateUser }),
    }) as unknown as AdminClient;

    const result = await client.admin.impersonateUser({ userId: "user-id" });

    expect(result).toEqual({
      session: { token: "impersonated-token" },
      user: { id: "user-id" },
    });
    expect(impersonateUser).toHaveBeenCalledWith({
      body: { userId: "user-id" },
      headers,
    });
  });

  test("forwards stopImpersonating to Better Auth", async () => {
    const stopImpersonating = mock(async () => ({
      session: { token: "admin-token" },
      user: { id: "admin-id" },
    }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ stopImpersonating }),
    }) as unknown as AdminClient;

    const result = await client.admin.stopImpersonating();

    expect(result).toEqual({
      session: { token: "admin-token" },
      user: { id: "admin-id" },
    });
    expect(stopImpersonating).toHaveBeenCalledWith({
      headers,
    });
  });

  test("forwards removeUser body to Better Auth", async () => {
    const removeUser = mock(async () => ({ success: true }));
    const client = createRouterClient(appRouter, {
      context: createMockContext({ removeUser }),
    }) as unknown as AdminClient;

    const result = await client.admin.removeUser({ userId: "user-id" });

    expect(result).toEqual({ success: true });
    expect(removeUser).toHaveBeenCalledWith({
      body: { userId: "user-id" },
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
