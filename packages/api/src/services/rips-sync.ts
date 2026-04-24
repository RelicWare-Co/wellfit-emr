import {
  ripsReferenceEntry,
  ripsReferenceTable,
} from "@wellfit-emr/db/schema/rips-reference";
import { eq, sql } from "drizzle-orm";
import type { Db } from "../context";

const SISPRO_STATE_URL =
  "https://fevrips.sispro.gov.co/fevrips-api/api/SincronizacionDatos/GetEstado";

interface SisproTableState {
  dbNombreTabla: string;
  dbNombreTablaSISPRO: string;
  estadoEntidad: boolean;
  fechaActualizacion: string;
  id: number;
  nombre: string;
  urlTablaSISPRO: string;
}

interface SisproTableRecord {
  Codigo: string;
  CreationDateTime: string;
  Descripcion: string;
  Extra_I?: string;
  Extra_II?: string;
  Extra_III?: string;
  Extra_IV?: string;
  Extra_IX?: string;
  Extra_V?: string;
  Extra_VI?: string;
  Extra_VII?: string;
  Extra_VIII?: string;
  Extra_X?: string;
  Habilitado: boolean;
  ID: number;
  LastUpdateDateTime: string;
  Nombre: string;
  Valor?: string | null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${response.statusText} fetching ${url}`
    );
  }

  return response.json() as Promise<T>;
}

export function fetchSisproTableState(): Promise<SisproTableState[]> {
  return fetchJson<SisproTableState[]>(SISPRO_STATE_URL);
}

export function fetchSisproTableData(
  url: string
): Promise<SisproTableRecord[]> {
  return fetchJson<SisproTableRecord[]>(url);
}

function extractExtras(
  record: SisproTableRecord
): Record<string, string> | undefined {
  const extras: Record<string, string> = {};
  const extraKeys = [
    "Extra_I",
    "Extra_II",
    "Extra_III",
    "Extra_IV",
    "Extra_V",
    "Extra_VI",
    "Extra_VII",
    "Extra_VIII",
    "Extra_IX",
    "Extra_X",
  ] as const;

  let hasExtras = false;
  for (const key of extraKeys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      extras[key] = value;
      hasExtras = true;
    }
  }

  return hasExtras ? extras : undefined;
}

export async function syncRipsReferenceTables(
  db: Db
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  const states = await fetchSisproTableState();

  for (const state of states) {
    try {
      await syncSingleTable(db, state);
      synced++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to sync ${state.nombre}: ${message}`);
    }
  }

  return { synced, errors };
}

export async function syncSingleTable(
  db: Db,
  state: SisproTableState
): Promise<{ inserted: number; updated: number }> {
  const existingTable = await db
    .select()
    .from(ripsReferenceTable)
    .where(eq(ripsReferenceTable.name, state.nombre))
    .limit(1);

  const sisproLastUpdate = new Date(state.fechaActualizacion);

  let tableId: number;
  if (existingTable.length === 0) {
    const [created] = await db
      .insert(ripsReferenceTable)
      .values({
        id: state.id,
        name: state.nombre,
        description: state.dbNombreTabla,
        sisproDbName: state.dbNombreTablaSISPRO,
        sisproUrl: state.urlTablaSISPRO,
        sisproLastUpdate,
        isActive: state.estadoEntidad,
      })
      .returning();
    if (!created) {
      throw new Error("Failed to create reference table record");
    }
    tableId = created.id;
  } else {
    const [foundTable] = existingTable;
    if (!foundTable) {
      throw new Error("Failed to find existing reference table");
    }
    tableId = foundTable.id;
    await db
      .update(ripsReferenceTable)
      .set({
        sisproLastUpdate,
        sisproUrl: state.urlTablaSISPRO,
        isActive: state.estadoEntidad,
        updatedAt: new Date(),
      })
      .where(eq(ripsReferenceTable.id, tableId));
  }

  const records = await fetchSisproTableData(state.urlTablaSISPRO);
  let inserted = 0;
  let updated = 0;

  for (const record of records) {
    const existingEntry = await db
      .select()
      .from(ripsReferenceEntry)
      .where(
        sql`${ripsReferenceEntry.tableId} = ${tableId} AND ${ripsReferenceEntry.code} = ${record.Codigo}`
      )
      .limit(1);

    const sourceUpdatedAt = new Date(record.LastUpdateDateTime);
    const extraData = extractExtras(record);

    if (existingEntry.length === 0) {
      await db.insert(ripsReferenceEntry).values({
        tableId,
        tableName: state.nombre,
        code: record.Codigo,
        name: record.Nombre,
        description: record.Descripcion || null,
        enabled: record.Habilitado,
        extraData,
        sourceId: record.ID,
        sourceUpdatedAt,
      });
      inserted++;
    } else {
      const entry = existingEntry[0];
      if (!entry) {
        throw new Error("Failed to find existing entry for update");
      }
      const needsUpdate =
        entry.sourceUpdatedAt?.getTime() !== sourceUpdatedAt.getTime() ||
        entry.name !== record.Nombre ||
        entry.enabled !== record.Habilitado;

      if (needsUpdate) {
        await db
          .update(ripsReferenceEntry)
          .set({
            name: record.Nombre,
            description: record.Descripcion || null,
            enabled: record.Habilitado,
            extraData,
            sourceId: record.ID,
            sourceUpdatedAt,
            updatedAt: new Date(),
          })
          .where(eq(ripsReferenceEntry.id, entry.id));
        updated++;
      }
    }
  }

  await db
    .update(ripsReferenceTable)
    .set({
      lastSyncedAt: new Date(),
      entryCount: await db
        .select({ count: sql<number>`count(*)` })
        .from(ripsReferenceEntry)
        .where(eq(ripsReferenceEntry.tableId, tableId))
        .then((r: { count: number }[]) => r[0]?.count ?? 0),
      updatedAt: new Date(),
    })
    .where(eq(ripsReferenceTable.id, tableId));

  return { inserted, updated };
}
