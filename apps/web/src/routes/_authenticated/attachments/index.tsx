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
import { Paperclip, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

function getEntityOptions(
  linkedEntityType: string,
  patientsData:
    | {
        patients: Array<{
          id: string;
          firstName: string;
          lastName1: string;
          primaryDocumentType: string;
          primaryDocumentNumber: string;
        }>;
      }
    | undefined,
  encountersData:
    | {
        encounters: Array<{
          id: string;
          reasonForVisit: string | null;
          startedAt: Date | string;
        }>;
      }
    | undefined,
  practitionersData:
    | {
        practitioners: Array<{
          id: string;
          fullName: string;
          documentNumber: string;
        }>;
      }
    | undefined
) {
  if (linkedEntityType === "patient") {
    return (
      patientsData?.patients.map((p) => ({
        value: p.id,
        label: `${p.firstName} ${p.lastName1}`,
        description: `${p.primaryDocumentType} ${p.primaryDocumentNumber}`,
      })) ?? []
    );
  }
  if (linkedEntityType === "encounter") {
    return (
      encountersData?.encounters.map((e) => ({
        value: e.id,
        label: e.reasonForVisit || "Sin motivo",
        description: new Date(e.startedAt).toLocaleDateString("es-CO"),
      })) ?? []
    );
  }
  if (linkedEntityType === "practitioner") {
    return (
      practitionersData?.practitioners.map((p) => ({
        value: p.id,
        label: p.fullName,
        description: p.documentNumber,
      })) ?? []
    );
  }
  return [];
}

function getEntityLoading(
  linkedEntityType: string,
  patientsLoading: boolean,
  encountersLoading: boolean,
  practitionersLoading: boolean
) {
  if (linkedEntityType === "patient") {
    return patientsLoading;
  }
  if (linkedEntityType === "encounter") {
    return encountersLoading;
  }
  if (linkedEntityType === "practitioner") {
    return practitionersLoading;
  }
  return false;
}

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

  const [entitySearch, setEntitySearch] = useState("");

  const { data: patientsData, isLoading: patientsLoading } = useQuery(
    orpc.patients.list.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: entitySearch || undefined,
      },
      enabled: form.linkedEntityType === "patient",
    })
  );

  const { data: encountersData, isLoading: encountersLoading } = useQuery(
    orpc.encounters.list.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: entitySearch || undefined,
      },
      enabled: form.linkedEntityType === "encounter",
    })
  );

  const { data: practitionersData, isLoading: practitionersLoading } = useQuery(
    orpc.facilities.listPractitioners.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: entitySearch || undefined,
      },
      enabled: form.linkedEntityType === "practitioner",
    })
  );

  const entityOptions = getEntityOptions(
    form.linkedEntityType,
    patientsData,
    encountersData,
    practitionersData
  );

  const entityLoading = getEntityLoading(
    form.linkedEntityType,
    patientsLoading,
    encountersLoading,
    practitionersLoading
  );

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
            <select
              className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              onChange={(e) =>
                setForm({
                  ...form,
                  linkedEntityType: e.target.value,
                  linkedEntityId: "",
                })
              }
              required
              value={form.linkedEntityType}
            >
              <option value="encounter">Atención</option>
              <option value="patient">Paciente</option>
              <option value="practitioner">Profesional</option>
              <option value="organization">Organización</option>
              <option value="clinicalDocument">Documento clínico</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Entidad vinculada</Label>
            {form.linkedEntityType === "organization" ||
            form.linkedEntityType === "clinicalDocument" ? (
              <Input
                onChange={(e) =>
                  setForm({ ...form, linkedEntityId: e.target.value })
                }
                placeholder="Ingrese el ID"
                required
                value={form.linkedEntityId}
              />
            ) : (
              <SearchSelect
                emptyMessage="Escribe para buscar"
                loading={entityLoading}
                onChange={(v) => setForm((f) => ({ ...f, linkedEntityId: v }))}
                onSearchChange={setEntitySearch}
                options={entityOptions}
                placeholder="Buscar entidad..."
                required
                search={entitySearch}
                value={form.linkedEntityId}
              />
            )}
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
  const [entitySearch, setEntitySearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);
  const [showForm, setShowForm] = useState(false);

  const { data: patientsData, isLoading: patientsLoading } = useQuery(
    orpc.patients.list.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: entitySearch || undefined,
      },
      enabled: linkedEntityType === "patient",
    })
  );

  const { data: encountersData, isLoading: encountersLoading } = useQuery(
    orpc.encounters.list.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: entitySearch || undefined,
      },
      enabled: linkedEntityType === "encounter",
    })
  );

  const { data: practitionersData, isLoading: practitionersLoading } = useQuery(
    orpc.facilities.listPractitioners.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: entitySearch || undefined,
      },
      enabled: linkedEntityType === "practitioner",
    })
  );

  const entityOptions = getEntityOptions(
    linkedEntityType,
    patientsData,
    encountersData,
    practitionersData
  );

  const entityLoading = getEntityLoading(
    linkedEntityType,
    patientsLoading,
    encountersLoading,
    practitionersLoading
  );

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
          <select
            className="h-7 rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
            onChange={(e) => {
              setLinkedEntityType(e.target.value);
              setLinkedEntityId("");
              setOffset(0);
            }}
            value={linkedEntityType}
          >
            <option value="encounter">Atención</option>
            <option value="patient">Paciente</option>
            <option value="practitioner">Profesional</option>
            <option value="organization">Organización</option>
            <option value="clinicalDocument">Documento clínico</option>
          </select>
          {linkedEntityType === "organization" ||
          linkedEntityType === "clinicalDocument" ? (
            <Input
              className="h-7 max-w-xs text-xs"
              onChange={(e) => {
                setLinkedEntityId(e.target.value);
                setOffset(0);
              }}
              placeholder="ID entidad..."
              value={linkedEntityId}
            />
          ) : (
            <SearchSelect
              className="max-w-xs"
              clearable
              emptyMessage="Escribe para buscar"
              loading={entityLoading}
              onChange={(v) => {
                setLinkedEntityId(v);
                setOffset(0);
              }}
              onSearchChange={setEntitySearch}
              options={entityOptions}
              placeholder="Buscar entidad..."
              search={entitySearch}
              value={linkedEntityId}
            />
          )}
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
