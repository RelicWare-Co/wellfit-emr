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
import { Pill, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/medication-orders/")({
  component: MedicationOrdersListPage,
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

function CreateMedicationOrderForm({ onCancel }: { onCancel: () => void }) {
  const [form, setForm] = useState({
    patientId: "",
    encounterId: "",
    prescriberId: "",
    genericName: "",
    concentration: "",
    dosageForm: "",
    dose: "",
    doseUnit: "",
    routeCode: "",
    frequencyText: "",
    durationText: "",
    quantityTotal: "",
    indications: "",
    status: "active",
    signedAt: new Date().toISOString().slice(0, 16),
  });

  const create = useMutation({
    ...orpc.medicationOrders.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Prescripción creada");
      queryClient.invalidateQueries({
        queryKey: orpc.medicationOrders.list.key({ type: "query" }),
      });
      onCancel();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al crear prescripción");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      patientId: form.patientId,
      encounterId: form.encounterId,
      prescriberId: form.prescriberId,
      genericName: form.genericName,
      concentration: form.concentration,
      dosageForm: form.dosageForm,
      dose: form.dose,
      doseUnit: form.doseUnit || null,
      routeCode: form.routeCode,
      frequencyText: form.frequencyText,
      durationText: form.durationText,
      quantityTotal: form.quantityTotal,
      indications: form.indications || null,
      status: form.status,
      signedAt: new Date(form.signedAt),
      diagnosisId: null,
      atcCode: null,
      validUntil: null,
    });
  }

  return (
    <Card className="mx-6">
      <CardHeader>
        <CardTitle>Nueva prescripción</CardTitle>
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
            <Label>Prescriptor ID</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, prescriberId: e.target.value })
              }
              required
              value={form.prescriberId}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Nombre genérico (DCI)</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, genericName: e.target.value })
              }
              required
              value={form.genericName}
            />
          </div>
          <div className="space-y-1">
            <Label>Concentración</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, concentration: e.target.value })
              }
              placeholder="Ej: 500 mg"
              required
              value={form.concentration}
            />
          </div>
          <div className="space-y-1">
            <Label>Forma farmacéutica</Label>
            <Input
              onChange={(e) => setForm({ ...form, dosageForm: e.target.value })}
              placeholder="Ej: tableta"
              required
              value={form.dosageForm}
            />
          </div>
          <div className="space-y-1">
            <Label>Dosis</Label>
            <Input
              onChange={(e) => setForm({ ...form, dose: e.target.value })}
              required
              value={form.dose}
            />
          </div>
          <div className="space-y-1">
            <Label>Unidad dosis</Label>
            <Input
              onChange={(e) => setForm({ ...form, doseUnit: e.target.value })}
              value={form.doseUnit}
            />
          </div>
          <div className="space-y-1">
            <Label>Vía</Label>
            <Input
              onChange={(e) => setForm({ ...form, routeCode: e.target.value })}
              placeholder="Ej: oral"
              required
              value={form.routeCode}
            />
          </div>
          <div className="space-y-1">
            <Label>Frecuencia</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, frequencyText: e.target.value })
              }
              placeholder="Ej: cada 8 horas"
              required
              value={form.frequencyText}
            />
          </div>
          <div className="space-y-1">
            <Label>Duración</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, durationText: e.target.value })
              }
              placeholder="Ej: 7 días"
              required
              value={form.durationText}
            />
          </div>
          <div className="space-y-1">
            <Label>Cantidad total</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, quantityTotal: e.target.value })
              }
              required
              value={form.quantityTotal}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Indicaciones</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, indications: e.target.value })
              }
              value={form.indications}
            />
          </div>
          <div className="space-y-1">
            <Label>Fecha firma</Label>
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
              {create.isPending ? "Guardando..." : "Guardar prescripción"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MedicationOrdersListPage() {
  const [encounterId, setEncounterId] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery(
    orpc.medicationOrders.list.queryOptions({
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
      header: "Medicamento",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span className="inline-flex items-center gap-1.5">
          <Pill size={14} />
          {row.genericName}
        </span>
      ),
    },
    {
      header: "Concentración",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        row.concentration,
    },
    {
      header: "Vía",
      accessor: (row: NonNullable<typeof data>["items"][0]) => row.routeCode,
    },
    {
      header: "Frecuencia",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        row.frequencyText,
    },
    {
      header: "Estado",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span
          className={`inline-flex border px-1.5 py-0.5 font-medium text-[10px] ${
            row.status === "active"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {row.status}
        </span>
      ),
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
            {showForm ? "Cancelar" : "Nueva prescripción"}
          </Button>
        }
        description="Órdenes de medicamentos con denominación común internacional"
        title="Prescripciones"
      />

      {showForm && (
        <CreateMedicationOrderForm onCancel={() => setShowForm(false)} />
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
          emptyDescription="No se encontraron prescripciones."
          emptyTitle="Sin prescripciones"
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
