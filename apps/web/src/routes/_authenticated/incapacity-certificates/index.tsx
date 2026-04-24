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

  const [patientSearch, setPatientSearch] = useState("");
  const [encounterSearch, setEncounterSearch] = useState("");
  const [practitionerSearch, setPractitionerSearch] = useState("");

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
            <Label>Emitido por</Label>
            <SearchSelect
              emptyMessage="Escribe para buscar profesionales"
              loading={practitionersLoading}
              onChange={(v) => setForm((f) => ({ ...f, issuedBy: v }))}
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
  const [patientSearch, setPatientSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);
  const [showForm, setShowForm] = useState(false);

  const { data: patientsData, isLoading: patientsLoading } = useQuery(
    orpc.patients.list.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: patientSearch || undefined,
      },
    })
  );

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
          <SearchSelect
            className="max-w-xs"
            clearable
            emptyMessage="Escribe para buscar pacientes"
            loading={patientsLoading}
            onChange={(v) => {
              setPatientId(v);
              setOffset(0);
            }}
            onSearchChange={setPatientSearch}
            options={
              patientsData?.patients.map((p) => ({
                value: p.id,
                label: `${p.firstName} ${p.lastName1}`,
                description: `${p.primaryDocumentType} ${p.primaryDocumentNumber}`,
              })) ?? []
            }
            placeholder="Filtrar por paciente..."
            search={patientSearch}
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
