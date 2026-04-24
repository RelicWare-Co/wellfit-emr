import type { AnyRouter } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";

const roleValueSchema = z.enum(["admin", "user"]);
const roleSchema = z.union([roleValueSchema, z.array(roleValueSchema)]);
const userPermissionSchema = z.enum([
  "create",
  "list",
  "set-role",
  "ban",
  "impersonate",
  "impersonate-admins",
  "delete",
  "set-password",
  "get",
  "update",
]);
const sessionPermissionSchema = z.enum(["list", "revoke", "delete"]);
const permissionsSchema = z.object({
  user: z.array(userPermissionSchema).optional(),
  session: z.array(sessionPermissionSchema).optional(),
});

const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  name: z.string().min(1),
  role: roleSchema.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const listUsersSchema = z.object({
  searchValue: z.string().optional(),
  searchField: z.enum(["email", "name"]).optional(),
  searchOperator: z.enum(["contains", "starts_with", "ends_with"]).optional(),
  limit: z.union([z.string(), z.number()]).optional(),
  offset: z.union([z.string(), z.number()]).optional(),
  sortBy: z.string().optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  filterField: z.string().optional(),
  filterValue: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.array(z.number()),
    ])
    .optional(),
  filterOperator: z
    .enum([
      "eq",
      "ne",
      "lt",
      "lte",
      "gt",
      "gte",
      "in",
      "not_in",
      "contains",
      "starts_with",
      "ends_with",
    ])
    .optional(),
});

const getUserSchema = z.object({
  id: z.string().min(1),
});

const setRoleSchema = z.object({
  userId: z.string().min(1),
  role: roleSchema,
});

const setUserPasswordSchema = z.object({
  newPassword: z.string().min(1),
  userId: z.string().min(1),
});

