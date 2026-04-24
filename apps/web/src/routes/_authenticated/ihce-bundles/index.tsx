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
import { Plus, Search, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/ihce-bundles/")({
  component: IhceBundlesListPage,
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

function CreateIhceBundleForm({ onCancel }: { onCancel: () => void }) {
  const [form, setForm] = useState({
    encounterId: "",
    bundleType: "document",
    bundleJson: "{}",
  });

  const create = useMutation({
    ...orpc.ihceBundles.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Bundle IHCE creado");
      queryClient.invalidateQueries({
        queryKey: orpc.ihceBundles.list.key({ type: "query" }),
      });
      onCancel();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al crear bundle");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let bundleJson: Record<string, unknown> = {};
    try {
      bundleJson = JSON.parse(form.bundleJson);
    } catch {
      toast.error("JSON inválido");
      return;
    }
    create.mutate({
      encounterId: form.encounterId,
      bundleType: form.bundleType,
      bundleJson,
      status: "generated",
      generatedAt: new Date(),
    });
  }

  return (
    <Card className="mx-6">
      <CardHeader>
        <CardTitle>Nuevo bundle IHCE</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
          onSubmit={handleSubmit}
        >
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
            <Label>Tipo de bundle</Label>
            <Input
              onChange={(e) => setForm({ ...form, bundleType: e.target.value })}
              required
              value={form.bundleType}
            />
          </div>
          <div className="space-y-1 md:col-span-3">
            <Label>Bundle JSON</Label>
            <Input
              onChange={(e) => setForm({ ...form, bundleJson: e.target.value })}
              value={form.bundleJson}
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
              {create.isPending ? "Guardando..." : "Crear bundle"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function IhceBundlesListPage() {
  const [encounterId, setEncounterId] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery(
    orpc.ihceBundles.list.queryOptions({
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
          <Share2 size={14} />
          {row.bundleType}
        </span>
      ),
    },
    {
      header: "Atención ID",
      accessor: (row: NonNullable<typeof data>["items"][0]) => row.encounterId,
    },
    {
      header: "Estado",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span
          className={`inline-flex border px-1.5 py-0.5 font-medium text-[10px] ${
            row.status === "generated"
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
    {
      header: "Enviado",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        row.sentAt ? new Date(row.sentAt).toLocaleString("es-CO") : "—",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button onClick={() => setShowForm((s) => !s)} size="sm">
            <Plus size={14} />
            {showForm ? "Cancelar" : "Nuevo bundle"}
          </Button>
        }
        description="Bundles FHIR/RDA para interoperabilidad IHCE"
        title="Bundles IHCE"
      />

      {showForm && <CreateIhceBundleForm onCancel={() => setShowForm(false)} />}

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
          emptyDescription="No se encontraron bundles IHCE."
          emptyTitle="Sin bundles"
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
