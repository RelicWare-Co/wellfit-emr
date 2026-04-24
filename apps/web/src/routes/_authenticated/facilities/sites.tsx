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

export const Route = createFileRoute("/_authenticated/facilities/sites")({
  component: SitesPage,
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

function SitesPage() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [siteCode, setSiteCode] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [municipalityCode, setMunicipalityCode] = useState("");
  const [address, setAddress] = useState("");

  const { data, isLoading, refetch } = useQuery(
    orpc.facilities.listSites.queryOptions({
      input: {
        limit: LIMIT,
        offset,
        search: querySearch || undefined,
      },
    })
  );

  const { data: orgsData } = useQuery(
    orpc.facilities.listOrganizations.queryOptions({
      input: {
        limit: 100,
        offset: 0,
      },
    })
  );

  const createMutation = useMutation({
    ...orpc.facilities.createSite.mutationOptions(),
    onSuccess: () => {
      toast.success("Sede creada correctamente");
      setName("");
      setSiteCode("");
      setOrganizationId("");
      setMunicipalityCode("");
      setAddress("");
      setShowForm(false);
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error al crear sede: ${error.message}`);
    },
  });

  const handleSearch = () => {
    setOffset(0);
    setQuerySearch(search);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!(name.trim() && siteCode.trim() && organizationId)) {
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      siteCode: siteCode.trim(),
      organizationId,
      municipalityCode: municipalityCode.trim() || null,
      address: address.trim() || null,
    });
  };

  const orgMap = new Map(
    orgsData?.organizations.map((o: { id: string; name: string }) => [
      o.id,
      o.name,
    ])
  );
  type Site = NonNullable<typeof data>["sites"][0];

  return (
    <div className="flex flex-col">
      <PageHeader
        actions={
          <Button onClick={() => setShowForm((s) => !s)} size="sm">
            <Plus size={14} />
            <span className="ml-1.5">Nueva</span>
          </Button>
        }
        description="Administre las sedes de atencion"
        title="Sedes"
      />

      <div className="p-6">
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Nueva sede</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                onSubmit={handleCreate}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="site-name">Nombre *</Label>
                  <Input
                    id="site-name"
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre de la sede"
                    required
                    value={name}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="site-code">Codigo de sede *</Label>
                  <Input
                    id="site-code"
                    onChange={(e) => setSiteCode(e.target.value)}
                    placeholder="Codigo interno"
                    required
                    value={siteCode}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="site-org">Organizacion *</Label>
                  <select
                    className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs outline-none"
                    id="site-org"
                    onChange={(e) => setOrganizationId(e.target.value)}
                    required
                    value={organizationId}
                  >
                    <option value="">Seleccionar...</option>
                    {orgsData?.organizations.map(
                      (org: { id: string; name: string }) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="site-muni">Codigo municipio</Label>
                  <Input
                    id="site-muni"
                    onChange={(e) => setMunicipalityCode(e.target.value)}
                    placeholder="Codigo DANE"
                    value={municipalityCode}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="site-addr">Direccion</Label>
                  <Input
                    id="site-addr"
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Direccion fisica"
                    value={address}
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
            placeholder="Buscar por nombre o codigo..."
            value={search}
          />
          <Button onClick={handleSearch} size="sm" variant="outline">
            <Search size={14} />
          </Button>
        </div>

        <DataTable
          columns={[
            {
              header: "Codigo",
              accessor: (row: Site) => row.siteCode,
            },
            {
              header: "Nombre",
              accessor: (row: Site) => row.name,
            },
            {
              header: "Organizacion",
              accessor: (row: Site) => orgMap.get(row.organizationId) ?? "—",
            },
            {
              header: "Municipio",
              accessor: (row: Site) => row.municipalityCode ?? "—",
            },
            {
              header: "Direccion",
              accessor: (row: Site) => row.address ?? "—",
            },
            {
              header: "Creado",
              accessor: (row: Site) =>
                new Date(row.createdAt).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }),
            },
          ]}
          data={data?.sites ?? []}
          emptyDescription="No se encontraron sedes."
          emptyTitle="Sin sedes"
          isLoading={isLoading}
          keyExtractor={(row: Site) => row.id}
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
