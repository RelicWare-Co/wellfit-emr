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
import { Paperclip, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/attachments/")({
  component: AttachmentsListPage,
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

function CreateAttachmentLinkForm({ onCancel }: { onCancel: () => void }) {
  const [form, setForm] = useState({
    binaryId: "",
    linkedEntityType: "encounter",
    linkedEntityId: "",
    title: "",
    classification: "support",
    capturedAt: new Date().toISOString().slice(0, 16),
  });

  const create = useMutation({
    ...orpc.attachments.createLink.mutationOptions(),
    onSuccess: () => {
      toast.success("Enlace de anexo creado");
      queryClient.invalidateQueries({
        queryKey: orpc.attachments.listLinks.key({ type: "query" }),
      });
      onCancel();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al crear enlace");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      binaryId: form.binaryId,
      linkedEntityType: form.linkedEntityType,
      linkedEntityId: form.linkedEntityId,
      title: form.title,
      classification: form.classification,
      capturedAt: new Date(form.capturedAt),
    });
  }

  return (
    <Card className="mx-6">
      <CardHeader>
        <CardTitle>Nuevo enlace de anexo</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
          onSubmit={handleSubmit}
        >
          <div className="space-y-1">
            <Label>Binary Object ID</Label>
            <Input
              onChange={(e) => setForm({ ...form, binaryId: e.target.value })}
              required
              value={form.binaryId}
            />
          </div>
          <div className="space-y-1">
            <Label>Tipo de entidad vinculada</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, linkedEntityType: e.target.value })
              }
              required
              value={form.linkedEntityType}
            />
          </div>
          <div className="space-y-1">
            <Label>ID entidad vinculada</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, linkedEntityId: e.target.value })
              }
              required
              value={form.linkedEntityId}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Título</Label>
            <Input
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              value={form.title}
            />
          </div>
          <div className="space-y-1">
            <Label>Clasificación</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, classification: e.target.value })
              }
              required
              value={form.classification}
            />
          </div>
          <div className="space-y-1">
            <Label>Fecha captura</Label>
            <Input
              onChange={(e) => setForm({ ...form, capturedAt: e.target.value })}
              required
              type="datetime-local"
              value={form.capturedAt}
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
              {create.isPending ? "Guardando..." : "Guardar enlace"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AttachmentsListPage() {
  const [linkedEntityId, setLinkedEntityId] = useState("");
  const [linkedEntityType, setLinkedEntityType] = useState("encounter");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery(
    orpc.attachments.listLinks.queryOptions({
      input: {
        limit,
        offset,
        linkedEntityId: linkedEntityId || "none",
        linkedEntityType,
      },
      enabled: !!linkedEntityId,
    })
  );

  const columns = [
    {
      header: "Título",
      accessor: (row: NonNullable<typeof data>["items"][0]) => (
        <span className="inline-flex items-center gap-1.5">
          <Paperclip size={14} />
          {row.title}
        </span>
      ),
    },
    {
      header: "Clasificación",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        row.classification,
    },
    {
      header: "Entidad",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        `${row.linkedEntityType} / ${row.linkedEntityId}`,
    },
    {
      header: "Fecha captura",
      accessor: (row: NonNullable<typeof data>["items"][0]) =>
        new Date(row.capturedAt).toLocaleString("es-CO"),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button onClick={() => setShowForm((s) => !s)} size="sm">
            <Plus size={14} />
            {showForm ? "Cancelar" : "Nuevo enlace"}
          </Button>
        }
        description="Anexos y documentos vinculados"
        title="Anexos"
      />

      {showForm && (
        <CreateAttachmentLinkForm onCancel={() => setShowForm(false)} />
      )}

      <div className="px-6">
        <div className="mb-3 flex items-center gap-2">
          <Search className="text-muted-foreground" size={14} />
          <Input
            className="h-7 max-w-[140px] text-xs"
            onChange={(e) => {
              setLinkedEntityType(e.target.value);
              setOffset(0);
            }}
            placeholder="Tipo entidad..."
            value={linkedEntityType}
          />
          <Input
            className="h-7 max-w-xs text-xs"
            onChange={(e) => {
              setLinkedEntityId(e.target.value);
              setOffset(0);
            }}
            placeholder="ID entidad..."
            value={linkedEntityId}
          />
        </div>

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          emptyDescription="No se encontraron anexos vinculados."
          emptyTitle="Sin anexos"
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
