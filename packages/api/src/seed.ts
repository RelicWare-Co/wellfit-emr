import { createRouterClient } from "@orpc/server";
import { db } from "@wellfit-emr/db";
import {
  allergyIntolerance,
  appointment,
  diagnosis,
  encounter,
  encounterParticipant,
  medicationAdministration,
  medicationOrder,
  observation,
  organization,
  patient,
  practitioner,
  procedureRecord,
  serviceUnit,
  site,
} from "@wellfit-emr/db/schema/clinical";
import { ripsReferenceEntry } from "@wellfit-emr/db/schema/rips-reference";
import { and, eq, like, sql } from "drizzle-orm";

import { appRouter } from "./routers/index";
import {
  createSeedContext,
  ensureSeedUserExists,
  SEED_USER,
} from "./test-utils";

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  WELLFIT EMR — COMPREHENSIVE SEED + INTEGRATION TEST FOUNDATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  This file serves dual purpose:
 *  1. SEED: Populates the database with realistic, coherent EMR data.
 *  2. TEST FOUNDATION: Uses the real oRPC routers (not direct DB inserts),
 *     so every seed operation is also an end-to-end integration test.
 *
 *  CRITICAL: All RIPS/SISPRO catalog codes are fetched dynamically after
 *  syncing with the state API. NO codes are hardcoded.
 *
 *  Run:  bun run packages/api/src/seed.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Logger ─────────────────────────────────────────────────────────────────

const PREFIX = "[SEED]";

function log(step: string, message: string) {
  console.log(`${PREFIX} ${step.padEnd(16)} | ${message}`);
}

function logError(step: string, message: string) {
  console.error(`${PREFIX} ${step.padEnd(16)} | ERROR: ${message}`);
}

// ─── Seed Cleanup ───────────────────────────────────────────────────────────

async function cleanSeedData(): Promise<void> {
  log("CLEAN", "Removing previous seed data...");

  await db.run(sql`PRAGMA foreign_keys = OFF`);

  await db.delete(medicationAdministration);
  await db.delete(medicationOrder);
  await db.delete(observation);
  await db.delete(procedureRecord);
  await db.delete(diagnosis);
  await db.delete(encounterParticipant);
  await db.delete(encounter);
  await db.delete(appointment);
  await db.delete(allergyIntolerance);
  await db.delete(patient);
  await db.delete(practitioner);
  await db.delete(serviceUnit);
  await db.delete(site);
  await db.delete(organization);

  await db.run(sql`PRAGMA foreign_keys = ON`);

  log("CLEAN", "Previous seed data removed.");
}

async function hasExistingSeedData(): Promise<boolean> {
  const [org] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.repsCode, "1234567890"))
    .limit(1);
  return !!org;
}

// ─── Router Client ──────────────────────────────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: Router client proxy typing is complex; runtime structure is verified by usage.
type SeedClient = any;

let routerClient: SeedClient;

function getClient(): SeedClient {
  if (!routerClient) {
    const context = createSeedContext(db);
    routerClient = createRouterClient(appRouter, { context });
  }
  return routerClient;
}

// ─── RIPS Code Resolver ─────────────────────────────────────────────────────

interface CodeCache {
  [tableName: string]: Map<string, string>;
}

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const codeCache: CodeCache = {};

async function resolveCode(
  tableName: string,
  searchTerm: string
): Promise<string> {
  if (!codeCache[tableName]) {
    codeCache[tableName] = new Map();
  }

  const cached = codeCache[tableName].get(searchTerm);
  if (cached) {
    return cached;
  }

  const normalized = removeAccents(searchTerm);
  const variations = [
    searchTerm,
    searchTerm.toUpperCase(),
    searchTerm.toLowerCase(),
    normalized,
    normalized.toUpperCase(),
    normalized.toLowerCase(),
  ];

  for (const term of variations) {
    const baseWhere = and(
      eq(ripsReferenceEntry.tableName, tableName),
      eq(ripsReferenceEntry.enabled, true)
    );

    // Prefer exact prefix match for more precise results
    const [prefixEntry] = await db
      .select({ code: ripsReferenceEntry.code })
      .from(ripsReferenceEntry)
      .where(and(baseWhere, like(ripsReferenceEntry.name, `${term}%`)))
      .orderBy(ripsReferenceEntry.name)
      .limit(1);

    if (prefixEntry) {
      codeCache[tableName].set(searchTerm, prefixEntry.code);
      return prefixEntry.code;
    }

    // Fallback to substring match
    const [entry] = await db
      .select({ code: ripsReferenceEntry.code })
      .from(ripsReferenceEntry)
      .where(and(baseWhere, like(ripsReferenceEntry.name, `%${term}%`)))
      .orderBy(ripsReferenceEntry.name)
      .limit(1);

    if (entry) {
      codeCache[tableName].set(searchTerm, entry.code);
      return entry.code;
    }
  }

  throw new Error(
    `No enabled RIPS code found in '${tableName}' matching '${searchTerm}'. ` +
      "Sync catalogs first or use a different search term."
  );
}

async function getAnyEnabledCode(tableName: string): Promise<string> {
  if (!codeCache[tableName]) {
    codeCache[tableName] = new Map();
  }

  const cached = codeCache[tableName].get("__any__");
  if (cached) {
    return cached;
  }

  const [entry] = await db
    .select({ code: ripsReferenceEntry.code })
    .from(ripsReferenceEntry)
    .where(
      and(
        eq(ripsReferenceEntry.tableName, tableName),
        eq(ripsReferenceEntry.enabled, true)
      )
    )
    .limit(1);

  if (!entry) {
    throw new Error(
      `No enabled codes found in '${tableName}'. Sync catalogs first.`
    );
  }

  codeCache[tableName].set("__any__", entry.code);
  return entry.code;
}

