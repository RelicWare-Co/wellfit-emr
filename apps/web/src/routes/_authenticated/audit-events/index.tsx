import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Input } from "@wellfit-emr/ui/components/input";
import { Eye, Search } from "lucide-react";
import { useState } from "react";

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/audit-events/")({
  component: AuditEventsListPage,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw new Error("UNAUTHORIZED");
    }
    return { session };
  },
  errorComponent: () => {
    window.location.href = "/login";
    return null;
  },
});

function AuditEventsListPage() {
  const [patientId, setPatientId] = useState("");
  const [userId, setUserId] = useState("");
  const [actionCode, setActionCode] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);

  const { data, isLoading } = useQuery(
    orpc.auditEvents.list.queryOptions({
      input: {
        limit,
        offset,
        patientId: patientId || undefined,
        userId: userId || undefined,
        actionCode: actionCode || undefined,
        sortDirection: "desc",
      },
    })
  );

  const columns = [
    {
      header: "Acción",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span className="inline-flex items-center gap-1.5">
          <Eye size={14} />
          {row.actionCode}
        </span>
      ),
    },
    {
      header: "Entidad",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        `${row.entityType}${row.entityId ? ` / ${row.entityId}` : ""}`,
    },
    {
      header: "Usuario",
      accessor: (row: NonNullable<typeof data>["items"][0]) => row.userId,
    },
    {
      header: "Resultado",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span
          className={`inline-flex border px-1.5 py-0.5 font-medium text-[10px] ${
            row.resultCode === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {row.resultCode}
        </span>
      ),
    },
    {
      header: "Canal",
      accessor: (row: NonNullable<typeof data>["items"][0]) => row.channel,
    },
    {
      header: "Fecha",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        new Date(row.occurredAt).toLocaleString("es-CO"),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        description="Bitácora de auditoría de acceso y modificaciones"
        title="Auditoría"
      />

      <div className="px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Search className="text-muted-foreground" size={14} />
          <Input
            className="h-7 max-w-[140px] text-xs"
            onChange={(e) => {
              setPatientId(e.target.value);
              setOffset(0);
            }}
            placeholder="Paciente ID..."
            value={patientId}
          />
          <Input
            className="h-7 max-w-[140px] text-xs"
            onChange={(e) => {
              setUserId(e.target.value);
              setOffset(0);
            }}
            placeholder="Usuario ID..."
            value={userId}
          />
          <Input
            className="h-7 max-w-[140px] text-xs"
            onChange={(e) => {
              setActionCode(e.target.value);
              setOffset(0);
            }}
            placeholder="Acción..."
            value={actionCode}
          />
        </div>

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          emptyDescription="No se encontraron eventos de auditoría."
          emptyTitle="Sin eventos"
          isLoading={isLoading}
          keyExtractor={(row) => String(row.id)}
          pagination={
            data
              ? {
                  limit,
                  offset,
                  total: data.total,
                  onPageChange: setOffset,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
