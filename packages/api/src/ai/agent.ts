import { gateway } from "@ai-sdk/gateway";
import {
  allergyIntolerance,
  auditEvent,
  diagnosis,
  encounter,
  medicationOrder,
  observation,
  patient,
  practitioner,
  procedureRecord,
} from "@wellfit-emr/db/schema/clinical";
import { tool } from "ai";
import { and, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../context";

export const SYSTEM_PROMPT = `Eres un asistente médico de WellFit EMR, un sistema de Historia Clínica Electrónica conforme a la normativa colombiana (Ley 23 de 1981, Resolución 1995 de 1999, Ley 2015 de 2020, Resolución 866 de 2021, Resolución 1888 de 2025, Ley 1581 de 2012).

Tu rol es asistir a médicos y profesionales de salud en:
- Consultar información clínica de pacientes
- Revisar historias clínicas, diagnósticos, alergias y medicamentos
- Crear prescripciones médicas (órdenes de medicación)
- Generar resúmenes clínicos
- Consultar catálogos RIPS/SISPRO (CIE-10, CUPS, etc.)
- Responder preguntas sobre normatividad colombiana en salud

REGLAS IMPORTANTES:
1. Siempre verifica la identidad del paciente antes de dar información clínica
2. Nunca inventes datos clínicos que no existan en el sistema
3. Para prescripciones, primero revisa alergias, medicamentos activos, atención activa y profesional prescriptor; luego usa create_medication_order solo si el usuario pidió crear la prescripción de forma explícita.
4. Indica claramente cuando algo es una sugerencia vs un dato del sistema.
5. Usa terminología médica colombiana (CIE-10 para diagnósticos, CUPS para procedimientos).
6. Responde en español por defecto.
7. Si no tienes un paciente seleccionado, pide al usuario que seleccione uno primero.
8. No entregues diagnósticos definitivos ni sustituyas el criterio clínico del médico; prioriza resúmenes, verificación de datos, alertas de seguridad y borradores accionables.`;

interface MedicalToolOptions {
  selectedPatientId?: string | null;
  userId?: string | null;
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
      .catch(() => undefined);
  };

  return {
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
}

export type MedicalTools = ReturnType<typeof createMedicalTools>;

export interface MedicalAgentConfig {
  model: ReturnType<typeof gateway>;
  systemPrompt: string;
  tools: MedicalTools;
}

export function createMedicalAgent(db: Db): MedicalAgentConfig {
  const tools = createMedicalTools(db);
  const model = gateway("anthropic/claude-sonnet-4");

  return { model, tools, systemPrompt: SYSTEM_PROMPT };
}