// ─── Catalog Sync ───────────────────────────────────────────────────────────

async function syncCatalogs() {
  log("SYNC", "Starting SISPRO catalog synchronization...");
  const client = getClient();
  const result = await client.ripsReference.syncAll();

  if (result.errors.length > 0) {
    logError("SYNC", `${result.errors.length} tables failed to sync`);
    for (const err of result.errors) {
      logError("SYNC", `  - ${err}`);
    }
  }

  log("SYNC", `Completed. ${result.synced} tables synchronized.`);
  return result;
}

// ─── Facility Setup ─────────────────────────────────────────────────────────

interface FacilityContext {
  organizationId: string;
  practitioners: Array<{ id: string; fullName: string; specialty: string }>;
  serviceUnitId: string;
  siteId: string;
}

async function createFacilities(): Promise<FacilityContext> {
  log("FACILITIES", "Creating base facilities...");
  const client = getClient();

  const org = await client.facilities.createOrganization({
    name: "Clínica WellFit Principal",
    repsCode: "1234567890",
    status: "active",
    taxId: "900123456",
  });
  log("FACILITIES", `Organization: ${org.name} (${org.id})`);

  const site = await client.facilities.createSite({
    organizationId: org.id,
    siteCode: "WF-BOG-01",
    name: "Sede Bogotá Norte",
    municipalityCode: await getAnyEnabledCode("Municipio"),
    address: "Calle 100 # 15-30, Bogotá D.C.",
  });
  log("FACILITIES", `Site: ${site.name} (${site.id})`);

  const unit = await client.facilities.createServiceUnit({
    siteId: site.id,
    serviceCode: "CON-EXT",
    name: "Consulta Externa",
    careSetting: "ambulatory",
  });
  log("FACILITIES", `Service Unit: ${unit.name} (${unit.id})`);

  const practitionerData = [
    { fullName: "Dra. Carolina Mendoza", specialty: "Medicina Interna" },
    { fullName: "Dr. Fernando Castillo", specialty: "Cardiología" },
    { fullName: "Dra. Isabel Ramírez", specialty: "Pediatría" },
    { fullName: "Dr. Andrés Peña", specialty: "Dermatología" },
    { fullName: "Dra. Juliana Morales", specialty: "Psiquiatría" },
    { fullName: "Dr. Ricardo Salazar", specialty: "Gastroenterología" },
    { fullName: "Dra. Natalia Vargas", specialty: "Ginecología y Obstetricia" },
    { fullName: "Dr. Daniel Ortega", specialty: "Ortopedia y Traumatología" },
  ];

  const practitioners: Array<{
    fullName: string;
    id: string;
    specialty: string;
  }> = [];
  const docType = await getAnyEnabledCode("TipoIdPISIS");

  for (const [index, p] of practitionerData.entries()) {
    const docNum = String(52_000_000 + index);
    const created = await client.facilities.createPractitioner({
      documentType: docType,
      documentNumber: docNum,
      fullName: p.fullName,
      active: true,
      rethusNumber: `RET-${docNum}`,
    });
    practitioners.push({
      id: created.id,
      fullName: created.fullName,
      specialty: p.specialty,
    });
    log("FACILITIES", `Practitioner: ${created.fullName}`);
  }

  return {
    organizationId: org.id,
    siteId: site.id,
    serviceUnitId: unit.id,
    practitioners,
  };
}

// ─── Patient Narratives ─────────────────────────────────────────────────────

interface EncounterNarrative {
  appointmentReason: string;
  causeExternalSearch: string;
  condicionDestinoSearch: string;
  diagnosis: Array<{
    cie10Search: string;
    description: string;
    diagnosisTypeSearch: string;
  }>;
  encounterClassSearch: string;
  finalidadSearch: string;
  modalitySearch: string;
  notes?: string;
  observations: Array<{
    codeSearch?: string;
    observationType: string;
    unit?: string;
    valueNum?: number;
    valueText?: string;
  }>;
  procedures: Array<{
    cupsSearch: string;
    description: string;
  }>;
  reasonForVisit: string;
  serviceRequestSearch?: string;
  status: string;
}

interface PatientNarrative {
  birthDate: string;
  countrySearch: string;
  encounters: EncounterNarrative[];
  firstName: string;
  genderIdentity?: string;
  lastName1: string;
  lastName2: string;
  middleName?: string;
  municipalitySearch: string;
  sexAtBirth: string;
  zoneSearch: string;
}

