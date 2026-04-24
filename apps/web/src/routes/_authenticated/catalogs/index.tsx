import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@wellfit-emr/ui/components/button";
import { Skeleton } from "@wellfit-emr/ui/components/skeleton";
import { RefreshCw, Table } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/catalogs/")({
  component: CatalogsPage,
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

function CatalogsPage() {
  const { data, isLoading, refetch } = useQuery(
    orpc.ripsReference.listTables.queryOptions({
      input: {
        limit: 100,
        offset: 0,
        onlyActive: false,
      },
    })
  );

  const syncAllMutation = useMutation({
    ...orpc.ripsReference.syncAll.mutationOptions(),
    onSuccess: (result: { synced: number; errors: string[] }) => {
      toast.success(`Sincronizacion completada: ${result.synced} tablas`);
      if (result.errors.length > 0) {
        toast.error(`Errores: ${result.errors.join(", ")}`);
      }
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error al sincronizar: ${error.message}`);
    },
  });

  type TableItem = NonNullable<typeof data>["tables"][0];

  return (
    <div className="flex flex-col">
      <PageHeader
        actions={
          <Button
            disabled={syncAllMutation.isPending}
            onClick={() => syncAllMutation.mutate()}
            size="sm"
            variant="outline"
          >
            <RefreshCw
              className={syncAllMutation.isPending ? "animate-spin" : ""}
              size={14}
            />
            <span className="ml-1.5">Sincronizar todo</span>
          </Button>
        }
        description="Tablas de referencia RIPS sincronizadas con SISPRO"
        title="Catalogos RIPS"
      />

      <div className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="border p-4" key={i}>
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : data && data.tables.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.tables.map((table: TableItem) => (
              <Link
                className="group flex flex-col gap-2 border bg-card p-4 transition-colors hover:bg-muted/50"
                key={table.id}
                params={{ tableName: table.name }}
                to="/catalogs/$tableName"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center bg-muted">
                      <Table className="text-muted-foreground" size={14} />
                    </div>
                    <h3 className="font-medium text-sm">{table.name}</h3>
                  </div>
                  {table.isActive ? (
                    <span className="inline-flex items-center border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-medium text-[10px] text-emerald-700">
                      Activa
                    </span>
                  ) : (
                    <span className="inline-flex items-center border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-medium text-[10px] text-amber-700">
                      Inactiva
                    </span>
                  )}
                </div>
                {table.description && (
                  <p className="line-clamp-2 text-muted-foreground text-xs">
                    {table.description}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{table.entryCount} entradas</span>
                  {table.lastSyncedAt && (
                    <span>
                      Sincronizado{" "}
                      {new Date(table.lastSyncedAt).toLocaleDateString(
                        "es-CO",
                        {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 inline-flex size-10 items-center justify-center bg-muted">
              <Table className="text-muted-foreground" size={20} />
            </div>
            <p className="font-medium text-sm">Sin catalogos</p>
            <p className="mt-1 max-w-xs text-muted-foreground text-xs">
              No se encontraron tablas de referencia RIPS.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
