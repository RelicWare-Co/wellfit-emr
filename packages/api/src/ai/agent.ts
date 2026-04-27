import { fireworks } from "@ai-sdk/fireworks";
import {
  allergyIntolerance,
  attachmentLink,
  auditEvent,
  binaryObject,
  clinicalDocument,
  clinicalDocumentVersion,
  consentRecord,
  dataDisclosureAuthorization,
  diagnosis,
  diagnosticReport,
  documentSection,
  encounter,
  incapacityCertificate,
  interconsultation,
  type JsonRecord,
  medicationOrder,
  observation,
  patient,
  practitioner,
  procedureRecord,
  serviceRequest,
} from "@wellfit-emr/db/schema/clinical";
import {
  ripsReferenceEntry,
  ripsReferenceTable,
} from "@wellfit-emr/db/schema/rips-reference";
import { stepCountIs, ToolLoopAgent, type ToolSet, tool } from "ai";
import { and, asc, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../context";
import {
  RIPS_TABLE_NAMES,
  validateRipsCode,
} from "../services/rips-validation";

export const SYSTEM_PROMPT = `Eres un asistente médico de WellFit EMR, un sistema de Historia Clínica Electrónica conforme a la normativa colombiana (Ley 23 de 1981, Resolución 1995 de 1999, Ley 2015 de 2020, Resolución 866 de 2021, Resolución 1888 de 2025, Ley 1581 de 2012).

Tu rol es asistir a médicos y profesionales de salud en:
- Consultar información clínica de pacientes
- Revisar historias clínicas, diagnósticos, alergias y medicamentos
- Crear prescripciones médicas (órdenes de medicación)
- Registrar diagnósticos, signos vitales/observaciones, procedimientos, órdenes de servicio, interconsultas e incapacidades cuando el usuario lo solicite explícitamente
- Preparar borradores de documentos clínicos para revisión y firma manual
- Generar resúmenes clínicos
- Consultar catálogos RIPS/SISPRO (CIE-10, CUPS, etc.)
- Responder preguntas sobre normatividad colombiana en salud

REGLAS IMPORTANTES:
1. Siempre verifica la identidad del paciente antes de dar información clínica
2. Nunca inventes datos clínicos que no existan en el sistema
3. Para prescripciones, primero revisa alergias, medicamentos activos, atención activa y profesional prescriptor; luego usa create_medication_order solo si el usuario pidió crear la prescripción de forma explícita.
4. Para cualquier escritura clínica (diagnósticos, observaciones, procedimientos, órdenes, interconsultas, incapacidades o documentos), confirma que el usuario pidió registrar/crear explícitamente y valida paciente, atención y profesional cuando aplique.
5. Nunca firmes documentos clínicos desde el chat; solo puedes crear borradores para revisión y firma manual.
6. Indica claramente cuando algo es una sugerencia vs un dato del sistema.
7. Usa terminología médica colombiana (CIE-10 para diagnósticos, CUPS para procedimientos).
8. Responde en español por defecto.
9. Si no tienes un paciente seleccionado, pide al usuario que seleccione uno primero.
10. No entregues diagnósticos definitivos ni sustituyas el criterio clínico del médico; prioriza resúmenes, verificación de datos, alertas de seguridad y borradores accionables.`;

interface MedicalToolOptions {
  selectedPatientId?: string | null;
  userId?: string | null;
}

interface MedicalAgentOptions extends MedicalToolOptions {
  instructions?: string;
}

function formatToolError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Error inesperado al ejecutar la herramienta.";
}

function logToolFailure(toolName: string, error: unknown) {
  console.error(`[ai-chat] tool ${toolName} failed`, error);
}

function withToolObservability<TTools extends ToolSet>(tools: TTools): TTools {
  const instrumented = {} as TTools;

  for (const [toolName, toolDefinition] of Object.entries(tools) as [
    keyof TTools & string,
    TTools[keyof TTools & string],
  ][]) {
    const execute = toolDefinition.execute;

    if (!execute) {
      instrumented[toolName] = toolDefinition;
      continue;
    }

    instrumented[toolName] = {
      ...toolDefinition,
      execute: async (input, options) => {
        const startedAt = performance.now();
        console.info(`[ai-chat] tool ${toolName} started`);

        try {
          const output = await execute(input, options);
          console.info(`[ai-chat] tool ${toolName} completed`, {
            durationMs: Math.round(performance.now() - startedAt),
          });
          return output;
        } catch (error) {
          logToolFailure(toolName, error);
          return {
            error: formatToolError(error),
            success: false,
          };
        }
      },
    };
  }

  return instrumented;
}