function createNarratives(): PatientNarrative[] {
  return [
    {
      firstName: "María Elena",
      middleName: "",
      lastName1: "Rojas",
      lastName2: "Pérez",
      birthDate: "1967-03-15",
      sexAtBirth: "M",
      genderIdentity: "F",
      countrySearch: "Colombia",
      municipalitySearch: "Bogotá",
      zoneSearch: "Urbano",
      encounters: [
        {
          appointmentReason: "Control de diabetes mellitus tipo 2",
          reasonForVisit:
            "Control rutinario de diabetes. Paciente refiere poliuria y polidipsia leve.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "DETECCION TEMPRANA",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "DIABETES MELLITUS",
              description: "Diabetes mellitus tipo 2",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
            {
              cie10Search: "HIPERTENSION ESENCIAL",
              description: "Hipertensión esencial primaria",
              diagnosisTypeSearch: "Confirmado nuevo",
            },
          ],
          observations: [
            {
              observationType: "blood-pressure-systolic",
              valueNum: 145,
              unit: "mmHg",
            },
            {
              observationType: "blood-pressure-diastolic",
              valueNum: 92,
              unit: "mmHg",
            },
            { observationType: "weight", valueNum: 78, unit: "kg" },
            { observationType: "height", valueNum: 162, unit: "cm" },
            {
              observationType: "glucose-fasting",
              valueNum: 142,
              unit: "mg/dL",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta de medicina interna",
            },
          ],
        },
        {
          appointmentReason: "Seguimiento diabetes - ajuste medicación",
          reasonForVisit:
            "Seguimiento a 3 meses. HbA1c previa 8.2%. Adherencia parcial a dieta.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "DIABETES MELLITUS",
              description: "Diabetes mellitus tipo 2",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
            {
              cie10Search: "HIPERLIPIDEMIA MIXTA",
              description: "Dislipidemia mixta",
              diagnosisTypeSearch: "Confirmado nuevo",
            },
          ],
          observations: [
            {
              observationType: "blood-pressure-systolic",
              valueNum: 138,
              unit: "mmHg",
            },
            {
              observationType: "blood-pressure-diastolic",
              valueNum: 88,
              unit: "mmHg",
            },
            {
              observationType: "glucose-fasting",
              valueNum: 128,
              unit: "mg/dL",
            },
            {
              observationType: "hba1c",
              valueNum: 72,
              valueText: "7.2%",
              unit: "%",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta de control crónico",
            },
            {
              cupsSearch: "LABORATORIO",
              description: "Perfil lipídico y HbA1c",
            },
          ],
        },
        {
          appointmentReason: "Control mensual diabetes",
          reasonForVisit:
            "Control mensual. Paciente asintomática. Cumple con ejercicio y dieta.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "DIABETES MELLITUS",
              description: "Diabetes mellitus tipo 2 controlada",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            {
              observationType: "blood-pressure-systolic",
              valueNum: 132,
              unit: "mmHg",
            },
            {
              observationType: "blood-pressure-diastolic",
              valueNum: 84,
              unit: "mmHg",
            },
            {
              observationType: "glucose-fasting",
              valueNum: 118,
              unit: "mg/dL",
            },
            {
              observationType: "weight",
              valueNum: 75,
              unit: "kg",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta de control",
            },
          ],
        },
      ],
    },
    {
      firstName: "Carlos Andrés",
      middleName: "",
      lastName1: "Martínez",
      lastName2: "Giraldo",
      birthDate: "1991-08-22",
      sexAtBirth: "H",
      genderIdentity: "M",
      countrySearch: "Colombia",
      municipalitySearch: "Bogotá",
      zoneSearch: "Urbano",
      encounters: [
        {
          appointmentReason: "Crisis de asma leve",
          reasonForVisit:
            "Paciente refiere disnea expiratoria y sibilancias post-ejercicio.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "ASMA",
              description: "Asma alérgica leve persistente",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            {
              observationType: "respiratory-rate",
              valueNum: 22,
              unit: "rpm",
            },
            {
              observationType: "oxygen-saturation",
              valueNum: 96,
              unit: "%",
            },
            {
              observationType: "peak-flow",
              valueNum: 420,
              unit: "L/min",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta medicina general",
            },
            {
              cupsSearch: "ESPIROMETRIA",
              description: "Espirometría con broncodilatador",
            },
          ],
        },
        {
          appointmentReason: "Control asma - ajuste inhaladores",
          reasonForVisit:
            "Seguimiento post-espirometría. FEV1 85% del teórico. Buena técnica inhalatoria.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "ASMA",
              description: "Asma alérgica leve persistente",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            {
              observationType: "peak-flow",
              valueNum: 480,
              unit: "L/min",
            },
            {
              observationType: "oxygen-saturation",
              valueNum: 98,
              unit: "%",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta control asma",
            },
          ],
        },
      ],
    },
    {
      firstName: "Ana Lucía",
      middleName: "",
      lastName1: "Fernández",
      lastName2: "Suárez",
      birthDate: "1997-05-10",
      sexAtBirth: "M",
      genderIdentity: "F",
      countrySearch: "Colombia",
      municipalitySearch: "Bogotá",
      zoneSearch: "Urbano",
      encounters: [
        {
          appointmentReason: "Control prenatal primer trimestre",
          reasonForVisit:
            "Gestante de 10 semanas. Sin nauseas severas. Antecedentes familiales negativos.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "DETECCION TEMPRANA",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "EMBARAZO",
              description: "Embarazo de 10 semanas",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            { observationType: "weight", valueNum: 62, unit: "kg" },
            {
              observationType: "blood-pressure-systolic",
              valueNum: 110,
              unit: "mmHg",
            },
            {
              observationType: "blood-pressure-diastolic",
              valueNum: 70,
              unit: "mmHg",
            },
            { observationType: "heart-rate", valueNum: 88, unit: "bpm" },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta prenatal",
            },
            {
              cupsSearch: "ECOGRAFIA",
              description: "Ultrasonido obstétrico transabdominal",
            },
          ],
        },
        {
          appointmentReason: "Control prenatal segundo trimestre",
          reasonForVisit:
            "Gestante de 24 semanas. Feto activo. Sin edemas. Peso ganado 4kg.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "EMBARAZO",
              description: "Embarazo de 24 semanas",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            { observationType: "weight", valueNum: 66, unit: "kg" },
            {
              observationType: "blood-pressure-systolic",
              valueNum: 108,
              unit: "mmHg",
            },
            {
              observationType: "blood-pressure-diastolic",
              valueNum: 68,
              unit: "mmHg",
            },
            {
              observationType: "fundal-height",
              valueNum: 24,
              unit: "cm",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta prenatal",
            },
            {
              cupsSearch: "ECOGRAFIA",
              description: "Ecografía morfológica fetal",
            },
          ],
        },
        {
          appointmentReason: "Control prenatal tercer trimestre",
          reasonForVisit:
            "Gestante de 34 semanas. Feto en posición cefálica. Sin proteinuria.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "EMBARAZO",
              description: "Embarazo de 34 semanas",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            { observationType: "weight", valueNum: 70, unit: "kg" },
            {
              observationType: "blood-pressure-systolic",
              valueNum: 112,
              unit: "mmHg",
            },
            {
              observationType: "blood-pressure-diastolic",
              valueNum: 72,
              unit: "mmHg",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta prenatal",
            },
          ],
        },
      ],
    },
    {
      firstName: "Jorge Luis",
      middleName: "",
      lastName1: "Gómez",
      lastName2: "Vásquez",
      birthDate: "1953-11-30",
      sexAtBirth: "H",
      genderIdentity: "M",
      countrySearch: "Colombia",
      municipalitySearch: "Bogotá",
      zoneSearch: "Urbano",
      encounters: [
        {
          appointmentReason: "Control EPOC e insuficiencia cardíaca",
          reasonForVisit:
            "Paciente con disnea clase funcional NYHA II. Edemas leves en miembros inferiores.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "ENFERMEDAD PULMONAR OBSTRUCTIVA CRONICA",
              description: "Enfermedad pulmonar obstructiva crónica",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
            {
              cie10Search: "INSUFICIENCIA CARDIACA CONGESTIVA",
              description: "Insuficiencia cardíaca congestiva",
              diagnosisTypeSearch: "Confirmado nuevo",
            },
            {
              cie10Search: "ARTROSIS",
              description: "Artrosis de rodillas bilateral",
              diagnosisTypeSearch: "Confirmado nuevo",
            },
          ],
          observations: [
            {
              observationType: "oxygen-saturation",
              valueNum: 91,
              unit: "%",
            },
            {
              observationType: "respiratory-rate",
              valueNum: 24,
              unit: "rpm",
            },
            {
              observationType: "heart-rate",
              valueNum: 92,
              unit: "bpm",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta medicina interna",
            },
            {
              cupsSearch: "ELECTROCARDIOGRAMA",
              description: "Electrocardiograma de 12 derivaciones",
            },
          ],
        },
        {
          appointmentReason: "Seguimiento EPOC - exacerbación leve",
          reasonForVisit:
            "Exacerbación leve de EPOC post-IRA. Aumento de esputo purulento.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "ENFERMEDAD PULMONAR OBSTRUCTIVA CRONICA",
              description: "EPOC con exacerbación aguda leve",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            {
              observationType: "oxygen-saturation",
              valueNum: 89,
              unit: "%",
            },
            {
              observationType: "respiratory-rate",
              valueNum: 26,
              unit: "rpm",
            },
            {
              observationType: "temperature",
              valueNum: 37.8,
              unit: "°C",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta urgencias menor",
            },
            {
              cupsSearch: "RADIOGRAFIA",
              description: "Radiografía de tórax PA y lateral",
            },
          ],
        },
      ],
    },
    {
      firstName: "Sofia Isabel",
      middleName: "",
      lastName1: "Medina",
      lastName2: "López",
      birthDate: "2019-02-14",
      sexAtBirth: "M",
      genderIdentity: "F",
      countrySearch: "Colombia",
      municipalitySearch: "Bogotá",
      zoneSearch: "Urbano",
      encounters: [
        {
          appointmentReason: "Control pediátrico - crisis asmática",
          reasonForVisit:
            "Niña de 5 años con sibilancias nocturnas 2x semana. Sin fiebre.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "ASMA",
              description: "Asma intermitente pediátrica",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
            {
              cie10Search: "RINITIS ALERGICA",
              description: "Rinitis alérgica estacional",
              diagnosisTypeSearch: "Confirmado nuevo",
            },
          ],
          observations: [
            {
              observationType: "oxygen-saturation",
              valueNum: 97,
              unit: "%",
            },
            {
              observationType: "respiratory-rate",
              valueNum: 28,
              unit: "rpm",
            },
            {
              observationType: "weight",
              valueNum: 18,
              unit: "kg",
            },
            {
              observationType: "height",
              valueNum: 108,
              unit: "cm",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta pediatría",
            },
          ],
        },
        {
          appointmentReason: "Control pediátrico - seguimiento asma",
          reasonForVisit:
            "Mejoría con salbutamol PRN. Sin despertares nocturnos esta semana.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "ASMA",
              description: "Asma intermitente pediátrica en control",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            {
              observationType: "oxygen-saturation",
              valueNum: 99,
              unit: "%",
            },
            {
              observationType: "respiratory-rate",
              valueNum: 24,
              unit: "rpm",
            },
            {
              observationType: "weight",
              valueNum: 18.5,
              unit: "kg",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta pediatría de control",
            },
          ],
        },
      ],
    },
    {
      firstName: "Roberto Alejandro",
      middleName: "",
      lastName1: "Vega",
      lastName2: "Cárdenas",
      birthDate: "1980-06-05",
      sexAtBirth: "H",
      genderIdentity: "M",
      countrySearch: "Colombia",
      municipalitySearch: "Bogotá",
      zoneSearch: "Urbano",
      encounters: [
        {
          appointmentReason: "Dolor lumbar agudo post-levantamiento",
          reasonForVisit:
            "Dolor lumbar derecho irradiado a glúteo post-levantamiento de peso. EVA 7/10.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "OTRO TIPO DE ACCIDENTE",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "DORSALGIA",
              description: "Lumbalgia aguda mecánica",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
            {
              cie10Search: "CIATICA",
              description: "Ciática L5 derecha sospechada",
              diagnosisTypeSearch: "Confirmado nuevo",
            },
          ],
          observations: [
            { observationType: "pain-scale", valueNum: 7, unit: "EVA" },
            {
              observationType: "blood-pressure-systolic",
              valueNum: 135,
              unit: "mmHg",
            },
            {
              observationType: "blood-pressure-diastolic",
              valueNum: 85,
              unit: "mmHg",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta ortopedia",
            },
            {
              cupsSearch: "RADIOGRAFIA",
              description: "Radiografía de columna lumbosacra",
            },
          ],
        },
        {
          appointmentReason: "Seguimiento lumbalgia - resultado RM",
          reasonForVisit:
            "RM muestra hernia discal L4-L5 moderada. Dolor mejorado EVA 3/10.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "TRASTORNOS DE DISCO LUMBAR",
              description: "Hernia de disco lumbar L4-L5",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            { observationType: "pain-scale", valueNum: 3, unit: "EVA" },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta ortopedia de control",
            },
            {
              cupsSearch: "FISIOTERAPIA",
              description: "Sesión de fisioterapia rehabilitadora",
            },
          ],
        },
      ],
    },
    {
      firstName: "Diana Patricia",
      middleName: "",
      lastName1: "Castro",
      lastName2: "Morales",
      birthDate: "1986-09-18",
      sexAtBirth: "M",
      genderIdentity: "F",
      countrySearch: "Colombia",
      municipalitySearch: "Bogotá",
      zoneSearch: "Urbano",
      encounters: [
        {
          appointmentReason:
            "Primera consulta - ansiedad y síntomas depresivos",
          reasonForVisit:
            "Paciente refiere ansiedad generalizada, insomnio y disforia de 3 meses de evolución.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "TRASTORNO DE ANSIEDAD GENERALIZADA",
              description: "Trastorno de ansiedad generalizada",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
            {
              cie10Search: "TRASTORNO MIXTO DE ANSIEDAD Y DEPRESION",
              description: "Episodio depresivo leve",
              diagnosisTypeSearch: "Confirmado nuevo",
            },
          ],
          observations: [
            {
              observationType: "phq9-score",
              valueNum: 12,
              unit: "pts",
            },
            {
              observationType: "gad7-score",
              valueNum: 14,
              unit: "pts",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta psiquiatría",
            },
          ],
        },
        {
          appointmentReason: "Seguimiento psiquiatría - respuesta a SSRI",
          reasonForVisit:
            "Mejoría del 40% en síntomas ansiosos. Insomnio residual leve.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "TRASTORNO DE ANSIEDAD GENERALIZADA",
              description: "Trastorno de ansiedad generalizada en tratamiento",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            {
              observationType: "phq9-score",
              valueNum: 7,
              unit: "pts",
            },
            {
              observationType: "gad7-score",
              valueNum: 8,
              unit: "pts",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta psiquiatría de control",
            },
          ],
        },
      ],
    },
    {
      firstName: "Miguel Ángel",
      middleName: "",
      lastName1: "Torres",
      lastName2: "Ríos",
      birthDate: "1961-04-02",
      sexAtBirth: "H",
      genderIdentity: "M",
      countrySearch: "Colombia",
      municipalitySearch: "Bogotá",
      zoneSearch: "Urbano",
      encounters: [
        {
          appointmentReason: "Cardiología - post-infarto agudo de miocardio",
          reasonForVisit:
            "IAM STEMI hace 6 semanas. Asintomático actualmente. Rehabilitación cardiaca.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "INFARTO TRANSMURAL AGUDO",
              description: "Infarto agudo de miocardio reciente",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
            {
              cie10Search: "HIPERTENSION ESENCIAL",
              description: "Hipertensión arterial esencial",
              diagnosisTypeSearch: "Confirmado nuevo",
            },
            {
              cie10Search: "HIPERLIPIDEMIA MIXTA",
              description: "Hipercolesterolemia mixta",
              diagnosisTypeSearch: "Confirmado nuevo",
            },
          ],
          observations: [
            {
              observationType: "blood-pressure-systolic",
              valueNum: 128,
              unit: "mmHg",
            },
            {
              observationType: "blood-pressure-diastolic",
              valueNum: 78,
              unit: "mmHg",
            },
            {
              observationType: "heart-rate",
              valueNum: 68,
              unit: "bpm",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta cardiología",
            },
            {
              cupsSearch: "ELECTROCARDIOGRAMA",
              description: "ECG de reposo",
            },
          ],
        },
        {
          appointmentReason: "Seguimiento cardiología - ajuste medicación",
          reasonForVisit:
            "Sin angina. Tolerancia al ejercicio mejorada. LDL 78 mg/dL.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "INFARTO TRANSMURAL AGUDO",
              description: "IAM previo en rehabilitación",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            {
              observationType: "blood-pressure-systolic",
              valueNum: 122,
              unit: "mmHg",
            },
            {
              observationType: "blood-pressure-diastolic",
              valueNum: 76,
              unit: "mmHg",
            },
            {
              observationType: "heart-rate",
              valueNum: 64,
              unit: "bpm",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta cardiología de control",
            },
          ],
        },
      ],
    },
    {
      firstName: "Laura Cristina",
      middleName: "",
      lastName1: "Herrera",
      lastName2: "Bustamante",
      birthDate: "1994-12-08",
      sexAtBirth: "M",
      genderIdentity: "F",
      countrySearch: "Colombia",
      municipalitySearch: "Bogotá",
      zoneSearch: "Urbano",
      encounters: [
        {
          appointmentReason: "Dermatología - dermatitis eccematosa",
          reasonForVisit:
            "Lesiones eccematosas en pliegues flexurales de 2 meses. Prurito intenso.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "DERMATITIS ATOPICAS",
              description: "Dermatitis atópica moderada",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            {
              observationType: "scorad-score",
              valueNum: 35,
              unit: "pts",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta dermatología",
            },
            {
              cupsSearch: "BIOPSIA",
              description: "Biopsia de piel",
            },
          ],
        },
        {
          appointmentReason: "Dermatología - seguimiento biopsia",
          reasonForVisit:
            "Biopsia confirma dermatitis crónica. Mejoría parcial con corticoide tópico.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "DERMATITIS ATOPICAS",
              description: "Dermatitis atópica crónica",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            {
              observationType: "scorad-score",
              valueNum: 22,
              unit: "pts",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta dermatología de control",
            },
          ],
        },
      ],
    },
    {
      firstName: "Pedro Antonio",
      middleName: "",
      lastName1: "Díaz",
      lastName2: "Navarro",
      birthDate: "1973-07-25",
      sexAtBirth: "H",
      genderIdentity: "M",
      countrySearch: "Colombia",
      municipalitySearch: "Bogotá",
      zoneSearch: "Urbano",
      encounters: [
        {
          appointmentReason: "Gastroenterología - reflujo y dispepsia",
          reasonForVisit:
            "Pirosis postprandial de 4 meses. Regurgitación ácida nocturna.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "ENFERMEDAD DEL REFLUJO GASTROESOFAGICO",
              description: "Enfermedad por reflujo gastroesofágico",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
            {
              cie10Search: "GASTRITIS CRONICA SUPERFICIAL",
              description: "Gastritis crónica no especificada",
              diagnosisTypeSearch: "Confirmado nuevo",
            },
          ],
          observations: [
            {
              observationType: "weight",
              valueNum: 82,
              unit: "kg",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta gastroenterología",
            },
            {
              cupsSearch: "ENDOSCOPIA",
              description: "Endoscopia digestiva alta",
            },
          ],
        },
        {
          appointmentReason: "Gastroenterología - resultado endoscopia",
          reasonForVisit:
            "Endoscopia: esofagitis grado A de Los Ángeles. Helicobacter negativo.",
          encounterClassSearch: "Consulta externa",
          modalitySearch: "Intramural",
          finalidadSearch: "TRATAMIENTO",
          causeExternalSearch: "ENFERMEDAD GENERAL",
          condicionDestinoSearch: "DOMICILIO",
          status: "finished",
          diagnosis: [
            {
              cie10Search: "ENFERMEDAD DEL REFLUJO GASTROESOFAGICO",
              description: "ERGE con esofagitis grado A",
              diagnosisTypeSearch: "Impresión diagnóstica",
            },
          ],
          observations: [
            {
              observationType: "weight",
              valueNum: 81,
              unit: "kg",
            },
          ],
          procedures: [
            {
              cupsSearch: "CONSULTA DE PRIMERA VEZ POR MEDICINA",
              description: "Consulta gastroenterología de control",
            },
          ],
        },
      ],
    },
  ];
}

