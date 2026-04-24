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
import { SearchSelect } from "@wellfit-emr/ui/components/search-select";
import { Mail, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/interconsultations/")({
  component: InterconsultationsListPage,
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

function CreateInterconsultationForm({ onCancel }: { onCancel: () => void }) {
  const [form, setForm] = useState({
    encounterId: "",
    requestedSpecialty: "",
    requestedBy: "",
    reasonText: "",
    requestedAt: new Date().toISOString().slice(0, 16),
  });

  const [encounterSearch, setEncounterSearch] = useState("");
  const [practitionerSearch, setPractitionerSearch] = useState("");

  const { data: encountersData, isLoading: encountersLoading } = useQuery(
    orpc.encounters.list.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: encounterSearch || undefined,
      },
    })
  );

  const { data: practitionersData, isLoading: practitionersLoading } = useQuery(
    orpc.facilities.listPractitioners.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: practitionerSearch || undefined,
      },
    })
  );

  const create = useMutation({
    ...orpc.interconsultations.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Interconsulta creada");
      queryClient.invalidateQueries({
        queryKey: orpc.interconsultations.list.key({ type: "query" }),
      });
      onCancel();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al crear interconsulta");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      encounterId: form.encounterId,
      requestedSpecialty: form.requestedSpecialty,
      requestedBy: form.requestedBy,
      reasonText: form.reasonText,
      requestedAt: new Date(form.requestedAt),
      status: "requested",
    });
  }

  return (
    <Card className="mx-6">
      <CardHeader>
        <CardTitle>Nueva interconsulta</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
          onSubmit={handleSubmit}
        >
          <div className="space-y-1">
            <Label>Atención</Label>
            <SearchSelect
              emptyMessage="Escribe para buscar atenciones"
              loading={encountersLoading}
              onChange={(v) => setForm((f) => ({ ...f, encounterId: v }))}
              onSearchChange={setEncounterSearch}
              options={
                encountersData?.encounters.map((e) => ({
                  value: e.id,
                  label: e.reasonForVisit || "Sin motivo",
                  description: new Date(e.startedAt).toLocaleDateString(
                    "es-CO"
                  ),
                })) ?? []
              }
              placeholder="Buscar atención..."
              required
              search={encounterSearch}
              value={form.encounterId}
            />
          </div>
          <div className="space-y-1">
            <Label>Especialidad solicitada</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, requestedSpecialty: e.target.value })
              }
              placeholder="Ej: cardiología"
              required
              value={form.requestedSpecialty}
            />
          </div>
          <div className="space-y-1">
            <Label>Solicitado por</Label>
            <SearchSelect
              emptyMessage="Escribe para buscar profesionales"
              loading={practitionersLoading}
              onChange={(v) => setForm((f) => ({ ...f, requestedBy: v }))}
              onSearchChange={setPractitionerSearch}
              options={
                practitionersData?.practitioners.map((p) => ({
                  value: p.id,
                  label: p.fullName,
                  description: p.documentNumber,
                })) ?? []
              }
              placeholder="Buscar profesional..."
              required
              search={practitionerSearch}
              value={form.requestedBy}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Motivo</Label>
            <Input
              onChange={(e) => setForm({ ...form, reasonText: e.target.value })}
              required
              value={form.reasonText}
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
              {create.isPending ? "Guardando..." : "Guardar interconsulta"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function InterconsultationsListPage() {
  const [encounterId, setEncounterId] = useState("");
  const [encounterSearch, setEncounterSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);
  const [showForm, setShowForm] = useState(false);

  const { data: encountersData, isLoading: encountersLoading } = useQuery(
    orpc.encounters.list.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: encounterSearch || undefined,
      },
    })
  );

  const { data, isLoading } = useQuery(
    orpc.interconsultations.list.queryOptions({
      input: {
        limit,
        offset,
        encounterId: encounterId || undefined,
        sortDirection: "desc",
      },
    })
  );

  const respondMutation = useMutation({
    ...orpc.interconsultations.respond.mutationOptions(),
    onSuccess: () => {
      toast.success("Interconsulta respondida");
      queryClient.invalidateQueries({
        queryKey: orpc.interconsultations.list.key({ type: "query" }),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al responder");
    },
  });

  const columns = [
    {
      header: "Especialidad",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span className="inline-flex items-center gap-1.5">
          <Mail size={14} />
          {row.requestedSpecialty}
        </span>
      ),
    },
    {
      header: "Motivo",
      accessor: (row: NonNullable<typeof data>["items"][0]) => row.reasonText,
    },
    {
      header: "Estado",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span
          className={`inline-flex border px-1.5 py-0.5 font-medium text-[10px] ${
            row.status === "requested"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : row.status === "completed"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      header: "Fecha solicitud",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        new Date(row.requestedAt).toLocaleString("es-CO"),
    },
    {
      header: "Acciones",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        row.status === "requested" ? (
          <Button
            onClick={() =>
              respondMutation.mutate({
                id: row.id,
                status: "completed",
              })
            }
            size="sm"
            variant="outline"
          >
            Completar
          </Button>
        ) : null,
      className: "w-24",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button onClick={() => setShowForm((s) => !s)} size="sm">
            <Plus size={14} />
            {showForm ? "Cancelar" : "Nueva interconsulta"}
          </Button>
        }
        description="Solicitudes de interconsulta y remisión entre especialidades"
        title="Interconsultas"
      />

      {showForm && (
        <CreateInterconsultationForm onCancel={() => setShowForm(false)} />
      )}

      <div className="px-6">
        <div className="mb-3 flex items-center gap-2">
          <Search className="text-muted-foreground" size={14} />
          <SearchSelect
            className="max-w-xs"
            clearable
            emptyMessage="Escribe para buscar atenciones"
            loading={encountersLoading}
            onChange={(v) => {
              setEncounterId(v);
              setOffset(0);
            }}
            onSearchChange={setEncounterSearch}
            options={
              encountersData?.encounters.map((e) => ({
                value: e.id,
                label: e.reasonForVisit || "Sin motivo",
                description: new Date(e.startedAt).toLocaleDateString("es-CO"),
              })) ?? []
            }
            placeholder="Filtrar por atención..."
            search={encounterSearch}
            value={encounterId}
          />
        </div>

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          emptyDescription="No se encontraron interconsultas."
          emptyTitle="Sin interconsultas"
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
