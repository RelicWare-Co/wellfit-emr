import { createMedicalAgent, SYSTEM_PROMPT } from "@wellfit-emr/api/ai/agent";
import { auth } from "@wellfit-emr/auth";
import { db } from "@wellfit-emr/db";
import {
  allergyIntolerance,
  encounter,
  medicationOrder,
  patient,
} from "@wellfit-emr/db/schema/clinical";
import { createAgentUIStreamResponse, type UIMessage } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

const chatRequestSchema = z.object({
  messages: z.array(z.custom<UIMessage>()),
  selectedPatientId: z.string().min(1).nullable().optional(),
});

export async function chatHandler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const requestBody = await request.json().catch((error) => {
    console.error("[ai-chat] invalid request json", error);
    return null;
  });
  const parsedBody = chatRequestSchema.safeParse(requestBody);
  if (!parsedBody.success) {
    console.error("[ai-chat] invalid chat request", parsedBody.error);
    return new Response("Invalid chat request", { status: 400 });
  }

  const { messages, selectedPatientId } = parsedBody.data;

  console.info("[ai-chat] request received", {
    messageCount: messages.length,
    selectedPatientId,
    userId: session.user.id,
  });

  const patientContext = selectedPatientId
    ? await buildPatientContext(selectedPatientId)
    : null;
  const systemMessage = patientContext
    ? `${SYSTEM_PROMPT}\n\nCONTEXTO DEL PACIENTE SELECCIONADO:\n${patientContext}`
    : SYSTEM_PROMPT;
  const { agent } = createMedicalAgent(db, {
    instructions: systemMessage,
    selectedPatientId: selectedPatientId ?? null,
    userId: session.user.id,
  });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    onError: (error) => {
      console.error("[ai-chat] stream error", error);
      return formatStreamError(error);
    },
    onFinish: ({ isAborted }) => {
      console.info("[ai-chat] ui stream finished", { isAborted });
    },
    headers: {
      "Cache-Control": "no-cache",
      "Content-Encoding": "none",
      "X-Accel-Buffering": "no",
    },
  });
}

function formatStreamError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Error generando la respuesta del asistente.";
}

async function buildPatientContext(patientId: string) {
  const [found] = await db
    .select()
    .from(patient)
    .where(eq(patient.id, patientId))
    .limit(1);

  if (!found) {
    return "No se encontró el paciente seleccionado.";
  }

  const [allergies, medications, encounters] = await Promise.all([
    db
      .select()
      .from(allergyIntolerance)
      .where(
        and(
          eq(allergyIntolerance.patientId, patientId),
          eq(allergyIntolerance.status, "active")
        )
      )
      .orderBy(desc(allergyIntolerance.recordedAt))
      .limit(20),
    db
      .select()
      .from(medicationOrder)
      .where(eq(medicationOrder.patientId, patientId))
      .orderBy(desc(medicationOrder.signedAt))
      .limit(20),
    db
      .select()
      .from(encounter)
      .where(eq(encounter.patientId, patientId))
      .orderBy(desc(encounter.startedAt))
      .limit(10),
  ]);

  const fullName = `${found.firstName}${found.middleName ? ` ${found.middleName}` : ""} ${found.lastName1}${found.lastName2 ? ` ${found.lastName2}` : ""}`;
  const birthDate = new Date(found.birthDate).toLocaleDateString("es-CO");
  const allergyText =
    allergies.length > 0
      ? allergies
          .map(
            (a) =>
              `- ${a.substanceCode}; criticidad: ${a.criticality ?? "no especificada"}; reacción: ${a.reactionText ?? "sin detalle"}`
          )
          .join("\n")
      : "- Sin alergias activas registradas.";
  const medicationText =
    medications.length > 0
      ? medications
          .map(
            (m) =>
              `- ${m.genericName} ${m.concentration}, ${m.dose} ${m.frequencyText}, duración ${m.durationText}, estado ${m.status}, id ${m.id}`
          )
          .join("\n")
      : "- Sin medicamentos registrados.";
  const encounterText =
    encounters.length > 0
      ? encounters
          .map(
            (e) =>
              `- ${new Date(e.startedAt).toLocaleDateString("es-CO")} [${e.status}] ${e.reasonForVisit}; clase ${e.encounterClass}; id ${e.id}`
          )
          .join("\n")
      : "- Sin atenciones registradas.";

  return `Paciente:
- ID: ${found.id}
- Nombre: ${fullName}
- Documento: ${found.primaryDocumentType} ${found.primaryDocumentNumber}
- Fecha de nacimiento: ${birthDate}
- Sexo al nacer: ${found.sexAtBirth}
- Identidad de género: ${found.genderIdentity ?? "no registrada"}

Alergias activas:
${allergyText}

Medicamentos:
${medicationText}

Atenciones recientes:
${encounterText}`;
}