// ─── Data Creation Engine ───────────────────────────────────────────────────

interface SeedResult {
  allergiesCreated: number;
  appointmentsCreated: number;
  diagnosesCreated: number;
  encountersCreated: number;
  medicationsCreated: number;
  observationsCreated: number;
  patientsCreated: number;
  proceduresCreated: number;
}

interface EncounterStats {
  appointments: number;
  diagnoses: number;
  encounters: number;
  medications: number;
  observations: number;
  procedures: number;
}

async function createPatientRecord(
  narrative: PatientNarrative,
  docType: string,
  docIndex: number
) {
  const client = getClient();
  const countryCode = await resolveCode("Pais", narrative.countrySearch);
  const municipalityCode = await resolveCode(
    "Municipio",
    narrative.municipalitySearch
  );
  const zoneCode = await resolveCode("ZonaVersion2", narrative.zoneSearch);

  const patientDocNum = String(1_050_000_000 + docIndex);
  const patient = await client.patients.create({
    primaryDocumentType: docType,
    primaryDocumentNumber: patientDocNum,
    firstName: narrative.firstName,
    middleName: narrative.middleName || null,
    lastName1: narrative.lastName1,
    lastName2: narrative.lastName2 || null,
    birthDate: new Date(narrative.birthDate),
    sexAtBirth: narrative.sexAtBirth,
    genderIdentity: narrative.genderIdentity || null,
    countryCode,
    municipalityCode,
    zoneCode,
  });

  log(
    "PATIENT",
    `${patient.firstName} ${patient.lastName1} (${patient.id.slice(0, 8)})`
  );
  return patient;
}