const updateUserSchema = z.object({
  userId: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

const banUserSchema = z.object({
  userId: z.string().min(1),
  banReason: z.string().optional(),
  banExpiresIn: z.number().optional(),
});

const userIdSchema = z.object({
  userId: z.string().min(1),
});

const revokeUserSessionSchema = z.object({
  sessionToken: z.string().min(1),
});

const hasPermissionSchema = z
  .object({
    userId: z.string().min(1).optional(),
    role: roleValueSchema.optional(),
  })
  .and(
    z.union([
      z.object({
        permission: permissionsSchema,
        permissions: z.undefined().optional(),
      }),
      z.object({
        permission: z.undefined().optional(),
        permissions: permissionsSchema,
      }),
    ])
  );

const userResponseSchema = z.object({
  user: z.unknown(),
});
const listUsersResponseSchema = z.object({
  users: z.array(z.unknown()),
  total: z.number(),
});
const sessionResponseSchema = z.object({
  session: z.unknown(),
  user: z.unknown(),
});
const sessionsResponseSchema = z.object({
  sessions: z.array(z.unknown()),
});
const successResponseSchema = z.object({
  success: z.boolean(),
});
const statusResponseSchema = z.object({
  status: z.boolean(),
});
const permissionResponseSchema = z.object({
  error: z.null(),
  success: z.boolean(),
});

type UserResponse = z.infer<typeof userResponseSchema>;
type ListUsersResponse = z.infer<typeof listUsersResponseSchema>;
type SessionResponse = z.infer<typeof sessionResponseSchema>;
type SessionsResponse = z.infer<typeof sessionsResponseSchema>;
type SuccessResponse = z.infer<typeof successResponseSchema>;
type StatusResponse = z.infer<typeof statusResponseSchema>;
type PermissionResponse = z.infer<typeof permissionResponseSchema>;

const createUserProcedure = protectedProcedure
  .input(createUserSchema)
  .output(userResponseSchema)
  .handler(async ({ context, input }): Promise<UserResponse> => {
    const result = await context.auth.api.createUser({
      body: input,
      headers: context.headers,
    });
    return result;
  });

const listUsersProcedure = protectedProcedure
  .input(listUsersSchema.optional().default({}))
  .output(listUsersResponseSchema)
  .handler(async ({ context, input }): Promise<ListUsersResponse> => {
    const result = await context.auth.api.listUsers({
      query: input,
      headers: context.headers,
    });
    return result;
  });

const getUserProcedure = protectedProcedure
  .input(getUserSchema)
  .output(z.unknown())
  .handler(({ context, input }) =>
    context.auth.api.getUser({
      query: input,
      headers: context.headers,
    })
  );

const setRoleProcedure = protectedProcedure
  .input(setRoleSchema)
  .output(userResponseSchema)
  .handler(async ({ context, input }): Promise<UserResponse> => {
    const result = await context.auth.api.setRole({
      body: input,
      headers: context.headers,
    });
    return result;
  });

const setUserPasswordProcedure = protectedProcedure
  .input(setUserPasswordSchema)
  .output(statusResponseSchema)
  .handler(async ({ context, input }): Promise<StatusResponse> => {
    const result = await context.auth.api.setUserPassword({
      body: input,
      headers: context.headers,
    });
    return result;
  });

const updateUserProcedure = protectedProcedure
  .input(updateUserSchema)
  .output(z.unknown())
  .handler(({ context, input }) =>
    context.auth.api.adminUpdateUser({
      body: input,
      headers: context.headers,
    })
  );

const banUserProcedure = protectedProcedure
  .input(banUserSchema)
  .output(userResponseSchema)
  .handler(async ({ context, input }): Promise<UserResponse> => {
    const result = await context.auth.api.banUser({
      body: input,
      headers: context.headers,
    });
    return result;
  });

const unbanUserProcedure = protectedProcedure
  .input(userIdSchema)
  .output(userResponseSchema)
  .handler(async ({ context, input }): Promise<UserResponse> => {
    const result = await context.auth.api.unbanUser({
      body: input,
      headers: context.headers,
    });
    return result;
  });

const listUserSessionsProcedure = protectedProcedure
  .input(userIdSchema)
  .output(sessionsResponseSchema)
  .handler(async ({ context, input }): Promise<SessionsResponse> => {
    const result = await context.auth.api.listUserSessions({
      body: input,
      headers: context.headers,
    });
    return result;
  });

const revokeUserSessionProcedure = protectedProcedure
  .input(revokeUserSessionSchema)
  .output(successResponseSchema)
  .handler(async ({ context, input }): Promise<SuccessResponse> => {
    const result = await context.auth.api.revokeUserSession({
      body: input,
      headers: context.headers,
    });
    return result;
  });

const revokeUserSessionsProcedure = protectedProcedure
  .input(userIdSchema)
  .output(successResponseSchema)
  .handler(async ({ context, input }): Promise<SuccessResponse> => {
    const result = await context.auth.api.revokeUserSessions({
      body: input,
      headers: context.headers,
    });
    return result;
  });

const impersonateUserProcedure = protectedProcedure
  .input(userIdSchema)
  .output(sessionResponseSchema)
  .handler(async ({ context, input }): Promise<SessionResponse> => {
    const result = await context.auth.api.impersonateUser({
      body: input,
      headers: context.headers,
    });
    return result;
  });

const stopImpersonatingProcedure = protectedProcedure
  .output(sessionResponseSchema)
  .handler(async ({ context }): Promise<SessionResponse> => {
    const result = await context.auth.api.stopImpersonating({
      headers: context.headers,
    });
    return result;
  });

const removeUserProcedure = protectedProcedure
  .input(userIdSchema)
  .output(successResponseSchema)
  .handler(async ({ context, input }): Promise<SuccessResponse> => {
    const result = await context.auth.api.removeUser({
      body: input,
      headers: context.headers,
    });
    return result;
  });

const hasPermissionProcedure = protectedProcedure
  .input(hasPermissionSchema)
  .output(permissionResponseSchema)
  .handler(async ({ context, input }): Promise<PermissionResponse> => {
    const permissions = input.permissions ?? input.permission;

    const result = await context.auth.api.userHasPermission({
      body: {
        permissions,
        role: input.role,
        userId: input.userId,
      },
      headers: context.headers,
    });
    return result;
  });

export interface AdminRouter extends Record<string, AnyRouter> {
  banUser: typeof banUserProcedure;
  createUser: typeof createUserProcedure;
  getUser: typeof getUserProcedure;
  hasPermission: typeof hasPermissionProcedure;
  impersonateUser: typeof impersonateUserProcedure;
  listUserSessions: typeof listUserSessionsProcedure;
  listUsers: typeof listUsersProcedure;
  removeUser: typeof removeUserProcedure;
  revokeUserSession: typeof revokeUserSessionProcedure;
  revokeUserSessions: typeof revokeUserSessionsProcedure;
  setRole: typeof setRoleProcedure;
  setUserPassword: typeof setUserPasswordProcedure;
  stopImpersonating: typeof stopImpersonatingProcedure;
  unbanUser: typeof unbanUserProcedure;
  updateUser: typeof updateUserProcedure;
}

export const adminRouter: AdminRouter = {
  banUser: banUserProcedure,
  createUser: createUserProcedure,
  getUser: getUserProcedure,
  hasPermission: hasPermissionProcedure,
  impersonateUser: impersonateUserProcedure,
  listUserSessions: listUserSessionsProcedure,
  listUsers: listUsersProcedure,
  removeUser: removeUserProcedure,
  revokeUserSession: revokeUserSessionProcedure,
  revokeUserSessions: revokeUserSessionsProcedure,
  setRole: setRoleProcedure,
  setUserPassword: setUserPasswordProcedure,
  stopImpersonating: stopImpersonatingProcedure,
  unbanUser: unbanUserProcedure,
  updateUser: updateUserProcedure,
};
