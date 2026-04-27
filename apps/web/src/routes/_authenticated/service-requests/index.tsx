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

  const [patientSearch, setPatientSearch] = useState("");
  const [encounterSearch, setEncounterSearch] = useState("");
  const [practitionerSearch, setPractitionerSearch] = useState("");
  const [cupsSearch, setCupsSearch] = useState("");

  const { data: patientsData, isLoading: patientsLoading } = useQuery(
    orpc.patients.list.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: patientSearch || undefined,
      },
    })
  );

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

  const { data: cupsData, isLoading: cupsLoading } = useQuery(
    orpc.ripsReference.listEntries.queryOptions({
      input: {
        tableName: "CUPSRips",
        limit: 20,
        search: cupsSearch || undefined,
      },
    })
  );

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
            <Label>Paciente</Label>
            <SearchSelect
              emptyMessage="Escribe para buscar pacientes"
              loading={patientsLoading}
              onChange={(v) => setForm((f) => ({ ...f, patientId: v }))}
              onSearchChange={setPatientSearch}
              options={
                patientsData?.patients.map((p) => ({
                  value: p.id,
                  label: `${p.firstName} ${p.lastName1}`,
                  description: `${p.primaryDocumentType} ${p.primaryDocumentNumber}`,
                })) ?? []
              }
              placeholder="Buscar paciente..."
              required
              search={patientSearch}
              value={form.patientId}
            />
          </div>
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
            <Label>Código CUPS</Label>
            <SearchSelect
              emptyMessage="Escribe para buscar en CUPS"
              loading={cupsLoading}
              onChange={(v) => setForm((f) => ({ ...f, requestCode: v }))}
              onSearchChange={setCupsSearch}
              options={
                cupsData?.entries.map((e) => ({
                  value: e.code,
                  label: e.name,
                  description: e.code,
                })) ?? []
              }
              placeholder="Buscar CUPS..."
              required
              search={cupsSearch}
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