async function createAllergyIfAsthma(
  patientId: string,
  narrative: PatientNarrative
) {
  const hasAsthma = narrative.encounters.some((e) =>
    e.diagnosis.some((d) => d.description.toLowerCase().includes("asma"))
  );

  if (!hasAsthma) {
    return false;
  }

  const client = getClient();
  await client.clinicalRecords.createAllergy({
    patientId,
    substanceCode: await getAnyEnabledCode("CIE10"),
    codeSystem: "CIE10",
    status: "active",
    criticality: "high",
    reactionText: "Broncoespasmo ante exposición a ácaros del polvo",
    recordedAt: new Date(),
    recordedBy: SEED_USER.id,
  });
  return true;
}

async function resolveEncounterCodes(encNarrative: EncounterNarrative) {
  const encounterClass = await resolveCode(
    "GrupoServicios",
    encNarrative.encounterClassSearch
  );
  const modality = await resolveCode(
    "ModalidadAtencion",
    encNarrative.modalitySearch
  );
  const finalidad = encNarrative.finalidadSearch
    ? await resolveCode(
        "RIPSFinalidadConsultaVersion2",
        encNarrative.finalidadSearch
      )
    : null;
  const causaExterna = encNarrative.causeExternalSearch
    ? await resolveCode(
        "RIPSCausaExternaVersion2",
        encNarrative.causeExternalSearch
      )
    : null;
  const condicionDestino = encNarrative.condicionDestinoSearch
    ? await resolveCode(
        "CondicionyDestinoUsuarioEgreso",
        encNarrative.condicionDestinoSearch
      )
    : null;

  return {
    encounterClass,
    modality,
    finalidad,
    causaExterna,
    condicionDestino,
  };
}

