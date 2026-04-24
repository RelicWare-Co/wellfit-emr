import { auth } from "@wellfit-emr/auth";
import { db } from "@wellfit-emr/db";
import type { Context as HonoContext } from "hono";

export type Auth = typeof auth;
export type Db = typeof db;

export interface CreateContextOptions {
  context: HonoContext;
}

export async function createContext({ context }: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    auth,
    db,
    headers: context.req.raw.headers,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
