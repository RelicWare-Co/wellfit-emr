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
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute(
  "/_authenticated/facilities/practitioners"
)({
  component: PractitionersPage,
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

const LIMIT = 50;

function PractitionersPage() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [documentType, setDocumentType] = useState("CC");
  const [documentNumber, setDocumentNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [rethusNumber, setRethusNumber] = useState("");
  const [active, setActive] = useState(true);

  const { data, isLoading, refetch } = useQuery(
    orpc.facilities.listPractitioners.queryOptions({
      input: {
        limit: LIMIT,
        offset,
        search: querySearch || undefined,
      },
    })
  );

  const createMutation = useMutation({
    ...orpc.facilities.createPractitioner.mutationOptions(),
    onSuccess: () => {
      toast.success("Profesional creado correctamente");
      setDocumentType("CC");
      setDocumentNumber("");
      setFullName("");
      setRethusNumber("");
      setActive(true);
      setShowForm(false);
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error al crear profesional: ${error.message}`);
    },
  });

  const handleSearch = () => {
    setOffset(0);
    setQuerySearch(search);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!(documentNumber.trim() && fullName.trim())) {
      return;
    }
    createMutation.mutate({
      documentType,
      documentNumber: documentNumber.trim(),
      fullName: fullName.trim(),
      rethusNumber: rethusNumber.trim() || null,
      active,
    });
  };

  type Practitioner = NonNullable<typeof data>["practitioners"][0];

  return (
    <div className="flex flex-col">
      <PageHeader
        actions={
          <Button onClick={() => setShowForm((s) => !s)} size="sm">
            <Plus size={14} />
            <span className="ml-1.5">Nuevo</span>
          </Button>
        }
        description="Administre los profesionales de salud"
        title="Profesionales"
      />

      <div className="p-6">
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Nuevo profesional</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                onSubmit={handleCreate}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="prac-doctype">Tipo de documento *</Label>
                  <select
                    className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs outline-none"
                    id="prac-doctype"
                    onChange={(e) => setDocumentType(e.target.value)}
                    value={documentType}
                  >
                    <option value="CC">Cedula de ciudadania</option>
                    <option value="CE">Cedula de extranjeria</option>
                    <option value="PA">Pasaporte</option>
                    <option value="RC">Registro civil</option>
                    <option value="TI">Tarjeta de identidad</option>
                    <option value="PEP">Permiso especial de permanencia</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prac-docnum">Numero de documento *</Label>
                  <Input
                    id="prac-docnum"
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="Numero de documento"
                    required
                    value={documentNumber}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prac-name">Nombre completo *</Label>
                  <Input
                    id="prac-name"
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nombre completo"
                    required
                    value={fullName}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prac-rethus">Numero RETHUS</Label>
                  <Input
                    id="prac-rethus"
                    onChange={(e) => setRethusNumber(e.target.value)}
                    placeholder="Numero RETHUS"
                    value={rethusNumber}
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    checked={active}
                    className="size-4 rounded-none border border-input"
                    id="prac-active"
                    onChange={(e) => setActive(e.target.checked)}
                    type="checkbox"
                  />
                  <Label htmlFor="prac-active">Activo</Label>
                </div>
                <div className="flex items-end gap-2 sm:col-start-1">
                  <Button
                    disabled={createMutation.isPending}
                    size="sm"
                    type="submit"
                  >
                    Guardar
                  </Button>
                  <Button
                    onClick={() => setShowForm(false)}
                    size="sm"
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="mb-4 flex items-center gap-2">
          <Input
            className="max-w-xs"
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Buscar por nombre, documento o RETHUS..."
            value={search}
          />
          <Button onClick={handleSearch} size="sm" variant="outline">
            <Search size={14} />
          </Button>
        </div>

        <DataTable
          columns={[
            {
              header: "Tipo doc.",
              accessor: (row: Practitioner) => row.documentType,
              className: "w-24",
            },
            {
              header: "Documento",
              accessor: (row: Practitioner) => row.documentNumber,
            },
            {
              header: "Nombre",
              accessor: (row: Practitioner) => row.fullName,
            },
            {
              header: "RETHUS",
              accessor: (row: Practitioner) => row.rethusNumber ?? "—",
            },
            {
              header: "Estado",
              accessor: (row: Practitioner) => (
                <span
                  className={`inline-flex items-center border px-1.5 py-0.5 font-medium text-[10px] ${
                    row.active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {row.active ? "Activo" : "Inactivo"}
                </span>
              ),
            },
            {
              header: "Creado",
              accessor: (row: Practitioner) =>
                new Date(row.createdAt).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }),
            },
          ]}
          data={data?.practitioners ?? []}
          emptyDescription="No se encontraron profesionales."
          emptyTitle="Sin profesionales"
          isLoading={isLoading}
          keyExtractor={(row: Practitioner) => row.id}
          pagination={
            data
              ? {
                  limit: LIMIT,
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
