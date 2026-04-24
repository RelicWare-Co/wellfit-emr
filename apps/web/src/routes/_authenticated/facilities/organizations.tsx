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
  "/_authenticated/facilities/organizations"
)({
  component: OrganizationsPage,
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

function OrganizationsPage() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [repsCode, setRepsCode] = useState("");
  const [taxId, setTaxId] = useState("");

  const { data, isLoading, refetch } = useQuery(
    orpc.facilities.listOrganizations.queryOptions({
      input: {
        limit: LIMIT,
        offset,
        search: querySearch || undefined,
      },
    })
  );

  const createMutation = useMutation({
    ...orpc.facilities.createOrganization.mutationOptions(),
    onSuccess: () => {
      toast.success("Organizacion creada correctamente");
      setName("");
      setRepsCode("");
      setTaxId("");
      setShowForm(false);
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error al crear organizacion: ${error.message}`);
    },
  });

  const handleSearch = () => {
    setOffset(0);
    setQuerySearch(search);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      repsCode: repsCode.trim() || null,
      taxId: taxId.trim() || null,
      status: "active",
    });
  };

  type Org = NonNullable<typeof data>["organizations"][0];

  return (
    <div className="flex flex-col">
      <PageHeader
        actions={
          <Button onClick={() => setShowForm((s) => !s)} size="sm">
            <Plus size={14} />
            <span className="ml-1.5">Nueva</span>
          </Button>
        }
        description="Administre las organizaciones de salud registradas"
        title="Organizaciones"
      />

      <div className="p-6">
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Nueva organizacion</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                onSubmit={handleCreate}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="org-name">Nombre *</Label>
                  <Input
                    id="org-name"
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre de la organizacion"
                    required
                    value={name}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="org-reps">Codigo REPS</Label>
                  <Input
                    id="org-reps"
                    onChange={(e) => setRepsCode(e.target.value)}
                    placeholder="Codigo REPS"
                    value={repsCode}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="org-tax">NIT</Label>
                  <Input
                    id="org-tax"
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="NIT"
                    value={taxId}
                  />
                </div>
                <div className="flex items-end gap-2 sm:col-span-3">
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
            placeholder="Buscar por nombre, REPS o NIT..."
            value={search}
          />
          <Button onClick={handleSearch} size="sm" variant="outline">
            <Search size={14} />
          </Button>
        </div>

        <DataTable
          columns={[
            {
              header: "Nombre",
              accessor: (row: Org) => row.name,
            },
            {
              header: "REPS",
              accessor: (row: Org) => row.repsCode ?? "—",
            },
            {
              header: "NIT",
              accessor: (row: Org) => row.taxId ?? "—",
            },
            {
              header: "Estado",
              accessor: (row: Org) => (
                <span
                  className={`inline-flex items-center border px-1.5 py-0.5 font-medium text-[10px] ${
                    row.status === "active"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {row.status === "active" ? "Activo" : "Inactivo"}
                </span>
              ),
            },
            {
              header: "Creado",
              accessor: (row: Org) =>
                new Date(row.createdAt).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }),
            },
          ]}
          data={data?.organizations ?? []}
          emptyDescription="No se encontraron organizaciones."
          emptyTitle="Sin organizaciones"
          isLoading={isLoading}
          keyExtractor={(row: Org) => row.id}
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
