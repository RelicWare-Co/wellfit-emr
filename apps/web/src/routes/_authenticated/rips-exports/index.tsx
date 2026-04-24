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
import { FileOutput, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/rips-exports/")({
  component: RipsExportsListPage,
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

function CreateRipsExportForm({ onCancel }: { onCancel: () => void }) {
  const [form, setForm] = useState({
    payerId: "",
    periodFrom: new Date().toISOString().slice(0, 10),
    periodTo: new Date().toISOString().slice(0, 10),
    status: "draft",
  });

  const [organizationSearch, setOrganizationSearch] = useState("");

  const { data: organizationsData, isLoading: organizationsLoading } = useQuery(
    orpc.facilities.listOrganizations.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: organizationSearch || undefined,
      },
    })
  );

  const create = useMutation({
    ...orpc.ripsExports.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Exportación RIPS creada");
      queryClient.invalidateQueries({
        queryKey: orpc.ripsExports.list.key({ type: "query" }),
      });
      onCancel();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al crear exportación");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      payerId: form.payerId,
      periodFrom: new Date(form.periodFrom),
      periodTo: new Date(form.periodTo),
      status: form.status,
      generatedAt: new Date(),
    });
  }

  return (
    <Card className="mx-6">
      <CardHeader>
        <CardTitle>Nueva exportación RIPS</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
          onSubmit={handleSubmit}
        >
          <div className="space-y-1">
            <Label>Pagador</Label>
            <SearchSelect
              emptyMessage="Escribe para buscar organizaciones"
              loading={organizationsLoading}
              onChange={(v) => setForm((f) => ({ ...f, payerId: v }))}
              onSearchChange={setOrganizationSearch}
              options={
                organizationsData?.organizations.map((o) => ({
                  value: o.id,
                  label: o.name,
                  description: o.taxId ?? undefined,
                })) ?? []
              }
              placeholder="Buscar organización..."
              required
              search={organizationSearch}
              value={form.payerId}
            />
          </div>
          <div className="space-y-1">
            <Label>Periodo desde</Label>
            <Input
              onChange={(e) => setForm({ ...form, periodFrom: e.target.value })}
              required
              type="date"
              value={form.periodFrom}
            />
          </div>
          <div className="space-y-1">
            <Label>Periodo hasta</Label>
            <Input
              onChange={(e) => setForm({ ...form, periodTo: e.target.value })}
              required
              type="date"
              value={form.periodTo}
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
              {create.isPending ? "Guardando..." : "Crear exportación"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RipsExportsListPage() {
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery(
    orpc.ripsExports.list.queryOptions({
      input: {
        limit,
        offset,
        status: status || undefined,
        sortDirection: "desc",
      },
    })
  );

  const columns = [
    {
      header: "Pagador ID",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span className="inline-flex items-center gap-1.5">
          <FileOutput size={14} />
          {row.payerId}
        </span>
      ),
    },
    {
      header: "Periodo",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        `${new Date(row.periodFrom).toLocaleDateString("es-CO")} - ${new Date(row.periodTo).toLocaleDateString("es-CO")}`,
    },
    {
      header: "Estado",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span
          className={`inline-flex border px-1.5 py-0.5 font-medium text-[10px] ${
            row.status === "draft"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : row.status === "sent"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      header: "Generado",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        new Date(row.generatedAt).toLocaleString("es-CO"),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button onClick={() => setShowForm((s) => !s)} size="sm">
            <Plus size={14} />
            {showForm ? "Cancelar" : "Nueva exportación"}
          </Button>
        }
        description="Generación y seguimiento de lotes RIPS"
        title="Exportaciones RIPS"
      />

      {showForm && <CreateRipsExportForm onCancel={() => setShowForm(false)} />}

      <div className="px-6">
        <div className="mb-3 flex items-center gap-2">
          <Search className="text-muted-foreground" size={14} />
          <Input
            className="h-7 max-w-xs text-xs"
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
            placeholder="Filtrar por estado..."
            value={status}
          />
        </div>

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          emptyDescription="No se encontraron exportaciones RIPS."
          emptyTitle="Sin exportaciones"
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
