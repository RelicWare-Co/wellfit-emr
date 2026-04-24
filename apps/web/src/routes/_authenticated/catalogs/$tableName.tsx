import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@wellfit-emr/ui/components/button";
import { Input } from "@wellfit-emr/ui/components/input";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/catalogs/$tableName")({
  component: TableEntriesPage,
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

const LIMIT = 100;

function TableEntriesPage() {
  const { tableName } = Route.useParams();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [querySearch, setQuerySearch] = useState("");

  const { data, isLoading, refetch } = useQuery(
    orpc.ripsReference.listEntries.queryOptions({
      input: {
        tableName,
        limit: LIMIT,
        offset,
        search: querySearch || undefined,
      },
    })
  );

  const syncTableMutation = useMutation({
    ...orpc.ripsReference.syncTable.mutationOptions(),
    onSuccess: (result: {
      tableName: string;
      inserted: number;
      updated: number;
    }) => {
      toast.success(
        `Tabla ${result.tableName} sincronizada: ${result.inserted} insertadas, ${result.updated} actualizadas`
      );
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error al sincronizar tabla: ${error.message}`);
    },
  });

  const handleSearch = () => {
    setOffset(0);
    setQuerySearch(search);
  };

  type Entry = NonNullable<typeof data>["entries"][0];

  return (
    <div className="flex flex-col">
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            <Button
              disabled={syncTableMutation.isPending}
              onClick={() => syncTableMutation.mutate({ tableName })}
              size="sm"
              variant="outline"
            >
              <RefreshCw
                className={syncTableMutation.isPending ? "animate-spin" : ""}
                size={14}
              />
              <span className="ml-1.5">Sincronizar tabla</span>
            </Button>
            <Link
              className="inline-flex h-7 items-center justify-center gap-1 rounded-none border border-input bg-background px-2.5 font-medium text-xs transition-colors hover:bg-muted"
              to="/catalogs"
            >
              <ArrowLeft size={14} />
              Volver
            </Link>
          </div>
        }
        backTo="/catalogs"
        description="Entradas de la tabla de referencia RIPS"
        title={tableName}
      />

      <div className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Input
            className="max-w-xs"
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Buscar por codigo o nombre..."
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
              accessor: (row: Entry) => row.code,
              className: "w-32 font-mono",
            },
            {
              header: "Nombre",
              accessor: (row: Entry) => row.name,
            },
            {
              header: "Descripcion",
              accessor: (row: Entry) => row.description ?? "—",
            },
            {
              header: "Habilitado",
              accessor: (row: Entry) =>
                row.enabled ? (
                  <span className="inline-flex items-center border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-medium text-[10px] text-emerald-700">
                    Si
                  </span>
                ) : (
                  <span className="inline-flex items-center border border-red-200 bg-red-50 px-1.5 py-0.5 font-medium text-[10px] text-red-700">
                    No
                  </span>
                ),
              className: "w-24",
            },
          ]}
          data={data?.entries ?? []}
          emptyDescription="No se encontraron entradas en esta tabla."
          emptyTitle="Sin entradas"
          isLoading={isLoading}
          keyExtractor={(row: Entry) => String(row.id)}
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