async function createEncounterBundle(
  patientId: string,
  encNarrative: EncounterNarrative,
  facility: FacilityContext,
  practitioner: { id: string },
  scheduledAt: Date,
  encounterIndex: number,
  docIndex: number
): Promise<{ stats: EncounterStats; diagnosisIds: string[] }> {
  const client = getClient();
  const stats: EncounterStats = {
    appointments: 0,
    diagnoses: 0,
    encounters: 0,
    medications: 0,
    observations: 0,
    procedures: 0,
  };

  await client.appointments.create({
    patientId,
    practitionerId: practitioner.id,
    siteId: facility.siteId,
    serviceUnitId: facility.serviceUnitId,
    scheduledAt,
    durationMinutes: 30,
    reason: encNarrative.appointmentReason,
    notes: encNarrative.notes || null,
  });
  stats.appointments++;

  const codes = await resolveEncounterCodes(encNarrative);
  const startedAt = new Date(scheduledAt.getTime() + 15 * 60_000);
  const endedAt = new Date(startedAt.getTime() + 30 * 60_000);

  const encounter = await client.encounters.create({
    patientId,
    siteId: facility.siteId,
    serviceUnitId: facility.serviceUnitId,
    encounterClass: codes.encounterClass,
    careModality: codes.modality,
    reasonForVisit: encNarrative.reasonForVisit,
    startedAt,
    status: "in-progress",
    finalidadConsultaCode: codes.finalidad,
    causeExternalCode: codes.causaExterna,
    condicionDestinoCode: codes.condicionDestino,
    modalidadAtencionCode: codes.modality,
  });
  stats.encounters++;

  await client.encounters.close({
    id: encounter.id,
    endedAt,
    status: encNarrative.status,
  });

  const diagnosisIds: string[] = [];
  for (const diag of encNarrative.diagnosis) {
    const cie10Code = await resolveCode("CIE10", diag.cie10Search);
    const diagType = await resolveCode(
      "RIPSTipoDiagnosticoPrincipalVersion2",
      diag.diagnosisTypeSearch
    );
    const created = await client.clinicalRecords.createDiagnosis({
      encounterId: encounter.id,
      code: cie10Code,
      codeSystem: "CIE10",
      description: diag.description,
      diagnosisType: diagType,
      certainty: "confirmed",
      rank: diagnosisIds.length + 1,
    });
    diagnosisIds.push(created.id);
    stats.diagnoses++;
  }

  for (const obs of encNarrative.observations) {
    await client.clinicalRecords.createObservation({
      patientId,
      encounterId: encounter.id,
      observationType: obs.observationType,
      code: obs.codeSearch || obs.observationType,
      codeSystem: "LOINC",
      valueNum: obs.valueNum ?? null,
      valueText: obs.valueText ?? String(obs.valueNum ?? ""),
      valueUnit: obs.unit || null,
      observedAt: startedAt,
      status: "final",
    });
    stats.observations++;
  }

  for (const proc of encNarrative.procedures) {
    const cupsCode = await resolveCode("CUPSRips", proc.cupsSearch);
    await client.clinicalRecords.createProcedure({
      patientId,
      encounterId: encounter.id,
      cupsCode,
      description: proc.description,
      status: "completed",
      performedAt: startedAt,
      performerId: practitioner.id,
    });
    stats.procedures++;
  }

  if (encounterIndex === 0 || encounterIndex === 1) {
    await createMedicationForEncounter(
      patientId,
      encounter.id,
      practitioner.id,
      diagnosisIds,
      encNarrative,
      startedAt,
      docIndex,
      encounterIndex
    );
    stats.medications++;
  }

  return { stats, diagnosisIds };
}

