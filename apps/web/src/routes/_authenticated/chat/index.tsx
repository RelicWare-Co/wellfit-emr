import { useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "@wellfit-emr/env/web";
import { Button } from "@wellfit-emr/ui/components/button";
import { Input } from "@wellfit-emr/ui/components/input";
import { DefaultChatTransport, isToolUIPart } from "ai";
import {
  Activity,
  Bot,
  FileText,
  Loader2,
  MessageSquarePlus,
  Pill,
  Send,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { orpc } from "@/utils/orpc";
import { MessageParts } from "./-components/message-parts";
import { PatientSidebar } from "./-components/patient-sidebar";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatPage,
});

function ChatPage() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null
  );
  const [patientSearch, setPatientSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const selectedPatientIdRef = useRef<string | null>(selectedPatientId);
  selectedPatientIdRef.current = selectedPatientId;

  const { data: patientsData, isLoading: patientsLoading } = useQuery(
    orpc.patients.list.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: patientSearch || undefined,
        sortBy: "firstName",
        sortDirection: "asc",
      },
    })
  );

  const { data: selectedPatient } = useQuery({
    ...orpc.patients.get.queryOptions({
      input: { id: selectedPatientId ?? "" },
    }),
    enabled: !!selectedPatientId,
  });

  const { data: patientEncounters } = useQuery({
    ...orpc.encounters.list.queryOptions({
      input: { limit: 5, offset: 0, patientId: selectedPatientId ?? "" },
    }),
    enabled: !!selectedPatientId,
  });

  const { data: patientAllergies } = useQuery({
    ...orpc.clinicalRecords.listAllergies.queryOptions({
      input: { patientId: selectedPatientId ?? "" },
    }),
    enabled: !!selectedPatientId,
  });

  const { data: patientMedications } = useQuery({
    ...orpc.medicationOrders.list.queryOptions({
      input: { limit: 10, offset: 0, patientId: selectedPatientId ?? "" },
    }),
    enabled: !!selectedPatientId,
  });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${env.VITE_SERVER_URL}/api/chat`,
        credentials: "include",
        prepareSendMessagesRequest: ({
          api,
          body,
          credentials,
          headers,
          id,
          messageId,
          messages: requestMessages,
          trigger,
        }) => ({
          api,
          credentials,
          headers,
          body: {
            ...body,
            id,
            messageId,
            messages: requestMessages,
            selectedPatientId: selectedPatientIdRef.current,
            trigger,
          },
        }),
      }),
    []
  );

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    stop,
    clearError,
  } = useChat({
    transport,
    onError: (chatError) => {
      console.error("[ai-chat] client stream error", chatError);
    },
  });
  const isLoading = status === "submitted" || status === "streaming";
  const showLoadingIndicator = shouldShowLoadingIndicator(messages, status);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  useEffect(() => {
    const hasToolResult = messages.some((m) =>
      m.parts?.some((p) => isToolUIPart(p) && p.state === "output-available")
    );
    if (hasToolResult) {
      queryClient.invalidateQueries({
        queryKey: orpc.medicationOrders.list.key({ type: "query" }),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.patients.list.key({ type: "query" }),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.encounters.list.key({ type: "query" }),
      });
    }
  }, [messages, queryClient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) {
      return;
    }
    sendMessage({ text: input });
    setInput("");
  };

  const handleNewChat = () => {
    if (isLoading) {
      stop();
    }

    clearError();
    setMessages([]);
    setInput("");
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {sidebarOpen && (
        <PatientSidebar
          onPatientIdChange={setSelectedPatientId}
          onPatientSearchChange={setPatientSearch}
          patientAllergies={patientAllergies}
          patientEncounters={patientEncounters}
          patientMedications={patientMedications}
          patientSearch={patientSearch}
          patientsData={patientsData}
          patientsLoading={patientsLoading}
          selectedPatient={selectedPatient}
          selectedPatientId={selectedPatientId}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          hasMessages={messages.length > 0}
          isLoading={isLoading}
          onNewChat={handleNewChat}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          patientName={
            selectedPatient ? formatPatientName(selectedPatient) : null
          }
          sidebarOpen={sidebarOpen}
        />

        <div className="flex-1 overflow-auto p-4">
          {messages.length === 0 && !isLoading && (
            <EmptyState
              hasPatient={!!selectedPatientId}
              onOpenSidebar={() => setSidebarOpen(true)}
              onSendMessage={sendMessage}
            />
          )}

          <div className="space-y-4">
            {messages.map((message) => (
              <div
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                key={message.id}
              >
                {message.role === "assistant" && (
                  <div className="flex size-7 shrink-0 items-center justify-center bg-primary text-primary-foreground">
                    <Bot size={14} />
                  </div>
                )}
                <div
                  className={`max-w-[80%] ${
                    message.role === "user"
                      ? "bg-primary px-4 py-3 text-primary-foreground"
                      : "bg-muted px-4 py-3"
                  }`}
                >
                  <MessageParts isLoading={isLoading} message={message} />
                </div>

                {message.role === "user" && (
                  <div className="flex size-7 shrink-0 items-center justify-center bg-muted">
                    <User size={14} />
                  </div>
                )}
              </div>
            ))}

            {showLoadingIndicator && <LoadingIndicator />}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {error && (
          <div className="border-destructive/50 border-t bg-destructive/5 px-4 py-2 text-destructive text-xs">
            Error: {error.message}
          </div>
        )}

        <form
          className="flex items-center gap-2 border-t px-4 py-3"
          onSubmit={handleSubmit}
        >
          <Input
            className="flex-1 text-sm"
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              selectedPatientId
                ? "Escribe tu consulta médica..."
                : "Escribe un mensaje (selecciona un paciente para contexto clínico)..."
            }
            value={input}
          />
          {isLoading ? (
            <Button
              onClick={() => stop()}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <X size={14} />
            </Button>
          ) : (
            <Button disabled={!input.trim()} size="icon-sm" type="submit">
              <Send size={14} />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

function shouldShowLoadingIndicator(
  messages: Array<{ role: string; parts?: Array<{ type: string }> }>,
  status: string
) {
  if (status === "submitted") {
    return true;
  }

  if (status !== "streaming") {
    return false;
  }

  const lastMessage = messages.at(-1);
  return (
    lastMessage?.role === "assistant" &&
    !lastMessage.parts?.some(
      (part) => part.type === "text" || part.type.startsWith("tool-")
    )
  );
}

function formatPatientName(p: {
  firstName: string;
  middleName: string | null;
  lastName1: string;
  lastName2: string | null;
}) {
  return `${p.firstName}${p.middleName ? ` ${p.middleName}` : ""} ${p.lastName1}${p.lastName2 ? ` ${p.lastName2}` : ""}`;
}

function ChatHeader({
  patientName,
  sidebarOpen,
  hasMessages,
  isLoading,
  onNewChat,
  onToggleSidebar,
}: {
  patientName: string | null;
  sidebarOpen: boolean;
  hasMessages: boolean;
  isLoading: boolean;
  onNewChat: () => void;
  onToggleSidebar: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-3">
      <Button
        onClick={onToggleSidebar}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        {sidebarOpen ? <X size={14} /> : <Stethoscope size={14} />}
      </Button>
      <div className="flex items-center gap-2">
        <Bot size={16} />
        <h1 className="font-semibold text-sm">Asistente Médico</h1>
      </div>
      {patientName && (
        <span className="ml-2 rounded-none bg-primary/10 px-2 py-0.5 text-primary text-xs">
          {patientName}
        </span>
      )}
      <Button
        aria-label="Nuevo chat"
        className="ml-auto"
        disabled={!(hasMessages || isLoading)}
        onClick={onNewChat}
        size="icon-xs"
        title="Nuevo chat"
        type="button"
        variant="ghost"
      >
        <MessageSquarePlus size={14} />
      </Button>
    </div>
  );
}

function EmptyState({
  hasPatient,
  onOpenSidebar,
  onSendMessage,
}: {
  hasPatient: boolean;
  onOpenSidebar: () => void;
  onSendMessage: (opts: { text: string }) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="flex size-16 items-center justify-center bg-muted">
        <Bot className="text-muted-foreground" size={32} />
      </div>
      <div className="text-center">
        <h2 className="font-semibold text-lg">Asistente Médico WellFit</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Selecciona un paciente y haz preguntas sobre su historia clínica,
          prescribe medicamentos, o consulta catálogos RIPS.
        </p>
      </div>
      <div className="grid max-w-md grid-cols-2 gap-2">
        {hasPatient ? (
          <>
            <QuickAction
              icon={<Activity size={14} />}
              label="Resumen clínico"
              onClick={() =>
                onSendMessage({
                  text: "Genera un resumen clínico completo de este paciente, incluyendo antecedentes, alergias, medicamentos activos y atenciones recientes.",
                })
              }
            />
            <QuickAction
              icon={<Pill size={14} />}
              label="Revisar medicamentos"
              onClick={() =>
                onSendMessage({
                  text: "Revisa los medicamentos actuales del paciente, identifica posibles interacciones o duplicidades.",
                })
              }
            />
            <QuickAction
              icon={<FileText size={14} />}
              label="Alergias"
              onClick={() =>
                onSendMessage({
                  text: "Lista todas las alergias registradas del paciente y clasifica su criticidad.",
                })
              }
            />
            <QuickAction
              icon={<Stethoscope size={14} />}
              label="Atenciones recientes"
              onClick={() =>
                onSendMessage({
                  text: "Muestra las atenciones clínicas recientes del paciente con diagnóstico y evolución.",
                })
              }
            />
          </>
        ) : (
          <QuickAction
            className="col-span-2"
            icon={<User size={14} />}
            label="Buscar paciente"
            onClick={onOpenSidebar}
          />
        )}
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center bg-primary text-primary-foreground">
        <Bot size={14} />
      </div>
      <div className="bg-muted px-4 py-3">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="animate-spin" size={14} />
          <span>Pensando...</span>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={`flex items-center gap-2 rounded-none border px-3 py-2 text-xs transition-colors hover:bg-muted/60 ${className ?? ""}`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}
