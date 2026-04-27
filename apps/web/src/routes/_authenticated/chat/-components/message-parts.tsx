import { code } from "@streamdown/code";
import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";
import { FileText, Loader2, Pill, Printer, User } from "lucide-react";
import { Streamdown } from "streamdown";

interface MessagePartsProps {
  isLoading: boolean;
  message: UIMessage;
}

export function MessageParts({ message, isLoading }: MessagePartsProps) {
  return (
    <>
      {message.parts.map((part, i) => {
        const key = `${message.id}-${i}`;

        if (part.type === "text") {
          return (
            <TextPart
              index={i}
              isLoading={isLoading}
              key={key}
              message={message}
              part={part}
            />
          );
        }

        if (isToolUIPart(part)) {
          const toolName =
            "toolName" in part
              ? (part.toolName as string)
              : part.type.replace("tool-", "");
          return <ToolPart key={key} part={part} toolName={toolName} />;
        }

        return null;
      })}
    </>
  );
}

function TextPart({
  part,
  message,
  isLoading,
  index,
}: {
  part: { type: "text"; text: string };
  message: UIMessage;
  isLoading: boolean;
  index: number;
}) {
  if (message.role === "user") {
    return <p className="text-sm">{part.text}</p>;
  }

  return (
    <Streamdown
      caret="block"
      isAnimating={
        isLoading &&
        index === message.parts.length - 1 &&
        message.role === "assistant"
      }
      plugins={{ code }}
    >
      {part.text}
    </Streamdown>
  );
}

function ToolPart({
  part,
  toolName,
}: {
  part: { state: string; output?: unknown; errorText?: string };
  toolName: string;
}) {
  const output = part.state === "output-available" ? part.output : undefined;
  const errorText = part.state === "output-error" ? part.errorText : undefined;

  if (errorText) {
    return (
      <ToolCallCard
        icon={<FileText size={14} />}
        state={part.state}
        title={toolName.replace(/_/g, " ")}
      >
        <ToolError errorText={errorText} />
      </ToolCallCard>
    );
  }

  switch (toolName) {
    case "search_patients":
      return (
        <ToolCallCard
          icon={<User size={14} />}
          state={part.state}
          title="Búsqueda de pacientes"
        >
          {output === undefined ? null : <SearchPatientsOutput data={output} />}
        </ToolCallCard>
      );
    case "get_patient":
      return (
        <ToolCallCard
          icon={<User size={14} />}
          state={part.state}
          title="Datos del paciente"
        >
          {output === undefined ? null : <GetPatientOutput data={output} />}
        </ToolCallCard>
      );
    case "create_medication_order":
      return (
        <ToolCallCard
          icon={<Pill size={14} />}
          state={part.state}
          title="Prescripción creada"
          variant="success"
        >
          {output === undefined ? null : (
            <CreateMedicationOutput data={output} />
          )}
        </ToolCallCard>
      );
    default:
      return (
        <ToolCallCard
          icon={<FileText size={14} />}
          state={part.state}
          title={toolName.replace(/_/g, " ")}
        >
          {output === undefined ? null : (
            <pre className="max-h-40 overflow-auto text-[10px]">
              {JSON.stringify(output, null, 2)}
            </pre>
          )}
        </ToolCallCard>
      );
  }
}

function ToolError({ errorText }: { errorText: string }) {
  return <p className="text-destructive text-xs">{errorText}</p>;
}

function SearchPatientsOutput({ data }: { data: unknown }) {
  const patients = data as Array<{
    id: string;
    fullName: string;
    document: string;
  }>;
  return (
    <div className="space-y-1">
      {patients.map((p) => (
        <div
          className="flex items-center justify-between border-b py-1 text-xs last:border-0"
          key={p.id}
        >
          <span className="font-medium">{p.fullName}</span>
          <span className="text-muted-foreground">{p.document}</span>
        </div>
      ))}
    </div>
  );
}

function GetPatientOutput({ data }: { data: unknown }) {
  const result = data as Record<string, unknown>;
  if ("error" in result) {
    return <p className="text-destructive text-xs">{String(result.error)}</p>;
  }
  return (
    <div className="space-y-1 text-xs">
      {Object.entries(result)
        .filter(([k]) => k !== "id")
        .map(([k, v]) => (
          <p key={k}>
            <span className="text-muted-foreground">{k}:</span>{" "}
            {String(v ?? "")}
          </p>
        ))}
    </div>
  );
}

function CreateMedicationOutput({ data }: { data: unknown }) {
  const result = data as {
    error?: string;
    message?: string;
    prescription?: PrescriptionPrintData;
    success: boolean;
  };
  if (result.success) {
    const prescription = result.prescription;
    return (
      <div className="space-y-2">
        <p className="text-emerald-600 text-xs dark:text-emerald-400">
          {result.message}
        </p>
        {prescription ? (
          <button
            className="inline-flex items-center gap-1 border px-2 py-1 text-[11px] transition-colors hover:bg-muted"
            onClick={() => printPrescription(prescription)}
            type="button"
          >
            <Printer size={12} />
            Imprimir / guardar PDF
          </button>
        ) : null}
      </div>
    );
  }
  return <p className="text-destructive text-xs">{result.error}</p>;
}