async function createMedicationForEncounter(
  patientId: string,
  encounterId: string,
  prescriberId: string,
  diagnosisIds: string[],
  encNarrative: EncounterNarrative,
  startedAt: Date,
  docIndex: number,
  encounterIndex: number
) {
  const client = getClient();
  const medNames = [
    {
      generic: "Metformina",
      concentration: "500 mg",
      dose: "1",
      unit: "tableta",
      route: "oral",
      freq: "Cada 12 horas",
      dur: "90 días",
      qty: "180",
    },
    {
      generic: "Losartán",
      concentration: "50 mg",
      dose: "1",
      unit: "tableta",
      route: "oral",
      freq: "Cada 24 horas",
      dur: "90 días",
      qty: "90",
    },
    {
      generic: "Salbutamol",
      concentration: "100 mcg",
      dose: "2",
      unit: "inhalación",
      route: "inhalatoria",
      freq: "Cada 8 horas PRN",
      dur: "30 días",
      qty: "1 inhalador",
    },
    {
      generic: "Ácido fólico",
      concentration: "5 mg",
      dose: "1",
      unit: "tableta",
      route: "oral",
      freq: "Cada 24 horas",
      dur: "90 días",
      qty: "90",
    },
    {
      generic: "Omeprazol",
      concentration: "20 mg",
      dose: "1",
      unit: "cápsula",
      route: "oral",
      freq: "30 min antes del desayuno",
      dur: "60 días",
      qty: "60",
    },
  ];

  const medIndex = (docIndex + encounterIndex) % medNames.length;
  const selectedMed = medNames[medIndex];
  if (!selectedMed) {
    throw new Error("Invalid medication selection index.");
  }

  const primaryDiagnosis = encNarrative.diagnosis[0];

  await client.medicationOrders.create({
    patientId,
    encounterId,
    prescriberId,
    diagnosisId: diagnosisIds[0] ?? null,
    genericName: selectedMed.generic,
    concentration: selectedMed.concentration,
    dosageForm: "Tableta",
    dose: selectedMed.dose,
    doseUnit: selectedMed.unit,
    routeCode: selectedMed.route,
    frequencyText: selectedMed.freq,
    durationText: selectedMed.dur,
    quantityTotal: selectedMed.qty,
    indications: primaryDiagnosis?.description ?? null,
    status: "active",
    signedAt: startedAt,
  });
}

