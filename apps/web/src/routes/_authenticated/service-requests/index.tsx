import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@wellfit-emr/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wellfit-emr/ui/components/card";
import { Input } from "@wellfit-emr/ui/components/input";
import { Label } from "@wellfit-emr/ui/components/label";
import { FlaskConical, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/service-requests/")({
  component: ServiceRequestsListPage,
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

function CreateServiceRequestForm({ onCancel }: { onCancel: () => void }) {
  const [form, setForm] = useState({
    patientId: "",
    encounterId: "",
    requestType: "laboratory",
    requestCode: "",
    priority: "routine",
    requestedBy: "",
    requestedAt: new Date().toISOString().slice(0, 16),
  });

  const create = useMutation({
    ...orpc.serviceRequests.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Orden de servicio creada");
      queryClient.invalidateQueries({
        queryKey: orpc.serviceRequests.list.key({ type: "query" }),
      });
      onCancel();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al crear orden");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      patientId: form.patientId,
      encounterId: form.encounterId,
      requestType: form.requestType,
      requestCode: form.requestCode,
      priority: form.priority,
      requestedBy: form.requestedBy,
      requestedAt: new Date(form.requestedAt),
      status: "active",
    });
  }

  return (
    <Card className="mx-6">
      <CardHeader>
        <CardTitle>Nueva orden de servicio</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
          onSubmit={handleSubmit}
        >
          <div className="space-y-1">
            <Label>Paciente ID</Label>
            <Input
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
              required
              value={form.patientId}
            />
          </div>
          <div className="space-y-1">
            <Label>Atención ID</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, encounterId: e.target.value })
              }
              required
              value={form.encounterId}
            />
          </div>
          <div className="space-y-1">
            <Label>Tipo de solicitud</Label>
            <select
              className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              onChange={(e) =>
                setForm({ ...form, requestType: e.target.value })
              }
              value={form.requestType}
            >
              <option value="laboratory">Laboratorio</option>
              <option value="imaging">Imagenología</option>
              <option value="procedure">Procedimiento</option>
              <option value="consultation">Consulta</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Código de solicitud</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, requestCode: e.target.value })
              }
              placeholder="Ej: 85025"
              required
              value={form.requestCode}
            />
          </div>
          <div className="space-y-1">
            <Label>Prioridad</Label>
            <select
              className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              value={form.priority}
            >
              <option value="routine">Rutina</option>
              <option value="urgent">Urgente</option>
              <option value="stat">STAT</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Solicitado por (practitioner ID)</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, requestedBy: e.target.value })
              }
              required
              value={form.requestedBy}
            />
          </div>
          <div className="space-y-1">
            <Label>Fecha solicitud</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, requestedAt: e.target.value })
              }
              required
              type="datetime-local"
              value={form.requestedAt}
            />
          </div>
          <div className="flex items-end gap-2 md:col-span-3">
            <Button
              onClick={onCancel}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button disabled={create.isPending} size="sm" type="submit">
              {create.isPending ? "Guardando..." : "Guardar orden"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ServiceRequestsListPage() {
  const [encounterId, setEncounterId] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery(
    orpc.serviceRequests.list.queryOptions({
      input: {
        limit,
        offset,
        encounterId: encounterId || undefined,
        sortDirection: "desc",
      },
    })
  );

  const columns = [
    {
      header: "Tipo",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span className="inline-flex items-center gap-1.5">
          <FlaskConical size={14} />
          {row.requestType}
        </span>
      ),
    },
    {
      header: "Código",
      accessor: (row: NonNullable<typeof data>["items"][0]) => row.requestCode,
    },
    {
      header: "Prioridad",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span
          className={`inline-flex border px-1.5 py-0.5 font-medium text-[10px] ${
            row.priority === "stat"
              ? "border-red-200 bg-red-50 text-red-700"
              : row.priority === "urgent"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {row.priority}
        </span>
      ),
    },
    {
      header: "Estado",
      accessor: (row: NonNullable<typeof data>["items"][0]) => row.status,
    },
    {
      header: "Fecha solicitud",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        new Date(row.requestedAt).toLocaleString("es-CO"),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button onClick={() => setShowForm((s) => !s)} size="sm">
            <Plus size={14} />
            {showForm ? "Cancelar" : "Nueva orden"}
          </Button>
        }
        description="Órdenes de laboratorio, imagenología y procedimientos"
        title="Órdenes de servicio"
      />

      {showForm && (
        <CreateServiceRequestForm onCancel={() => setShowForm(false)} />
      )}

      <div className="px-6">
        <div className="mb-3 flex items-center gap-2">
          <Search className="text-muted-foreground" size={14} />
          <Input
            className="h-7 max-w-xs text-xs"
            onChange={(e) => {
              setEncounterId(e.target.value);
              setOffset(0);
            }}
            placeholder="Filtrar por atención ID..."
            value={encounterId}
          />
        </div>

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          emptyDescription="No se encontraron órdenes de servicio."
          emptyTitle="Sin órdenes"
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
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