interface PrescriptionPrintData {
  atcCode: string | null;
  concentration: string;
  dosageForm: string;
  dose: string;
  doseUnit: string | null;
  durationText: string;
  frequencyText: string;
  genericName: string;
  id: string;
  indications: string | null;
  patientId: string;
  prescriberId: string;
  quantityTotal: string;
  routeCode: string;
  signedAt: string;
  status: string;
}

function printPrescription(prescription: PrescriptionPrintData) {
  const printWindow = window.open("", "_blank", "width=760,height=900");
  if (!printWindow) {
    return;
  }

  const issuedAt = new Date(prescription.signedAt).toLocaleString("es-CO");
  printWindow.document.write(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Receta medica ${prescription.id}</title>
    <style>
      body { color: #111; font-family: Arial, sans-serif; margin: 40px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      h2 { border-bottom: 1px solid #ddd; font-size: 14px; margin-top: 28px; padding-bottom: 6px; text-transform: uppercase; }
      .muted { color: #555; font-size: 12px; }
      .row { display: grid; grid-template-columns: 180px 1fr; gap: 12px; margin: 8px 0; }
      .label { color: #555; font-weight: 700; }
      .signature { border-top: 1px solid #111; margin-top: 72px; padding-top: 8px; width: 320px; }
      @media print { button { display: none; } body { margin: 24px; } }
    </style>
  </head>
  <body>
    <h1>WellFit EMR - Receta medica</h1>
    <div class="muted">Generada desde asistente IA. Debe ser revisada y validada por el profesional tratante.</div>

    <h2>Orden</h2>
    <div class="row"><div class="label">ID</div><div>${escapeHtml(prescription.id)}</div></div>
    <div class="row"><div class="label">Fecha</div><div>${escapeHtml(issuedAt)}</div></div>
    <div class="row"><div class="label">Paciente ID</div><div>${escapeHtml(prescription.patientId)}</div></div>
    <div class="row"><div class="label">Prescriptor ID</div><div>${escapeHtml(prescription.prescriberId)}</div></div>

    <h2>Medicamento</h2>
    <div class="row"><div class="label">Nombre generico</div><div>${escapeHtml(prescription.genericName)}</div></div>
    <div class="row"><div class="label">Concentracion</div><div>${escapeHtml(prescription.concentration)}</div></div>
    <div class="row"><div class="label">Forma farmaceutica</div><div>${escapeHtml(prescription.dosageForm)}</div></div>
    <div class="row"><div class="label">Dosis</div><div>${escapeHtml(prescription.dose)} ${escapeHtml(prescription.doseUnit ?? "")}</div></div>
    <div class="row"><div class="label">Via</div><div>${escapeHtml(prescription.routeCode)}</div></div>
    <div class="row"><div class="label">Frecuencia</div><div>${escapeHtml(prescription.frequencyText)}</div></div>
    <div class="row"><div class="label">Duracion</div><div>${escapeHtml(prescription.durationText)}</div></div>
    <div class="row"><div class="label">Cantidad total</div><div>${escapeHtml(prescription.quantityTotal)}</div></div>
    <div class="row"><div class="label">Indicaciones</div><div>${escapeHtml(prescription.indications ?? "Sin indicaciones adicionales")}</div></div>

    <div class="signature">Firma y sello del profesional</div>
    <script>window.print();</script>
  </body>
</html>`);
  printWindow.document.close();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function ToolCallCard({
  icon,
  title,
  state,
  variant,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  state: string;
  variant?: "default" | "success";
  children?: React.ReactNode;
}) {
  const isRunning = state === "input-streaming" || state === "input-available";
  const hasError = state === "output-error" || state === "output-denied";

  let stateLabel: string;
  if (isRunning) {
    stateLabel = "Ejecutando...";
  } else if (state === "output-available") {
    stateLabel = "Completado";
  } else if (state === "output-error") {
    stateLabel = "Error";
  } else if (state === "output-denied") {
    stateLabel = "Denegado";
  } else {
    stateLabel = state;
  }

  let containerClass = "border-border bg-background";
  if (variant === "success") {
    containerClass =
      "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950";
  }
  if (hasError) {
    containerClass = "border-destructive/40 bg-destructive/5";
  }

  return (
    <div className={`my-2 rounded-none border ${containerClass}`}>
      <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
        {isRunning ? <Loader2 className="animate-spin" size={12} /> : icon}
        <span className="font-medium text-xs capitalize">{title}</span>
        <span className="text-[10px] text-muted-foreground">{stateLabel}</span>
      </div>
      {children && <div className="px-2 py-1.5">{children}</div>}
    </div>
  );
}
