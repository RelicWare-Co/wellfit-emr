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
import { ClipboardList, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute(
  "/_authenticated/incapacity-certificates/"
)({
  component: IncapacityCertificatesListPage,
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

function CreateIncapacityForm({ onCancel }: { onCancel: () => void }) {
  const [form, setForm] = useState({
    patientId: "",
    encounterId: "",
    issuedBy: "",
    conceptText: "",
    destinationEntity: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    issuedAt: new Date().toISOString().slice(0, 16),
    signedAt: new Date().toISOString().slice(0, 16),
  });

  const create = useMutation({
    ...orpc.incapacityCertificates.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Incapacidad registrada");
      queryClient.invalidateQueries({
        queryKey: orpc.incapacityCertificates.list.key({ type: "query" }),
      });
      onCancel();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al registrar incapacidad");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      patientId: form.patientId,
      encounterId: form.encounterId,
      issuedBy: form.issuedBy,
      conceptText: form.conceptText,
      destinationEntity: form.destinationEntity || null,
      startDate: new Date(form.startDate),
      endDate: new Date(form.endDate),
      issuedAt: new Date(form.issuedAt),
      signedAt: new Date(form.signedAt),
    });
  }

  return (
    <Card className="mx-6">
      <CardHeader>
        <CardTitle>Nueva incapacidad / certificado</CardTitle>
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
            <Label>Emitido por (practitioner ID)</Label>
            <Input
              onChange={(e) => setForm({ ...form, issuedBy: e.target.value })}
              required
              value={form.issuedBy}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Concepto / diagnóstico</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, conceptText: e.target.value })
              }
              required
              value={form.conceptText}
            />
          </div>
          <div className="space-y-1">
            <Label>Entidad destino</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, destinationEntity: e.target.value })
              }
              placeholder="Ej: EPS"
              value={form.destinationEntity}
            />
          </div>
          <div className="space-y-1">
            <Label>Fecha inicio</Label>
            <Input
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
              type="date"
              value={form.startDate}
            />
          </div>
          <div className="space-y-1">
            <Label>Fecha fin</Label>
            <Input
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              required
              type="date"
              value={form.endDate}
            />
          </div>
          <div className="space-y-1">
            <Label>Fecha emisión</Label>
            <Input
              onChange={(e) => setForm({ ...form, issuedAt: e.target.value })}
              required
              type="datetime-local"
              value={form.issuedAt}
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
              {create.isPending ? "Guardando..." : "Guardar incapacidad"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function IncapacityCertificatesListPage() {
  const [patientId, setPatientId] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery(
    orpc.incapacityCertificates.list.queryOptions({
      input: {
        limit,
        offset,
        patientId: patientId || undefined,
        sortDirection: "desc",
      },
    })
  );

  const columns = [
    {
      header: "Concepto",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span className="inline-flex items-center gap-1.5">
          <ClipboardList size={14} />
          {row.conceptText}
        </span>
      ),
    },
    {
      header: "Destino",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        row.destinationEntity ?? "—",
    },
    {
      header: "Inicio",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        new Date(row.startDate).toLocaleDateString("es-CO"),
    },
    {
      header: "Fin",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        new Date(row.endDate).toLocaleDateString("es-CO"),
    },
    {
      header: "Firmado",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        new Date(row.signedAt).toLocaleString("es-CO"),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button onClick={() => setShowForm((s) => !s)} size="sm">
            <Plus size={14} />
            {showForm ? "Cancelar" : "Nueva incapacidad"}
          </Button>
        }
        description="Certificados de incapacidad médica"
        title="Incapacidades"
      />

      {showForm && <CreateIncapacityForm onCancel={() => setShowForm(false)} />}

      <div className="px-6">
        <div className="mb-3 flex items-center gap-2">
          <Search className="text-muted-foreground" size={14} />
          <Input
            className="h-7 max-w-xs text-xs"
            onChange={(e) => {
              setPatientId(e.target.value);
              setOffset(0);
            }}
            placeholder="Filtrar por paciente ID..."
            value={patientId}
          />
        </div>

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          emptyDescription="No se encontraron incapacidades registradas."
          emptyTitle="Sin incapacidades"
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
