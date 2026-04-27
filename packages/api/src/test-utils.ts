import { auth } from "@wellfit-emr/auth";
import { createDb, db } from "@wellfit-emr/db";
import { user } from "@wellfit-emr/db/schema/auth";
import { eq } from "drizzle-orm";

import type { Context } from "./context";

export interface SeedUser {
  email: string;
  id: string;
  name: string;
  role: string;
}

export const SEED_USER: SeedUser = {
  id: "seed-user-001",
  email: "seed@wellfit.local",
  name: "Seed Administrator",
  role: "admin",
};

export async function ensureSeedUserExists(
  database: typeof db = db
): Promise<SeedUser> {
  const [existing] = await database
    .select()
    .from(user)
    .where(eq(user.id, SEED_USER.id))
    .limit(1);

  if (existing) {
    return {
      email: existing.email,
      id: existing.id,
      name: existing.name,
      role: existing.role ?? "user",
    };
  }

  await database.insert(user).values({
    id: SEED_USER.id,
    email: SEED_USER.email,
    name: SEED_USER.name,
    role: SEED_USER.role,
    emailVerified: true,
    banned: false,
    banReason: null,
    banExpires: null,
    image: null,
  });

  return SEED_USER;
}

export function createSeedContext(database: typeof db = db): Context {
  return {
    auth,
    db: database,
    headers: new Headers(),
    session: {
      user: {
        id: SEED_USER.id,
        email: SEED_USER.email,
        name: SEED_USER.name,
        image: null,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: SEED_USER.role,
        banned: false,
        banReason: null,
        banExpires: null,
      },
    },
  } as unknown as Context;
}

export function createTestContext(
  overrides?: Partial<Omit<Context, "session">> & {
    sessionUser?: Partial<{
      id: string;
      email: string;
      name: string;
      image: string | null;
      emailVerified: boolean;
      createdAt: Date;
      updatedAt: Date;
      role: string;
      banned: boolean;
      banReason: string | null;
      banExpires: Date | null;
    }>;
  }
): Context {
  const database = overrides?.db ?? createDb();

  return {
    auth,
    db: database,
    headers: overrides?.headers ?? new Headers(),
    session: {
      user: {
        id: "test-user-id",
        email: "test@wellfit.local",
        name: "Test User",
        image: null,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: "user",
        banned: false,
        banReason: null,
        banExpires: null,
        ...overrides?.sessionUser,
      },
    },
  } as unknown as Context;
}
