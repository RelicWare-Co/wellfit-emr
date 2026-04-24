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
import { Plus, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/consents/")({
  component: ConsentsListPage,
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

function CreateConsentForm({ onCancel }: { onCancel: () => void }) {
  const [form, setForm] = useState({
    patientId: "",
    encounterId: "",
    consentType: "procedimiento",
    procedureCode: "",
    decision: "accepted",
    grantedByPersonName: "",
    representativeRelationship: "",
    signedAt: new Date().toISOString().slice(0, 16),
  });

  const [patientSearch, setPatientSearch] = useState("");
  const [encounterSearch, setEncounterSearch] = useState("");
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
    ...orpc.consents.createConsent.mutationOptions(),
    onSuccess: () => {
      toast.success("Consentimiento registrado");
      queryClient.invalidateQueries({
        queryKey: orpc.consents.listConsents.key({ type: "query" }),
      });
      onCancel();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al registrar consentimiento");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      patientId: form.patientId,
      encounterId: form.encounterId || null,
      consentType: form.consentType,
      procedureCode: form.procedureCode || null,
      decision: form.decision,
      grantedByPersonName: form.grantedByPersonName,
      representativeRelationship: form.representativeRelationship || null,
      signedAt: new Date(form.signedAt),
    });
  }

  return (
    <Card className="mx-6">
      <CardHeader>
        <CardTitle>Nuevo consentimiento informado</CardTitle>
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
            <Label>Atención (opcional)</Label>
            <SearchSelect
              clearable
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
              search={encounterSearch}
              value={form.encounterId}
            />
          </div>
          <div className="space-y-1">
            <Label>Tipo de consentimiento</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, consentType: e.target.value })
              }
              required
              value={form.consentType}
            />
          </div>
          <div className="space-y-1">
            <Label>Código CUPS (opcional)</Label>
            <SearchSelect
              value={form.procedureCode}
              onChange={(v) => setForm((f) => ({ ...f, procedureCode: v }))}
              search={cupsSearch}
              onSearchChange={setCupsSearch}
              options={
                cupsData?.entries.map((e) => ({
                  value: e.code,
                  label: e.name,
                  description: e.code,
                })) ?? []
              }
              loading={cupsLoading}
              placeholder="Buscar CUPS..."
              emptyMessage="Escribe para buscar en CUPS"
              clearable
            />
          </div>
          <div className="space-y-1">
            <Label>Decisión</Label>
            <select
              className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              onChange={(e) => setForm({ ...form, decision: e.target.value })}
              value={form.decision}
            >
              <option value="accepted">Aceptado</option>
              <option value="rejected">Rechazado</option>
              <option value="withdrawn">Retirado</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Firmado por</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, grantedByPersonName: e.target.value })
              }
              required
              value={form.grantedByPersonName}
            />
          </div>
          <div className="space-y-1">
            <Label>Relación representante (opcional)</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, representativeRelationship: e.target.value })
              }
              value={form.representativeRelationship}
            />
          </div>
          <div className="space-y-1">
            <Label>Fecha de firma</Label>
            <Input
              onChange={(e) => setForm({ ...form, signedAt: e.target.value })}
              required
              type="datetime-local"
              value={form.signedAt}
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
              {create.isPending ? "Guardando..." : "Guardar consentimiento"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ConsentsListPage() {
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
    orpc.consents.listConsents.queryOptions({
      input: {
        limit,
        offset,
        patientId: patientId || "patient-id",
        sortDirection: "desc",
      },
      enabled: !!patientId,
    })
  );

  const revokeMutation = useMutation({
    ...orpc.consents.revokeConsent.mutationOptions(),
    onSuccess: () => {
      toast.success("Consentimiento revocado");
      queryClient.invalidateQueries({
        queryKey: orpc.consents.listConsents.key({ type: "query" }),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al revocar");
    },
  });

  const columns = [
    {
      header: "Tipo",
      accessor: (row: NonNullable<typeof data>["items"][0]) => row.consentType,
    },
    {
      header: "Decisión",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span
          className={`inline-flex border px-1.5 py-0.5 font-medium text-[10px] ${
            row.decision === "accepted"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : row.decision === "rejected"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {row.decision}
        </span>
      ),
    },
    {
      header: "Firmado por",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        row.grantedByPersonName,
    },
    {
      header: "Fecha firma",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        new Date(row.signedAt).toLocaleString("es-CO"),
    },
    {
      header: "Estado",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        row.revokedAt ? (
          <span className="text-[10px] text-destructive">Revocado</span>
        ) : (
          <span className="text-[10px] text-emerald-600">Vigente</span>
        ),
    },
    {
      header: "Acciones",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        row.revokedAt ? null : (
          <Button
            onClick={() =>
              revokeMutation.mutate({
                id: row.id,
                revokedAt: new Date(),
              })
            }
            size="icon-xs"
            variant="ghost"
          >
            <X size={14} />
          </Button>
        ),
      className: "w-16",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button onClick={() => setShowForm((s) => !s)} size="sm">
            <Plus size={14} />
            {showForm ? "Cancelar" : "Nuevo consentimiento"}
          </Button>
        }
        description="Consentimientos informados y autorizaciones"
        title="Consentimientos"
      />

      {showForm && <CreateConsentForm onCancel={() => setShowForm(false)} />}

      <div className="px-6">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="text-muted-foreground" size={14} />
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
          emptyDescription="No se encontraron consentimientos para este paciente."
          emptyTitle="Sin consentimientos"
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