async function createPatientData(
  narrative: PatientNarrative,
  facility: FacilityContext,
  docIndex: number
): Promise<{
  patientId: string;
  stats: Partial<SeedResult>;
}> {
  const docType = await getAnyEnabledCode("TipoIdPISIS");
  const patient = await createPatientRecord(narrative, docType, docIndex);

  const stats: Partial<SeedResult> = {
    patientsCreated: 1,
    allergiesCreated: 0,
    appointmentsCreated: 0,
    encountersCreated: 0,
    diagnosesCreated: 0,
    observationsCreated: 0,
    proceduresCreated: 0,
    medicationsCreated: 0,
  };

  const hasAllergy = await createAllergyIfAsthma(patient.id, narrative);
  if (hasAllergy) {
    stats.allergiesCreated = 1;
  }

  const practitioner =
    facility.practitioners[docIndex % facility.practitioners.length];
  if (!practitioner) {
    throw new Error("No practitioner available for patient.");
  }

  for (const [encounterIndex, encNarrative] of narrative.encounters.entries()) {
    const scheduledAt = new Date(
      Date.now() -
        (narrative.encounters.length - encounterIndex) *
          30 *
          24 *
          60 *
          60 *
          1000
    );

    const bundle = await createEncounterBundle(
      patient.id,
      encNarrative,
      facility,
      practitioner,
      scheduledAt,
      encounterIndex,
      docIndex
    );

    stats.appointmentsCreated =
      (stats.appointmentsCreated ?? 0) + bundle.stats.appointments;
    stats.encountersCreated =
      (stats.encountersCreated ?? 0) + bundle.stats.encounters;
    stats.diagnosesCreated =
      (stats.diagnosesCreated ?? 0) + bundle.stats.diagnoses;
    stats.observationsCreated =
      (stats.observationsCreated ?? 0) + bundle.stats.observations;
    stats.proceduresCreated =
      (stats.proceduresCreated ?? 0) + bundle.stats.procedures;
    stats.medicationsCreated =
      (stats.medicationsCreated ?? 0) + bundle.stats.medications;
  }

  return { patientId: patient.id, stats };
}

// ─── Main Seed Runner ───────────────────────────────────────────────────────

export async function runSeed(
  options: { clean?: boolean } = {}
): Promise<SeedResult> {
  log("START", "WellFit EMR Seed Script");
  log("START", `Seed user: ${SEED_USER.email}`);

  const hasData = await hasExistingSeedData();

  if (hasData && !options.clean) {
    logError(
      "START",
      "Existing seed data detected. Run with --clean to overwrite, or use a fresh database."
    );
    throw new Error(
      "Seed data already exists. Use --clean flag to remove previous data before seeding."
    );
  }

  if (options.clean && hasData) {
    await cleanSeedData();
  }

  // Ensure seed user exists
  await ensureSeedUserExists(db);
  log("AUTH", `Seed user ready: ${SEED_USER.id}`);

  // Sync catalogs first (REQUIRED — no hardcoded codes)
  await syncCatalogs();

  // Create facilities
  const facility = await createFacilities();

  // Create patients with narratives
  const narratives = createNarratives();
  log(
    "PATIENTS",
    `Creating ${narratives.length} patients with full histories...`
  );

  const totals: SeedResult = {
    allergiesCreated: 0,
    appointmentsCreated: 0,
    diagnosesCreated: 0,
    encountersCreated: 0,
    medicationsCreated: 0,
    observationsCreated: 0,
    patientsCreated: 0,
    proceduresCreated: 0,
  };

  for (const [index, narrative] of narratives.entries()) {
    const { stats } = await createPatientData(narrative, facility, index);
    totals.patientsCreated += stats.patientsCreated ?? 0;
    totals.appointmentsCreated += stats.appointmentsCreated ?? 0;
    totals.encountersCreated += stats.encountersCreated ?? 0;
    totals.diagnosesCreated += stats.diagnosesCreated ?? 0;
    totals.observationsCreated += stats.observationsCreated ?? 0;
    totals.proceduresCreated += stats.proceduresCreated ?? 0;
    totals.medicationsCreated += stats.medicationsCreated ?? 0;
    totals.allergiesCreated += stats.allergiesCreated ?? 0;
  }

  // Summary
  log("DONE", "Seed completed successfully!");
  log("DONE", `Patients:      ${totals.patientsCreated}`);
  log("DONE", `Appointments:  ${totals.appointmentsCreated}`);
  log("DONE", `Encounters:    ${totals.encountersCreated}`);
  log("DONE", `Diagnoses:     ${totals.diagnosesCreated}`);
  log("DONE", `Observations:  ${totals.observationsCreated}`);
  log("DONE", `Procedures:    ${totals.proceduresCreated}`);
  log("DONE", `Medications:   ${totals.medicationsCreated}`);
  log("DONE", `Allergies:     ${totals.allergiesCreated}`);

  return totals;
}

// ─── CLI Entrypoint ─────────────────────────────────────────────────────────

if (import.meta.main) {
  const clean = process.argv.includes("--clean");
  runSeed({ clean }).catch((error: unknown) => {
    logError("FATAL", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}
