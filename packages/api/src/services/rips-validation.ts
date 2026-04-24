import { ripsReferenceEntry } from "@wellfit-emr/db/schema/rips-reference";
import { and, eq } from "drizzle-orm";
import type { Db } from "../context";

export interface RipsValidationResult {
  code: string;
  description: string | null;
  enabled: boolean;
  extraData: Record<string, string> | null;
  name: string;
}

export async function validateRipsCode(
  db: Db,
  tableName: string,
  code: string,
  options: { requireEnabled?: boolean } = {}
): Promise<RipsValidationResult> {
  const [entry] = await db
    .select({
      code: ripsReferenceEntry.code,
      name: ripsReferenceEntry.name,
      description: ripsReferenceEntry.description,
      enabled: ripsReferenceEntry.enabled,
      extraData: ripsReferenceEntry.extraData,
    })
    .from(ripsReferenceEntry)
    .where(
      and(
        eq(ripsReferenceEntry.tableName, tableName),
        eq(ripsReferenceEntry.code, code)
      )
    )
    .limit(1);

  if (!entry) {
    throw new Error(
      `Código RIPS inválido: '${code}' no existe en la tabla '${tableName}'`
    );
  }

  if (options.requireEnabled && !entry.enabled) {
    throw new Error(
      `Código RIPS deshabilitado: '${code}' en la tabla '${tableName}' no está habilitado según SISPRO`
    );
  }

  return entry;
}

export async function resolveRipsName(
  db: Db,
  tableName: string,
  code: string
): Promise<string | null> {
  const [entry] = await db
    .select({ name: ripsReferenceEntry.name })
    .from(ripsReferenceEntry)
    .where(
      and(
        eq(ripsReferenceEntry.tableName, tableName),
        eq(ripsReferenceEntry.code, code)
      )
    )
    .limit(1);

  return entry?.name ?? null;
}

export const RIPS_TABLE_NAMES = {
  causaExterna: "RIPSCausaExternaVersion2",
  cie10: "CIE10",
  coberturaPlan: "CoberturaPlan",
  conceptoRecaudo: "ConceptoRecaudo",
  condicionDestino: "CondicionyDestinoUsuarioEgreso",
  cups: "CUPSRips",
  entidadResponsablePago: "EntidadResponsablePago",
  finalidadConsulta: "RIPSFinalidadConsultaVersion2",
  grupoServicios: "GrupoServicios",
  modalidadAtencion: "ModalidadAtencion",
  modalidadPago: "modalidadPago",
  municipio: "Municipio",
  pais: "Pais",
  servicios: "Servicios",
  sexo: "Sexo",
  tipoDiagnosticoPrincipal: "RIPSTipoDiagnosticoPrincipalVersion2",
  tipoIdPisis: "TipoIdPISIS",
  tipoMedicamentoPos: "TipoMedicamentoPOSVersion2",
  tipoOtrosServicios: "TipoOtrosServicios",
  tipoUsuario: "RIPSTipoUsuarioVersion2",
  umm: "UMM",
  upr: "UPR",
  viaIngreso: "ViaIngresoUsuario",
  zona: "ZonaVersion2",
} as const;
