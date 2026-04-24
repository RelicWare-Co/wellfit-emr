import { createClient } from "@libsql/client";
import { env } from "@wellfit-emr/env/server";
import { drizzle } from "drizzle-orm/libsql";

// biome-ignore lint/performance/noNamespaceImport: We want to export all schema definitions under a single namespace for better organization.
import * as schema from "./schema";

export function createDb() {
  const client = createClient({
    url: env.DATABASE_URL,
  });

  return drizzle({ client, schema });
}

export const db = createDb();