export function createMedicalTools(db: Db, options: MedicalToolOptions = {}) {
  const assertSelectedPatient = (patientId: string) => {
    if (options.selectedPatientId && patientId !== options.selectedPatientId) {
      return {
        ok: false as const,
        error:
          "La herramienta solo puede operar sobre el paciente seleccionado en la conversación.",
      };
    }

    return { ok: true as const };
  };

  const assertEncounterForSelectedPatient = async (encounterId: string) => {
    if (!options.selectedPatientId) {
      return { ok: true as const };
    }

    const [foundEncounter] = await db
      .select({ patientId: encounter.patientId })
      .from(encounter)
      .where(eq(encounter.id, encounterId))
      .limit(1);

    if (foundEncounter?.patientId === options.selectedPatientId) {
      return { ok: true as const };
    }

    return {
      ok: false as const,
      error:
        "La atención solicitada no pertenece al paciente seleccionado en la conversación.",
    };
  };

  const assertActivePractitioner = async (practitionerId: string) => {
    const [foundPractitioner] = await db
      .select({ active: practitioner.active, id: practitioner.id })
      .from(practitioner)
      .where(eq(practitioner.id, practitionerId))
      .limit(1);

    if (foundPractitioner?.active) {
      return { ok: true as const };
    }

    return {
      ok: false as const,
      error: "El profesional no existe o no está activo.",
    };
  };

  const assertPatientEncounter = async (
    patientId: string,
    encounterId: string
  ) => {
    const selectedPatientCheck = assertSelectedPatient(patientId);
    if (!selectedPatientCheck.ok) {
      return selectedPatientCheck;
    }

    const [foundEncounter] = await db
      .select({ patientId: encounter.patientId })
      .from(encounter)
      .where(eq(encounter.id, encounterId))
      .limit(1);

    if (foundEncounter?.patientId === patientId) {
      return { ok: true as const };
    }

    return {
      ok: false as const,
      error:
        "La atención indicada no existe o no pertenece al paciente seleccionado.",
    };
  };

  const formatDate = (value: Date | null) =>
    value ? value.toLocaleDateString("es-CO") : null;

  const parseToolDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(
        `Fecha inválida: '${value}'. Usa formato ISO o YYYY-MM-DD.`
      );
    }

    return parsed;
  };

  const parseOptionalToolDate = (value: string | null) =>
    value ? parseToolDate(value) : null;

  const normalizeText = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  type AllergyRecord = typeof allergyIntolerance.$inferSelect;
  type MedicationOrderRecord = typeof medicationOrder.$inferSelect;

  const collectMedicationSafetyWarnings = (input: {
    activeMedications: MedicationOrderRecord[];
    allergies: AllergyRecord[];
    proposedMedicationGenericName: string | null;
  }) => {
    const warnings: string[] = [];

    if (input.allergies.length > 0) {
      warnings.push("El paciente tiene alergias activas registradas.");
    }

    if (!input.proposedMedicationGenericName) {
      return warnings;
    }

    const normalizedMedication = normalizeText(
      input.proposedMedicationGenericName
    );
    const duplicateMedication = input.activeMedications.find((item) =>
      normalizeText(item.genericName).includes(normalizedMedication)
    );
    if (duplicateMedication) {
      warnings.push(
        `Posible duplicidad con medicamento activo: ${duplicateMedication.genericName}.`
      );
    }

    const possibleAllergy = input.allergies.find((item) => {
      const substance = normalizeText(item.substanceCode);
      return (
        substance.includes(normalizedMedication) ||
        normalizedMedication.includes(substance)
      );
    });
    if (possibleAllergy) {
      warnings.push(
        `Posible relación con alergia activa: ${possibleAllergy.substanceCode}.`
      );
    }

    return warnings;
  };

  const collectCareContextWarnings = async (input: {
    activeEncounterFound: boolean;
    encounterId: string | null;
    patientId: string;
    prescriberId: string | null;
  }) => {
    const warnings: string[] = [];

    if (input.encounterId) {
      const encounterCheck = await assertPatientEncounter(
        input.patientId,
        input.encounterId
      );
      if (!encounterCheck.ok) {
        warnings.push(encounterCheck.error);
      }
    } else if (!input.activeEncounterFound) {
      warnings.push("No hay atención activa para este paciente.");
    }

    if (input.prescriberId) {
      const practitionerCheck = await assertActivePractitioner(
        input.prescriberId
      );
      if (!practitionerCheck.ok) {
        warnings.push(practitionerCheck.error);
      }
    }

    return warnings;
  };

  const assertAttachmentScope = async (
    linkedEntityType: string,
    linkedEntityId: string
  ) => {
    if (!options.selectedPatientId) {
      return { ok: true as const };
    }

    if (linkedEntityType === "patient") {
      return assertSelectedPatient(linkedEntityId);
    }

    if (linkedEntityType === "encounter") {
      return assertEncounterForSelectedPatient(linkedEntityId);
    }

    if (linkedEntityType === "clinical_document") {
      const [doc] = await db
        .select({ patientId: clinicalDocument.patientId })
        .from(clinicalDocument)
        .where(eq(clinicalDocument.id, linkedEntityId))
        .limit(1);

      return doc?.patientId === options.selectedPatientId
        ? { ok: true as const }
        : {
            ok: false as const,
            error:
              "El documento solicitado no pertenece al paciente seleccionado.",
          };
    }

    if (linkedEntityType === "service_request") {
      const [request] = await db
        .select({ patientId: serviceRequest.patientId })
        .from(serviceRequest)
        .where(eq(serviceRequest.id, linkedEntityId))
        .limit(1);

      return request?.patientId === options.selectedPatientId
        ? { ok: true as const }
        : {
            ok: false as const,
            error: "La orden solicitada no pertenece al paciente seleccionado.",
          };
    }

    return {
      ok: false as const,
      error:
        "No se puede verificar el alcance del anexo para el paciente seleccionado.",
    };
  };

  const computeSha256 = async (input: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const recordAuditEvent = async (input: {
    actionCode: string;
    patientId?: string | null;
    encounterId?: string | null;
    entityType: string;
    entityId?: string | null;
    resultCode: string;
  }) => {
    if (!options.userId) {
      return;
    }

    await db
      .insert(auditEvent)
      .values({
        patientId: input.patientId ?? null,
        encounterId: input.encounterId ?? null,
        userId: options.userId,
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        occurredAt: new Date(),
        channel: "ai-chat",
        resultCode: input.resultCode,
      })
      .catch((error) => {
        console.error("[ai-chat] failed to record audit event", error);
      });
  };

  const tools = {
    search_rips_reference: tool({
      description:
        "Buscar códigos oficiales en catálogos RIPS/SISPRO por tabla, código o nombre. Útil para CIE-10, CUPS, tipos de diagnóstico, vías y otros catálogos regulatorios.",
      inputSchema: z.object({
        tableName: z
          .string()
          .nullable()
          .describe(
            "Nombre exacto de la tabla RIPS/SISPRO. Si no se conoce, enviar null para buscar en tablas comunes."
          ),
        search: z.string().describe("Texto, código o nombre a buscar"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(25)
          .default(10)
          .describe("Número máximo de resultados"),
      }),
      execute: async ({ tableName, search, limit }) => {
        const searchTerm = `%${search}%`;
        const commonTables = [
          RIPS_TABLE_NAMES.cie10,
          RIPS_TABLE_NAMES.cups,
          RIPS_TABLE_NAMES.tipoDiagnosticoPrincipal,
          RIPS_TABLE_NAMES.finalidadConsulta,
          RIPS_TABLE_NAMES.causaExterna,
          RIPS_TABLE_NAMES.modalidadAtencion,
          RIPS_TABLE_NAMES.viaIngreso,
        ];

        const filters = [
          eq(ripsReferenceEntry.enabled, true),
          tableName
            ? eq(ripsReferenceEntry.tableName, tableName)
            : or(
                ...commonTables.map((name) =>
                  eq(ripsReferenceEntry.tableName, name)
                )
              ),
          or(
            like(ripsReferenceEntry.code, searchTerm),
            like(ripsReferenceEntry.name, searchTerm)
          ),
        ];

        const results = await db
          .select({
            code: ripsReferenceEntry.code,
            description: ripsReferenceEntry.description,
            name: ripsReferenceEntry.name,
            tableName: ripsReferenceEntry.tableName,
          })
          .from(ripsReferenceEntry)
          .where(and(...filters))
          .orderBy(
            asc(ripsReferenceEntry.tableName),
            asc(ripsReferenceEntry.code)
          )
          .limit(limit);

        return results;
      },
    }),

    list_rips_tables: tool({
      description:
        "Listar catálogos RIPS/SISPRO disponibles para saber qué tableName usar en search_rips_reference.",
      inputSchema: z.object({
        search: z
          .string()
          .nullable()
          .describe("Filtro opcional por nombre de tabla"),
        limit: z.number().int().min(1).max(50).default(25),
      }),
      execute: async ({ search, limit }) => {
        const filters = [
          eq(ripsReferenceTable.isActive, true),
          search ? like(ripsReferenceTable.name, `%${search}%`) : undefined,
        ].filter((filter) => filter !== undefined);

        const tables = await db
          .select({
            description: ripsReferenceTable.description,
            entryCount: ripsReferenceTable.entryCount,
            lastSyncedAt: ripsReferenceTable.lastSyncedAt,
            name: ripsReferenceTable.name,
          })
          .from(ripsReferenceTable)
          .where(filters.length > 0 ? and(...filters) : undefined)
          .orderBy(asc(ripsReferenceTable.name))
          .limit(limit);

        return tables.map((table) => ({
          ...table,
          lastSyncedAt: formatDate(table.lastSyncedAt),
        }));
      },
    }),

    search_patients: tool({
      description:
        "Buscar pacientes por nombre o número de documento. Retorna una lista de pacientes que coincidan con el criterio de búsqueda.",
      inputSchema: z.object({
        search: z
          .string()
          .describe(
            "Término de búsqueda: nombre, apellido, o número de documento"
          ),
      }),
      execute: async ({ search }) => {
        const results = await db
          .select({
            id: patient.id,
            firstName: patient.firstName,
            middleName: patient.middleName,
            lastName1: patient.lastName1,
            lastName2: patient.lastName2,
            primaryDocumentType: patient.primaryDocumentType,
            primaryDocumentNumber: patient.primaryDocumentNumber,
            birthDate: patient.birthDate,
            sexAtBirth: patient.sexAtBirth,
          })
          .from(patient)
          .where(
            search
              ? or(
                  like(patient.firstName, `%${search}%`),
                  like(patient.lastName1, `%${search}%`),
                  like(patient.primaryDocumentNumber, `%${search}%`)
                )
              : undefined
          )
          .orderBy(desc(patient.createdAt))
          .limit(10);

        return results.map((p) => ({
          id: p.id,
          fullName: `${p.firstName}${p.middleName ? ` ${p.middleName}` : ""} ${p.lastName1}${p.lastName2 ? ` ${p.lastName2}` : ""}`,
          document: `${p.primaryDocumentType} ${p.primaryDocumentNumber}`,
          birthDate: new Date(p.birthDate).toLocaleDateString("es-CO"),
          sexAtBirth: p.sexAtBirth,
        }));
      },
    }),

    get_patient: tool({
      description:
        "Obtener información detallada de un paciente por su ID. Incluye datos demográficos.",
      inputSchema: z.object({
        patientId: z.string().describe("ID del paciente"),
      }),
      execute: async ({ patientId }) => {
        const selectedPatientCheck = assertSelectedPatient(patientId);
        if (!selectedPatientCheck.ok) {
          return { error: selectedPatientCheck.error };
        }

        const [found] = await db
          .select()
          .from(patient)
          .where(eq(patient.id, patientId))
          .limit(1);

        if (!found) {
          return { error: "Paciente no encontrado" };
        }
        return {
          id: found.id,
          fullName: `${found.firstName}${found.middleName ? ` ${found.middleName}` : ""} ${found.lastName1}${found.lastName2 ? ` ${found.lastName2}` : ""}`,
          document: `${found.primaryDocumentType} ${found.primaryDocumentNumber}`,
          birthDate: new Date(found.birthDate).toLocaleDateString("es-CO"),
          sexAtBirth: found.sexAtBirth,
          genderIdentity: found.genderIdentity,
          countryCode: found.countryCode,
          municipalityCode: found.municipalityCode,
        };
      },
    }),

    get_patient_timeline: tool({
      description:
        "Obtener una línea de tiempo clínica compacta del paciente seleccionado: atenciones, diagnósticos, alergias, medicamentos, documentos, órdenes, interconsultas e incapacidades recientes.",
      inputSchema: z.object({
        patientId: z.string().describe("ID del paciente"),
        limit: z.number().int().min(1).max(20).default(8),
      }),
      execute: async ({ patientId, limit }) => {
        const selectedPatientCheck = assertSelectedPatient(patientId);
        if (!selectedPatientCheck.ok) {
          return { error: selectedPatientCheck.error };
        }

        const [
          encounters,
          allergies,
          medications,
          documents,
          requests,
          incapacities,
        ] = await Promise.all([
          db
            .select()
            .from(encounter)
            .where(eq(encounter.patientId, patientId))
            .orderBy(desc(encounter.startedAt))
            .limit(limit),
          db
            .select()
            .from(allergyIntolerance)
            .where(eq(allergyIntolerance.patientId, patientId))
            .orderBy(desc(allergyIntolerance.recordedAt))
            .limit(limit),
          db
            .select()
            .from(medicationOrder)
            .where(eq(medicationOrder.patientId, patientId))
            .orderBy(desc(medicationOrder.signedAt))
            .limit(limit),
          db
            .select()
            .from(clinicalDocument)
            .where(eq(clinicalDocument.patientId, patientId))
            .orderBy(desc(clinicalDocument.createdAt))
            .limit(limit),
          db
            .select()
            .from(serviceRequest)
            .where(eq(serviceRequest.patientId, patientId))
            .orderBy(desc(serviceRequest.requestedAt))
            .limit(limit),
          db
            .select()
            .from(incapacityCertificate)
            .where(eq(incapacityCertificate.patientId, patientId))
            .orderBy(desc(incapacityCertificate.issuedAt))
            .limit(limit),
        ]);

        const encounterIds = encounters.map((item) => item.id);
        const [diagnoses, procedures, interconsultations] =
          encounterIds.length > 0
            ? await Promise.all([
                db
                  .select()
                  .from(diagnosis)
                  .where(
                    or(
                      ...encounterIds.map((id) => eq(diagnosis.encounterId, id))
                    )
                  )
                  .limit(limit * 4),
                db
                  .select()
                  .from(procedureRecord)
                  .where(
                    or(
                      ...encounterIds.map((id) =>
                        eq(procedureRecord.encounterId, id)
                      )
                    )
                  )
                  .limit(limit * 4),
                db
                  .select()
                  .from(interconsultation)
                  .where(
                    or(
                      ...encounterIds.map((id) =>
                        eq(interconsultation.encounterId, id)
                      )
                    )
                  )
                  .orderBy(desc(interconsultation.requestedAt))
                  .limit(limit),
              ])
            : [[], [], []];

        return {
          allergies: allergies.map((item) => ({
            criticality: item.criticality,
            reactionText: item.reactionText,
            recordedAt: formatDate(item.recordedAt),
            status: item.status,
            substanceCode: item.substanceCode,
          })),
          diagnoses: diagnoses.map((item) => ({
            certainty: item.certainty,
            code: item.code,
            description: item.description,
            diagnosisType: item.diagnosisType,
            encounterId: item.encounterId,
            rank: item.rank,
          })),
          documents: documents.map((item) => ({
            createdAt: formatDate(item.createdAt),
            documentType: item.documentType,
            encounterId: item.encounterId,
            id: item.id,
            status: item.status,
          })),
          encounters: encounters.map((item) => ({
            careModality: item.careModality,
            encounterClass: item.encounterClass,
            endedAt: formatDate(item.endedAt),
            id: item.id,
            reasonForVisit: item.reasonForVisit,
            startedAt: formatDate(item.startedAt),
            status: item.status,
          })),
          incapacities: incapacities.map((item) => ({
            conceptText: item.conceptText,
            endDate: formatDate(item.endDate),
            id: item.id,
            issuedAt: formatDate(item.issuedAt),
            startDate: formatDate(item.startDate),
          })),
          interconsultations: interconsultations.map((item) => ({
            encounterId: item.encounterId,
            id: item.id,
            reasonText: item.reasonText,
            requestedAt: formatDate(item.requestedAt),
            requestedSpecialty: item.requestedSpecialty,
            status: item.status,
          })),
          medications: medications.map((item) => ({
            dose: item.dose,
            durationText: item.durationText,
            frequencyText: item.frequencyText,
            genericName: item.genericName,
            id: item.id,
            signedAt: formatDate(item.signedAt),
            status: item.status,
          })),
          procedures: procedures.map((item) => ({
            cupsCode: item.cupsCode,
            description: item.description,
            encounterId: item.encounterId,
            performedAt: formatDate(item.performedAt),
            status: item.status,
          })),
          serviceRequests: requests.map((item) => ({
            id: item.id,
            priority: item.priority,
            requestCode: item.requestCode,
            requestedAt: formatDate(item.requestedAt),
            requestType: item.requestType,
            status: item.status,
          })),
        };
      },
    }),

    clinical_safety_check: tool({
      description:
        "Revisar alertas clínicas simples antes de una prescripción o plan: alergias activas, medicamentos activos, duplicidad probable, atención activa y profesional prescriptor.",
      inputSchema: z.object({
        patientId: z.string().describe("ID del paciente"),
        proposedMedicationGenericName: z
          .string()
          .nullable()
          .describe("Medicamento propuesto para revisar duplicidad/alergias"),
        encounterId: z
          .string()
          .nullable()
          .describe("Atención que se planea usar, si aplica"),
        prescriberId: z
          .string()
          .nullable()
          .describe("Profesional prescriptor, si aplica"),
      }),
      execute: async ({
        encounterId,
        patientId,
        prescriberId,
        proposedMedicationGenericName,
      }) => {
        const selectedPatientCheck = assertSelectedPatient(patientId);
        if (!selectedPatientCheck.ok) {
          return { error: selectedPatientCheck.error, safeToProceed: false };
        }

        const [allergies, medications, activeEncounter] = await Promise.all([
          db
            .select()
            .from(allergyIntolerance)
            .where(
              and(
                eq(allergyIntolerance.patientId, patientId),
                eq(allergyIntolerance.status, "active")
              )
            )
            .orderBy(desc(allergyIntolerance.recordedAt)),
          db
            .select()
            .from(medicationOrder)
            .where(eq(medicationOrder.patientId, patientId))
            .orderBy(desc(medicationOrder.signedAt)),
          db
            .select()
            .from(encounter)
            .where(
              and(
                eq(encounter.patientId, patientId),
                eq(encounter.status, "in-progress")
              )
            )
            .orderBy(desc(encounter.startedAt))
            .limit(1),
        ]);

        const activeMedications = medications.filter(
          (item) => item.status === "active"
        );
        const currentActiveEncounter = activeEncounter.at(0);
        const warnings = [
          ...collectMedicationSafetyWarnings({
            activeMedications,
            allergies,
            proposedMedicationGenericName,
          }),
          ...(await collectCareContextWarnings({
            activeEncounterFound: Boolean(currentActiveEncounter),
            encounterId,
            patientId,
            prescriberId,
          })),
        ];

        return {
          activeAllergies: allergies.map((item) => ({
            criticality: item.criticality,
            reactionText: item.reactionText,
            substanceCode: item.substanceCode,
          })),
          activeEncounter: currentActiveEncounter
            ? {
                id: currentActiveEncounter.id,
                reasonForVisit: currentActiveEncounter.reasonForVisit,
                startedAt: formatDate(currentActiveEncounter.startedAt),
              }
            : null,
          activeMedications: activeMedications.map((item) => ({
            dose: item.dose,
            frequencyText: item.frequencyText,
            genericName: item.genericName,
            id: item.id,
          })),
          safeToProceed: warnings.length === 0,
          warnings,
        };
      },
    }),

    get_patient_encounters: tool({
      description:
        "Obtener las atenciones (encuentros clínicos) de un paciente, ordenadas por fecha más reciente.",
      inputSchema: z.object({
        patientId: z.string().describe("ID del paciente"),
        limit: z.number().default(10).describe("Número máximo de resultados"),
      }),
      execute: async ({ patientId, limit }) => {
        const selectedPatientCheck = assertSelectedPatient(patientId);
        if (!selectedPatientCheck.ok) {
          return { error: selectedPatientCheck.error };
        }

        const encounters = await db
          .select()
          .from(encounter)
          .where(eq(encounter.patientId, patientId))
          .orderBy(desc(encounter.startedAt))
          .limit(limit);

        return encounters.map((e) => ({
          id: e.id,
          reasonForVisit: e.reasonForVisit,
          status: e.status,
          encounterClass: e.encounterClass,
          careModality: e.careModality,
          startedAt: new Date(e.startedAt).toLocaleDateString("es-CO"),
          endedAt: e.endedAt
            ? new Date(e.endedAt).toLocaleDateString("es-CO")
            : null,
        }));
      },
    }),

    get_patient_diagnoses: tool({
      description:
        "Obtener los diagnósticos (CIE-10) de una atención clínica específica.",
      inputSchema: z.object({
        encounterId: z.string().describe("ID de la atención clínica"),
      }),
      execute: async ({ encounterId }) => {
        const selectedEncounterCheck =
          await assertEncounterForSelectedPatient(encounterId);
        if (!selectedEncounterCheck.ok) {
          return { error: selectedEncounterCheck.error };
        }

        const diagnoses = await db
          .select()
          .from(diagnosis)
          .where(eq(diagnosis.encounterId, encounterId));

        return diagnoses.map((d) => ({
          code: d.code,
          description: d.description,
          diagnosisType: d.diagnosisType,
          certainty: d.certainty,
          rank: d.rank,
        }));
      },
    }),

    get_patient_allergies: tool({
      description:
        "Obtener las alergias registradas de un paciente. CRÍTICO para prescripciones médicas.",
      inputSchema: z.object({
        patientId: z.string().describe("ID del paciente"),
      }),
      execute: async ({ patientId }) => {
        const selectedPatientCheck = assertSelectedPatient(patientId);
        if (!selectedPatientCheck.ok) {
          return { error: selectedPatientCheck.error };
        }

        const allergies = await db
          .select()
          .from(allergyIntolerance)
          .where(eq(allergyIntolerance.patientId, patientId))
          .orderBy(desc(allergyIntolerance.recordedAt));

        return allergies.map((a) => ({
          substanceCode: a.substanceCode,
          criticality: a.criticality,
          reactionText: a.reactionText,
          status: a.status,
        }));
      },
    }),

    get_patient_observations: tool({
      description:
        "Obtener signos vitales y observaciones clínicas de una atención.",
      inputSchema: z.object({
        encounterId: z.string().describe("ID de la atención clínica"),
      }),
      execute: async ({ encounterId }) => {
        const selectedEncounterCheck =
          await assertEncounterForSelectedPatient(encounterId);
        if (!selectedEncounterCheck.ok) {
          return { error: selectedEncounterCheck.error };
        }

        const observations = await db
          .select()
          .from(observation)
          .where(eq(observation.encounterId, encounterId));

        return observations.map((o) => ({
          type: o.observationType,
          valueText: o.valueText,
          valueNum: o.valueNum,
          valueUnit: o.valueUnit,
          observedAt: new Date(o.observedAt).toLocaleDateString("es-CO"),
        }));
      },
    }),

    get_patient_medications: tool({
      description:
        "Obtener las prescripciones/medicamentos de un paciente, ordenadas por fecha más reciente.",
      inputSchema: z.object({
        patientId: z.string().describe("ID del paciente"),
      }),
      execute: async ({ patientId }) => {
        const selectedPatientCheck = assertSelectedPatient(patientId);
        if (!selectedPatientCheck.ok) {
          return { error: selectedPatientCheck.error };
        }

        const medications = await db
          .select()
          .from(medicationOrder)
          .where(eq(medicationOrder.patientId, patientId))
          .orderBy(desc(medicationOrder.signedAt));

        return medications.map((m) => ({
          id: m.id,
          genericName: m.genericName,
          dose: m.dose,
          doseUnit: m.doseUnit,
          route: m.routeCode,
          frequency: m.frequencyText,
          duration: m.durationText,
          status: m.status,
          concentration: m.concentration,
          dosageForm: m.dosageForm,
          indications: m.indications,
          signedAt: new Date(m.signedAt).toLocaleDateString("es-CO"),
        }));
      },
    }),

    get_patient_procedures: tool({
      description: "Obtener los procedimientos CUPS de una atención clínica.",
      inputSchema: z.object({
        encounterId: z.string().describe("ID de la atención clínica"),
      }),
      execute: async ({ encounterId }) => {
        const selectedEncounterCheck =
          await assertEncounterForSelectedPatient(encounterId);
        if (!selectedEncounterCheck.ok) {
          return { error: selectedEncounterCheck.error };
        }

        const procedures = await db
          .select()
          .from(procedureRecord)
          .where(eq(procedureRecord.encounterId, encounterId));

        return procedures.map((p) => ({
          cupsCode: p.cupsCode,
          description: p.description,
          status: p.status,
          performedAt: p.performedAt
            ? new Date(p.performedAt).toLocaleDateString("es-CO")
            : null,
        }));
      },
    }),

    create_diagnosis: tool({
      description:
        "Crear un diagnóstico CIE-10 en una atención. Solo usar cuando el usuario pida explícitamente registrar/crear el diagnóstico.",
      inputSchema: z.object({
        certainty: z.string().nullable().describe("Certeza diagnóstica"),
        code: z.string().describe("Código CIE-10"),
        description: z.string().describe("Descripción del diagnóstico"),
        diagnosisType: z.string().describe("Código RIPS de tipo diagnóstico"),
        encounterId: z.string().describe("ID de la atención"),
        onsetAt: z
          .string()
          .nullable()
          .describe("Fecha de inicio en formato ISO o YYYY-MM-DD"),
        rank: z.number().int().nullable().describe("Orden/prioridad"),
      }),
      execute: async (input) => {
        const selectedEncounterCheck = await assertEncounterForSelectedPatient(
          input.encounterId
        );
        if (!selectedEncounterCheck.ok) {
          await recordAuditEvent({
            actionCode: "ai.diagnosis.create.denied",
            encounterId: input.encounterId,
            entityType: "diagnosis",
            resultCode: "denied",
          });
          return { success: false, error: selectedEncounterCheck.error };
        }

        const [targetEncounter] = await db
          .select({ patientId: encounter.patientId })
          .from(encounter)
          .where(eq(encounter.id, input.encounterId))
          .limit(1);

        if (!targetEncounter) {
          return { success: false, error: "Atención no encontrada." };
        }

        const cieEntry = await validateRipsCode(
          db,
          RIPS_TABLE_NAMES.cie10,
          input.code,
          { requireEnabled: true }
        );
        await validateRipsCode(
          db,
          RIPS_TABLE_NAMES.tipoDiagnosticoPrincipal,
          input.diagnosisType,
          { requireEnabled: true }
        );

        const [created] = await db
          .insert(diagnosis)
          .values({
            certainty: input.certainty,
            code: input.code,
            codeSystem: "CIE10",
            description: input.description,
            diagnosisType: input.diagnosisType,
            encounterId: input.encounterId,
            id: crypto.randomUUID(),
            onsetAt: parseOptionalToolDate(input.onsetAt),
            rank: input.rank,
            ripsReferenceName: cieEntry.name,
          })
          .returning();

        if (!created) {
          return { success: false, error: "Error al crear el diagnóstico." };
        }

        await recordAuditEvent({
          actionCode: "ai.diagnosis.create",
          encounterId: created.encounterId,
          entityId: created.id,
          entityType: "diagnosis",
          patientId: targetEncounter.patientId,
          resultCode: "success",
        });

        return { diagnosis: created, success: true };
      },
    }),

    create_observation: tool({
      description:
        "Registrar una observación clínica o signo vital en una atención. Solo usar con solicitud explícita del usuario.",
      inputSchema: z.object({
        code: z.string().nullable().describe("Código clínico opcional"),
        codeSystem: z
          .string()
          .nullable()
          .describe("Sistema de código opcional"),
        encounterId: z.string().describe("ID de la atención"),
        observationType: z
          .string()
          .describe("Tipo de observación, ej: blood-pressure, heart-rate"),
        observedAt: z
          .string()
          .describe("Fecha/hora de observación en formato ISO o YYYY-MM-DD"),
        patientId: z.string().describe("ID del paciente"),
        status: z.string().default("final").describe("Estado de observación"),
        valueNum: z.number().nullable().describe("Valor numérico opcional"),
        valueText: z.string().nullable().describe("Valor textual opcional"),
        valueUnit: z.string().nullable().describe("Unidad opcional"),
      }),
      execute: async (input) => {
        const encounterCheck = await assertPatientEncounter(
          input.patientId,
          input.encounterId
        );
        if (!encounterCheck.ok) {
          await recordAuditEvent({
            actionCode: "ai.observation.create.denied",
            encounterId: input.encounterId,
            entityType: "observation",
            patientId: input.patientId,
            resultCode: "denied",
          });
          return { success: false, error: encounterCheck.error };
        }

        const [created] = await db
          .insert(observation)
          .values({
            code: input.code,
            codeSystem: input.codeSystem,
            encounterId: input.encounterId,
            id: crypto.randomUUID(),
            observationType: input.observationType,
            observedAt: parseToolDate(input.observedAt),
            patientId: input.patientId,
            status: input.status,
            valueNum: input.valueNum,
            valueText: input.valueText,
            valueUnit: input.valueUnit,
          })
          .returning();

        if (!created) {
          return { success: false, error: "Error al crear la observación." };
        }

        await recordAuditEvent({
          actionCode: "ai.observation.create",
          encounterId: created.encounterId,
          entityId: created.id,
          entityType: "observation",
          patientId: created.patientId,
          resultCode: "success",
        });

        return { observation: created, success: true };
      },
    }),

    create_procedure: tool({
      description:
        "Registrar un procedimiento CUPS en una atención. Solo usar cuando el usuario pida explícitamente registrar el procedimiento.",
      inputSchema: z.object({
        cupsCode: z.string().describe("Código CUPS"),
        description: z.string().describe("Descripción del procedimiento"),
        encounterId: z.string().describe("ID de la atención"),
        patientId: z.string().describe("ID del paciente"),
        performedAt: z
          .string()
          .nullable()
          .describe("Fecha de realización en formato ISO o YYYY-MM-DD"),
        performerId: z.string().nullable().describe("Profesional ejecutor"),
        status: z.string().default("completed").describe("Estado"),
      }),
      execute: async (input) => {
        const encounterCheck = await assertPatientEncounter(
          input.patientId,
          input.encounterId
        );
        if (!encounterCheck.ok) {
          await recordAuditEvent({
            actionCode: "ai.procedure.create.denied",
            encounterId: input.encounterId,
            entityType: "procedure_record",
            patientId: input.patientId,
            resultCode: "denied",
          });
          return { success: false, error: encounterCheck.error };
        }

        if (input.performerId) {
          const practitionerCheck = await assertActivePractitioner(
            input.performerId
          );
          if (!practitionerCheck.ok) {
            return { success: false, error: practitionerCheck.error };
          }
        }

        const cupsEntry = await validateRipsCode(
          db,
          RIPS_TABLE_NAMES.cups,
          input.cupsCode,
          { requireEnabled: true }
        );

        const [created] = await db
          .insert(procedureRecord)
          .values({
            cupsCode: input.cupsCode,
            description: input.description,
            encounterId: input.encounterId,
            id: crypto.randomUUID(),
            patientId: input.patientId,
            performedAt: parseOptionalToolDate(input.performedAt),
            performerId: input.performerId,
            ripsReferenceName: cupsEntry.name,
            status: input.status,
          })
          .returning();

        if (!created) {
          return { success: false, error: "Error al crear el procedimiento." };
        }

        await recordAuditEvent({
          actionCode: "ai.procedure.create",
          encounterId: created.encounterId,
          entityId: created.id,
          entityType: "procedure_record",
          patientId: created.patientId,
          resultCode: "success",
        });

        return { procedure: created, success: true };
      },
    }),

    create_medication_order: tool({
      description:
        "Crear una nueva orden de medicación/prescripción para un paciente. REQUIERE: patientId, encounterId, prescriberId, y todos los campos del medicamento.",
      inputSchema: z.object({
        patientId: z.string().describe("ID del paciente"),
        encounterId: z.string().describe("ID de la atención clínica activa"),
        prescriberId: z.string().describe("ID del profesional que prescribe"),
        genericName: z.string().describe("Nombre genérico del medicamento"),
        concentration: z.string().describe("Concentración (ej: 500mg)"),
        dosageForm: z
          .string()
          .describe("Forma farmacéutica (ej: Tableta, Cápsula, Jarabe)"),
        dose: z.string().describe("Dosis (ej: 1 tableta, 10ml)"),
        doseUnit: z.string().nullable().describe("Unidad de dosis"),
        routeCode: z
          .string()
          .describe("Vía de administración (ej: Oral, IV, IM)"),
        frequencyText: z
          .string()
          .describe("Frecuencia (ej: Cada 8 horas, Cada 12 horas)"),
        durationText: z
          .string()
          .describe("Duración del tratamiento (ej: 7 días, 30 días)"),
        quantityTotal: z
          .string()
          .describe("Cantidad total a dispensar (ej: 21 tabletas)"),
        indications: z
          .string()
          .nullable()
          .describe("Indicaciones adicionales para el paciente"),
        atcCode: z.string().nullable().describe("Código ATC del medicamento"),
        diagnosisId: z
          .string()
          .nullable()
          .describe("ID del diagnóstico asociado"),
      }),
      execute: async (input) => {
        const selectedPatientCheck = assertSelectedPatient(input.patientId);
        if (!selectedPatientCheck.ok) {
          await recordAuditEvent({
            actionCode: "ai.medication_order.create.denied",
            patientId: input.patientId,
            encounterId: input.encounterId,
            entityType: "medication_order",
            resultCode: "denied",
          });
          return { success: false, error: selectedPatientCheck.error };
        }

        const [targetEncounter] = await db
          .select({ patientId: encounter.patientId, status: encounter.status })
          .from(encounter)
          .where(eq(encounter.id, input.encounterId))
          .limit(1);

        if (!targetEncounter || targetEncounter.patientId !== input.patientId) {
          await recordAuditEvent({
            actionCode: "ai.medication_order.create.failed",
            patientId: input.patientId,
            encounterId: input.encounterId,
            entityType: "medication_order",
            resultCode: "failed",
          });
          return {
            success: false,
            error:
              "La atención indicada no existe o no pertenece al paciente seleccionado.",
          };
        }

        const [targetPractitioner] = await db
          .select({ id: practitioner.id, active: practitioner.active })
          .from(practitioner)
          .where(eq(practitioner.id, input.prescriberId))
          .limit(1);

        if (!targetPractitioner?.active) {
          await recordAuditEvent({
            actionCode: "ai.medication_order.create.failed",
            patientId: input.patientId,
            encounterId: input.encounterId,
            entityType: "medication_order",
            resultCode: "failed",
          });
          return {
            success: false,
            error: "El profesional prescriptor no existe o no está activo.",
          };
        }

        const [created] = await db
          .insert(medicationOrder)
          .values({
            id: crypto.randomUUID(),
            patientId: input.patientId,
            encounterId: input.encounterId,
            prescriberId: input.prescriberId,
            genericName: input.genericName,
            concentration: input.concentration,
            dosageForm: input.dosageForm,
            dose: input.dose,
            doseUnit: input.doseUnit,
            routeCode: input.routeCode,
            frequencyText: input.frequencyText,
            durationText: input.durationText,
            quantityTotal: input.quantityTotal,
            indications: input.indications,
            atcCode: input.atcCode,
            diagnosisId: input.diagnosisId,
            status: "active",
            signedAt: new Date(),
          })
          .returning();

        if (!created) {
          await recordAuditEvent({
            actionCode: "ai.medication_order.create.failed",
            patientId: input.patientId,
            encounterId: input.encounterId,
            entityType: "medication_order",
            resultCode: "failed",
          });
          return { success: false, error: "Error al crear la prescripción" };
        }

        await recordAuditEvent({
          actionCode: "ai.medication_order.create",
          patientId: created.patientId,
          encounterId: created.encounterId,
          entityType: "medication_order",
          entityId: created.id,
          resultCode: "success",
        });

        return {
          success: true,
          medicationOrderId: created.id,
          message: `Prescripción creada: ${created.genericName} ${created.dose} ${created.frequencyText} por ${created.durationText}. Estado: ${created.status}`,
          prescription: {
            atcCode: created.atcCode,
            concentration: created.concentration,
            dosageForm: created.dosageForm,
            dose: created.dose,
            doseUnit: created.doseUnit,
            durationText: created.durationText,
            frequencyText: created.frequencyText,
            genericName: created.genericName,
            id: created.id,
            indications: created.indications,
            patientId: created.patientId,
            prescriberId: created.prescriberId,
            quantityTotal: created.quantityTotal,
            routeCode: created.routeCode,
            signedAt: created.signedAt.toISOString(),
            status: created.status,
          },
        };
      },
    }),

    get_active_encounter: tool({
      description:
        "Obtener la atención activa (en progreso) más reciente de un paciente.",
      inputSchema: z.object({
        patientId: z.string().describe("ID del paciente"),
      }),
      execute: async ({ patientId }) => {
        const selectedPatientCheck = assertSelectedPatient(patientId);
        if (!selectedPatientCheck.ok) {
          return { found: false, message: selectedPatientCheck.error };
        }

        const [activeEncounter] = await db
          .select()
          .from(encounter)
          .where(
            and(
              eq(encounter.patientId, patientId),
              eq(encounter.status, "in-progress")
            )
          )
          .orderBy(desc(encounter.startedAt))
          .limit(1);

        if (!activeEncounter) {
          return {
            found: false,
            message: "No hay atención activa para este paciente",
          };
        }

        return {
          found: true,
          id: activeEncounter.id,
          reasonForVisit: activeEncounter.reasonForVisit,
          startedAt: new Date(activeEncounter.startedAt).toLocaleDateString(
            "es-CO"
          ),
          encounterClass: activeEncounter.encounterClass,
          careModality: activeEncounter.careModality,
        };
      },
    }),

    list_clinical_documents: tool({
      description:
        "Listar documentos clínicos de un paciente o atención para ubicar evoluciones, notas, epicrisis u otros soportes.",
      inputSchema: z.object({
        encounterId: z.string().nullable().describe("Filtro por atención"),
        limit: z.number().int().min(1).max(25).default(10),
        patientId: z.string().describe("ID del paciente"),
      }),
      execute: async ({ encounterId, limit, patientId }) => {
        const selectedPatientCheck = assertSelectedPatient(patientId);
        if (!selectedPatientCheck.ok) {
          return { error: selectedPatientCheck.error };
        }

        if (encounterId) {
          const encounterCheck = await assertPatientEncounter(
            patientId,
            encounterId
          );
          if (!encounterCheck.ok) {
            return { error: encounterCheck.error };
          }
        }

        const filters = [
          eq(clinicalDocument.patientId, patientId),
          encounterId
            ? eq(clinicalDocument.encounterId, encounterId)
            : undefined,
        ].filter((filter) => filter !== undefined);

        const documents = await db
          .select()
          .from(clinicalDocument)
          .where(and(...filters))
          .orderBy(desc(clinicalDocument.createdAt))
          .limit(limit);

        return documents.map((item) => ({
          createdAt: formatDate(item.createdAt),
          documentType: item.documentType,
          encounterId: item.encounterId,
          id: item.id,
          status: item.status,
        }));
      },
    }),

    get_clinical_document: tool({
      description:
        "Obtener el contenido, versión actual, secciones y hash de un documento clínico.",
      inputSchema: z.object({
        documentId: z.string().describe("ID del documento clínico"),
      }),
      execute: async ({ documentId }) => {
        const [doc] = await db
          .select()
          .from(clinicalDocument)
          .where(eq(clinicalDocument.id, documentId))
          .limit(1);

        if (!doc) {
          return { error: "Documento clínico no encontrado." };
        }

        const selectedPatientCheck = assertSelectedPatient(doc.patientId);
        if (!selectedPatientCheck.ok) {
          return { error: selectedPatientCheck.error };
        }

        const [version] = doc.currentVersionId
          ? await db
              .select()
              .from(clinicalDocumentVersion)
              .where(eq(clinicalDocumentVersion.id, doc.currentVersionId))
              .limit(1)
          : [];
        const sections = version
          ? await db
              .select()
              .from(documentSection)
              .where(eq(documentSection.documentVersionId, version.id))
              .orderBy(asc(documentSection.sectionOrder))
          : [];

        await recordAuditEvent({
          actionCode: "ai.clinical_document.read",
          encounterId: doc.encounterId,
          entityId: doc.id,
          entityType: "clinical_document",
          patientId: doc.patientId,
          resultCode: "success",
        });

        return {
          document: {
            createdAt: formatDate(doc.createdAt),
            documentType: doc.documentType,
            encounterId: doc.encounterId,
            id: doc.id,
            patientId: doc.patientId,
            status: doc.status,
          },
          sections,
          version: version
            ? {
                createdAt: formatDate(version.createdAt),
                hashSha256: version.hashSha256,
                id: version.id,
                isCurrent: version.isCurrent,
                payloadJson: version.payloadJson,
                signedAt: formatDate(version.signedAt),
                textRendered: version.textRendered,
                versionNo: version.versionNo,
              }
            : null,
        };
      },
    }),

    draft_clinical_document: tool({
      description:
        "Crear un borrador de documento clínico con secciones estructuradas. No firma documentos. Solo usar con solicitud explícita del usuario.",
      inputSchema: z.object({
        authorPractitionerId: z.string().describe("Profesional autor"),
        documentType: z.string().describe("Tipo de documento clínico"),
        encounterId: z.string().describe("ID de la atención"),
        patientId: z.string().describe("ID del paciente"),
        payloadJson: z.record(z.string(), z.unknown()),
        sections: z.array(
          z.object({
            sectionCode: z.string(),
            sectionOrder: z.number().int(),
            sectionPayloadJson: z.record(z.string(), z.unknown()),
          })
        ),
        textRendered: z.string().nullable().describe("Texto renderizado"),
      }),
      execute: async (input) => {
        if (!options.userId) {
          return {
            success: false,
            error: "No hay usuario autenticado para crear el documento.",
          };
        }

        const encounterCheck = await assertPatientEncounter(
          input.patientId,
          input.encounterId
        );
        if (!encounterCheck.ok) {
          await recordAuditEvent({
            actionCode: "ai.clinical_document.draft.denied",
            encounterId: input.encounterId,
            entityType: "clinical_document",
            patientId: input.patientId,
            resultCode: "denied",
          });
          return { success: false, error: encounterCheck.error };
        }

        const practitionerCheck = await assertActivePractitioner(
          input.authorPractitionerId
        );
        if (!practitionerCheck.ok) {
          return { success: false, error: practitionerCheck.error };
        }

        const payloadJson = input.payloadJson as JsonRecord;
        const hash = await computeSha256(JSON.stringify(payloadJson));
        const created = await db.transaction(async (tx) => {
          const [doc] = await tx
            .insert(clinicalDocument)
            .values({
              createdBy: options.userId as string,
              currentVersionId: null,
              documentType: input.documentType,
              encounterId: input.encounterId,
              id: crypto.randomUUID(),
              patientId: input.patientId,
              status: "draft",
            })
            .returning();

          if (!doc) {
            return null;
          }

          const [version] = await tx
            .insert(clinicalDocumentVersion)
            .values({
              authorPractitionerId: input.authorPractitionerId,
              authorUserId: options.userId as string,
              documentId: doc.id,
              hashSha256: hash,
              id: crypto.randomUUID(),
              isCurrent: true,
              payloadJson,
              textRendered: input.textRendered,
              versionNo: 1,
            })
            .returning();

          if (!version) {
            return null;
          }

          if (input.sections.length > 0) {
            await tx.insert(documentSection).values(
              input.sections.map((section) => ({
                documentVersionId: version.id,
                id: crypto.randomUUID(),
                sectionCode: section.sectionCode,
                sectionOrder: section.sectionOrder,
                sectionPayloadJson: section.sectionPayloadJson as JsonRecord,
              }))
            );
          }

          const [updatedDoc] = await tx
            .update(clinicalDocument)
            .set({ currentVersionId: version.id })
            .where(eq(clinicalDocument.id, doc.id))
            .returning();

          return updatedDoc ? { document: updatedDoc, version } : null;
        });

        if (!created) {
          return {
            success: false,
            error: "Error al crear el borrador de documento clínico.",
          };
        }

        await recordAuditEvent({
          actionCode: "ai.clinical_document.draft.create",
          encounterId: created.document.encounterId,
          entityId: created.document.id,
          entityType: "clinical_document",
          patientId: created.document.patientId,
          resultCode: "success",
        });

        return {
          documentId: created.document.id,
          message:
            "Borrador de documento clínico creado. Requiere revisión y firma manual.",
          success: true,
          versionId: created.version.id,
        };
      },
    }),

    list_service_requests: tool({
      description:
        "Listar órdenes de servicio y ayudas diagnósticas de un paciente o atención.",
      inputSchema: z.object({
        encounterId: z.string().nullable(),
        limit: z.number().int().min(1).max(25).default(10),
        patientId: z.string().describe("ID del paciente"),
      }),
      execute: async ({ encounterId, limit, patientId }) => {
        const selectedPatientCheck = assertSelectedPatient(patientId);
        if (!selectedPatientCheck.ok) {
          return { error: selectedPatientCheck.error };
        }

        const filters = [
          eq(serviceRequest.patientId, patientId),
          encounterId ? eq(serviceRequest.encounterId, encounterId) : undefined,
        ].filter((filter) => filter !== undefined);

        const requests = await db
          .select()
          .from(serviceRequest)
          .where(and(...filters))
          .orderBy(desc(serviceRequest.requestedAt))
          .limit(limit);

        return requests.map((item) => ({
          encounterId: item.encounterId,
          id: item.id,
          priority: item.priority,
          requestCode: item.requestCode,
          requestedAt: formatDate(item.requestedAt),
          requestedBy: item.requestedBy,
          requestType: item.requestType,
          status: item.status,
        }));
      },
    }),

    create_service_request: tool({
      description:
        "Crear una orden de servicio/ayuda diagnóstica. Solo usar cuando el usuario lo pida explícitamente.",
      inputSchema: z.object({
        encounterId: z.string(),
        patientId: z.string(),
        priority: z.string().default("routine"),
        requestCode: z.string(),
        requestType: z.string(),
        requestedBy: z.string(),
        ripsTableName: z
          .string()
          .nullable()
          .describe("Tabla RIPS para validar requestCode, usualmente CUPSRips"),
      }),
      execute: async (input) => {
        const encounterCheck = await assertPatientEncounter(
          input.patientId,
          input.encounterId
        );
        if (!encounterCheck.ok) {
          await recordAuditEvent({
            actionCode: "ai.service_request.create.denied",
            encounterId: input.encounterId,
            entityType: "service_request",
            patientId: input.patientId,
            resultCode: "denied",
          });
          return { success: false, error: encounterCheck.error };
        }

        const practitionerCheck = await assertActivePractitioner(
          input.requestedBy
        );
        if (!practitionerCheck.ok) {
          return { success: false, error: practitionerCheck.error };
        }

        if (input.ripsTableName) {
          await validateRipsCode(db, input.ripsTableName, input.requestCode, {
            requireEnabled: true,
          });
        }

        const [created] = await db
          .insert(serviceRequest)
          .values({
            encounterId: input.encounterId,
            id: crypto.randomUUID(),
            patientId: input.patientId,
            priority: input.priority,
            requestCode: input.requestCode,
            requestedAt: new Date(),
            requestedBy: input.requestedBy,
            requestType: input.requestType,
            status: "active",
          })
          .returning();

        if (!created) {
          return { success: false, error: "Error al crear la orden." };
        }

        await recordAuditEvent({
          actionCode: "ai.service_request.create",
          encounterId: created.encounterId,
          entityId: created.id,
          entityType: "service_request",
          patientId: created.patientId,
          resultCode: "success",
        });

        return { serviceRequest: created, success: true };
      },
    }),

    get_diagnostic_report: tool({
      description:
        "Consultar el reporte diagnóstico asociado a una orden de servicio.",
      inputSchema: z.object({
        requestId: z.string().describe("ID de la orden de servicio"),
      }),
      execute: async ({ requestId }) => {
        const [request] = await db
          .select()
          .from(serviceRequest)
          .where(eq(serviceRequest.id, requestId))
          .limit(1);

        if (!request) {
          return { error: "Orden de servicio no encontrada." };
        }

        const selectedPatientCheck = assertSelectedPatient(request.patientId);
        if (!selectedPatientCheck.ok) {
          return { error: selectedPatientCheck.error };
        }

        const [report] = await db
          .select()
          .from(diagnosticReport)
          .where(eq(diagnosticReport.requestId, requestId))
          .limit(1);

        if (!report) {
          return { found: false, message: "No hay reporte diagnóstico." };
        }

        return {
          found: true,
          report: {
            conclusionText: report.conclusionText,
            encounterId: report.encounterId,
            id: report.id,
            issuedAt: formatDate(report.issuedAt),
            reportType: report.reportType,
            status: report.status,
          },
        };
      },
    }),

    create_interconsultation: tool({
      description:
        "Crear una interconsulta/remisión. Solo usar cuando el usuario lo pida explícitamente.",
      inputSchema: z.object({
        encounterId: z.string(),
        patientId: z.string(),
        reasonText: z.string(),
        requestedBy: z.string(),
        requestedSpecialty: z.string(),
      }),
      execute: async (input) => {
        const encounterCheck = await assertPatientEncounter(
          input.patientId,
          input.encounterId
        );
        if (!encounterCheck.ok) {
          await recordAuditEvent({
            actionCode: "ai.interconsultation.create.denied",
            encounterId: input.encounterId,
            entityType: "interconsultation",
            patientId: input.patientId,
            resultCode: "denied",
          });
          return { success: false, error: encounterCheck.error };
        }

        const practitionerCheck = await assertActivePractitioner(
          input.requestedBy
        );
        if (!practitionerCheck.ok) {
          return { success: false, error: practitionerCheck.error };
        }

        const [created] = await db
          .insert(interconsultation)
          .values({
            encounterId: input.encounterId,
            id: crypto.randomUUID(),
            reasonText: input.reasonText,
            requestedAt: new Date(),
            requestedBy: input.requestedBy,
            requestedSpecialty: input.requestedSpecialty,
            status: "requested",
          })
          .returning();

        if (!created) {
          return {
            success: false,
            error: "Error al crear la interconsulta.",
          };
        }

        await recordAuditEvent({
          actionCode: "ai.interconsultation.create",
          encounterId: created.encounterId,
          entityId: created.id,
          entityType: "interconsultation",
          patientId: input.patientId,
          resultCode: "success",
        });

        return { interconsultation: created, success: true };
      },
    }),

    create_incapacity_certificate: tool({
      description:
        "Crear certificado de incapacidad. Solo usar con solicitud explícita, fechas concretas y concepto clínico.",
      inputSchema: z.object({
        conceptText: z.string(),
        destinationEntity: z.string().nullable(),
        encounterId: z.string(),
        endDate: z.string().describe("Fecha final en formato ISO o YYYY-MM-DD"),
        issuedBy: z.string(),
        patientId: z.string(),
        startDate: z
          .string()
          .describe("Fecha inicial en formato ISO o YYYY-MM-DD"),
      }),
      execute: async (input) => {
        const encounterCheck = await assertPatientEncounter(
          input.patientId,
          input.encounterId
        );
        if (!encounterCheck.ok) {
          await recordAuditEvent({
            actionCode: "ai.incapacity_certificate.create.denied",
            encounterId: input.encounterId,
            entityType: "incapacity_certificate",
            patientId: input.patientId,
            resultCode: "denied",
          });
          return { success: false, error: encounterCheck.error };
        }

        const startDate = parseToolDate(input.startDate);
        const endDate = parseToolDate(input.endDate);

        if (endDate < startDate) {
          return {
            success: false,
            error: "La fecha final no puede ser anterior a la fecha inicial.",
          };
        }

        const practitionerCheck = await assertActivePractitioner(
          input.issuedBy
        );
        if (!practitionerCheck.ok) {
          return { success: false, error: practitionerCheck.error };
        }

        const now = new Date();
        const [created] = await db
          .insert(incapacityCertificate)
          .values({
            conceptText: input.conceptText,
            destinationEntity: input.destinationEntity,
            encounterId: input.encounterId,
            endDate,
            id: crypto.randomUUID(),
            issuedAt: now,
            issuedBy: input.issuedBy,
            patientId: input.patientId,
            signedAt: now,
            startDate,
          })
          .returning();

        if (!created) {
          return {
            success: false,
            error: "Error al crear el certificado de incapacidad.",
          };
        }

        await recordAuditEvent({
          actionCode: "ai.incapacity_certificate.create",
          encounterId: created.encounterId,
          entityId: created.id,
          entityType: "incapacity_certificate",
          patientId: created.patientId,
          resultCode: "success",
        });

        return { incapacityCertificate: created, success: true };
      },
    }),

    list_consents: tool({
      description:
        "Consultar consentimientos informados y autorizaciones de divulgación del paciente.",
      inputSchema: z.object({
        patientId: z.string(),
      }),
      execute: async ({ patientId }) => {
        const selectedPatientCheck = assertSelectedPatient(patientId);
        if (!selectedPatientCheck.ok) {
          return { error: selectedPatientCheck.error };
        }

        const [consents, disclosures] = await Promise.all([
          db
            .select()
            .from(consentRecord)
            .where(eq(consentRecord.patientId, patientId))
            .orderBy(desc(consentRecord.signedAt)),
          db
            .select()
            .from(dataDisclosureAuthorization)
            .where(eq(dataDisclosureAuthorization.patientId, patientId))
            .orderBy(desc(dataDisclosureAuthorization.grantedAt)),
        ]);

        return {
          consents: consents.map((item) => ({
            consentType: item.consentType,
            decision: item.decision,
            expiresAt: formatDate(item.expiresAt),
            id: item.id,
            procedureCode: item.procedureCode,
            revokedAt: formatDate(item.revokedAt),
            signedAt: formatDate(item.signedAt),
          })),
          dataDisclosures: disclosures.map((item) => ({
            expiresAt: formatDate(item.expiresAt),
            grantedAt: formatDate(item.grantedAt),
            id: item.id,
            legalBasis: item.legalBasis,
            purposeCode: item.purposeCode,
            revokedAt: formatDate(item.revokedAt),
            scopeJson: item.scopeJson,
            thirdPartyName: item.thirdPartyName,
          })),
        };
      },
    }),

    list_attachments: tool({
      description:
        "Listar anexos documentales enlazados a paciente, atención, documento u otra entidad clínica. No descarga binarios.",
      inputSchema: z.object({
        linkedEntityId: z.string(),
        linkedEntityType: z.string(),
        limit: z.number().int().min(1).max(25).default(10),
      }),
      execute: async ({ limit, linkedEntityId, linkedEntityType }) => {
        const scopeCheck = await assertAttachmentScope(
          linkedEntityType,
          linkedEntityId
        );
        if (!scopeCheck.ok) {
          return { error: scopeCheck.error };
        }

        const links = await db
          .select({
            binaryId: attachmentLink.binaryId,
            capturedAt: attachmentLink.capturedAt,
            classification: attachmentLink.classification,
            hashSha256: binaryObject.hashSha256,
            id: attachmentLink.id,
            linkedEntityId: attachmentLink.linkedEntityId,
            linkedEntityType: attachmentLink.linkedEntityType,
            mimeType: binaryObject.mimeType,
            sizeBytes: binaryObject.sizeBytes,
            title: attachmentLink.title,
          })
          .from(attachmentLink)
          .innerJoin(binaryObject, eq(attachmentLink.binaryId, binaryObject.id))
          .where(
            and(
              eq(attachmentLink.linkedEntityType, linkedEntityType),
              eq(attachmentLink.linkedEntityId, linkedEntityId)
            )
          )
          .orderBy(desc(attachmentLink.capturedAt))
          .limit(limit);

        return links.map((item) => ({
          ...item,
          capturedAt: formatDate(item.capturedAt),
        }));
      },
    }),

    list_practitioners: tool({
      description: "Listar profesionales de salud disponibles en el sistema.",
      inputSchema: z.object({
        limit: z.number().default(20).describe("Número máximo de resultados"),
      }),
      execute: async ({ limit }) => {
        const practitioners = await db.select().from(practitioner).limit(limit);

        return practitioners.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          documentType: p.documentType,
          documentNumber: p.documentNumber,
          rethusNumber: p.rethusNumber,
          active: p.active,
        }));
      },
    }),
  };

  return withToolObservability(tools);
}

export type MedicalTools = ReturnType<typeof createMedicalTools>;

export interface MedicalAgentConfig {
  agent: ToolLoopAgent<never, MedicalTools>;
  systemPrompt: string;
  tools: MedicalTools;
}

export function createMedicalAgent(
  db: Db,
  options: MedicalAgentOptions = {}
): MedicalAgentConfig {
  const tools = createMedicalTools(db, options);
  const systemPrompt = options.instructions ?? SYSTEM_PROMPT;
  const agent = new ToolLoopAgent({
    id: "wellfit-medical-agent",
    instructions: systemPrompt,
    model: fireworks("accounts/fireworks/routers/kimi-k2p5-turbo"),
    stopWhen: stepCountIs(10),
    tools,
    onFinish: ({ finishReason, steps, totalUsage }) => {
      console.info("[ai-chat] agent finished", {
        finishReason,
        steps: steps.length,
        totalUsage,
      });
    },
    onStepFinish: ({ finishReason, stepNumber, toolCalls, toolResults }) => {
      console.info("[ai-chat] agent step finished", {
        finishReason,
        stepNumber,
        toolCalls: toolCalls.map((call) => call.toolName),
        toolResults: toolResults.length,
      });
    },
  });

  return { agent, tools, systemPrompt };
}
