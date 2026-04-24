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
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute(
  "/_authenticated/facilities/service-units"
)({
  component: ServiceUnitsPage,
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

function ServiceUnitsPage() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [siteId, setSiteId] = useState("");
  const [careSetting, setCareSetting] = useState("");

  const { data, isLoading, refetch } = useQuery(
    orpc.facilities.listServiceUnits.queryOptions({
      input: {
        limit: LIMIT,
        offset,
        search: querySearch || undefined,
      },
    })
  );

  const { data: sitesData } = useQuery(
    orpc.facilities.listSites.queryOptions({
      input: {
        limit: 100,
        offset: 0,
      },
    })
  );

  const { data: servicesData, isLoading: servicesLoading } = useQuery(
    orpc.ripsReference.listEntries.queryOptions({
      input: {
        tableName: "Servicios",
        limit: 20,
        search: serviceSearch || undefined,
      },
    })
  );

  const createMutation = useMutation({
    ...orpc.facilities.createServiceUnit.mutationOptions(),
    onSuccess: () => {
      toast.success("Unidad de servicio creada correctamente");
      setName("");
      setServiceCode("");
      setServiceSearch("");
      setSiteId("");
      setCareSetting("");
      setShowForm(false);
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error al crear unidad de servicio: ${error.message}`);
    },
  });

  const handleSearch = () => {
    setOffset(0);
    setQuerySearch(search);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!(name.trim() && serviceCode.trim() && siteId && careSetting.trim())) {
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      serviceCode: serviceCode.trim(),
      siteId,
      careSetting: careSetting.trim(),
    });
  };

  const siteMap = new Map(
    sitesData?.sites.map((s: { id: string; name: string }) => [s.id, s.name])
  );
  type SU = NonNullable<typeof data>["serviceUnits"][0];

  return (
    <div className="flex flex-col">
      <PageHeader
        actions={
          <Button onClick={() => setShowForm((s) => !s)} size="sm">
            <Plus size={14} />
            <span className="ml-1.5">Nueva</span>
          </Button>
        }
        description="Administre las unidades de servicio de salud"
        title="Unidades de servicio"
      />

      <div className="p-6">
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Nueva unidad de servicio</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                onSubmit={handleCreate}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="su-name">Nombre *</Label>
                  <Input
                    id="su-name"
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre del servicio"
                    required
                    value={name}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-code">Codigo de servicio *</Label>
                  <SearchSelect
                    emptyMessage="Escribe para buscar servicios"
                    id="su-code"
                    loading={servicesLoading}
                    onChange={(value) => {
                      const selected = servicesData?.entries.find(
                        (entry) => entry.code === value
                      );
                      setServiceCode(value);
                      setName((current) => current || selected?.name || "");
                    }}
                    onSearchChange={setServiceSearch}
                    options={
                      servicesData?.entries.map((entry) => ({
                        value: entry.code,
                        label: entry.name,
                        description: entry.code,
                      })) ?? []
                    }
                    placeholder="Buscar servicio..."
                    required
                    search={serviceSearch}
                    value={serviceCode}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-site">Sede *</Label>
                  <select
                    className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs outline-none"
                    id="su-site"
                    onChange={(e) => setSiteId(e.target.value)}
                    required
                    value={siteId}
                  >
                    <option value="">Seleccionar...</option>
                    {sitesData?.sites.map(
                      (site: { id: string; name: string }) => (
                        <option key={site.id} value={site.id}>
                          {site.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-3">
                  <Label htmlFor="su-care">Ambito de atencion *</Label>
                  <Input
                    id="su-care"
                    onChange={(e) => setCareSetting(e.target.value)}
                    placeholder="Ej. ambulatorio, hospitalario, urgencias"
                    required
                    value={careSetting}
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
              accessor: (row: SU) => row.serviceCode,
            },
            {
              header: "Nombre",
              accessor: (row: SU) => row.name,
            },
            {
              header: "Sede",
              accessor: (row: SU) => siteMap.get(row.siteId) ?? "—",
            },
            {
              header: "Ambito",
              accessor: (row: SU) => row.careSetting,
            },
            {
              header: "Creado",
              accessor: (row: SU) =>
                new Date(row.createdAt).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }),
            },
          ]}
          data={data?.serviceUnits ?? []}
          emptyDescription="No se encontraron unidades de servicio."
          emptyTitle="Sin unidades de servicio"
          isLoading={isLoading}
          keyExtractor={(row: SU) => row.id}
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
