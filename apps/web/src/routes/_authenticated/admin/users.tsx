import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@wellfit-emr/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wellfit-emr/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wellfit-emr/ui/components/dropdown-menu";
import { Input } from "@wellfit-emr/ui/components/input";
import { Label } from "@wellfit-emr/ui/components/label";
import {
  AlertTriangle,
  Ban,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
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

interface UserItem {
  banned: boolean | null;
  createdAt: Date | string;
  email: string;
  id: string;
  name: string;
  role: string;
}

function UsersPage() {
  const [offset, setOffset] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  const { data, isLoading, error, refetch } = useQuery(
    orpc.admin.listUsers.queryOptions({
      input: {
        limit: LIMIT,
        offset,
        searchValue: querySearch || undefined,
      },
    })
  );

  const isForbidden =
    error != null &&
    (error.message?.toLowerCase().includes("not allowed") ||
      error.message?.toLowerCase().includes("permission") ||
      ("status" in error &&
        ((error as { status: number }).status === 403 ||
          (error as { status: number }).status === 500)));

  const hasError = error != null;

  const createMutation = useMutation({
    ...orpc.admin.createUser.mutationOptions(),
    onSuccess: () => {
      toast.success("Usuario creado correctamente");
      setName("");
      setEmail("");
      setPassword("");
      setRole("user");
      setShowForm(false);
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error al crear usuario: ${error.message}`);
    },
  });

  const banMutation = useMutation({
    ...orpc.admin.banUser.mutationOptions(),
    onSuccess: () => {
      toast.success("Usuario baneado");
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const unbanMutation = useMutation({
    ...orpc.admin.unbanUser.mutationOptions(),
    onSuccess: () => {
      toast.success("Usuario desbaneado");
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const setRoleMutation = useMutation({
    ...orpc.admin.setRole.mutationOptions(),
    onSuccess: () => {
      toast.success("Rol actualizado");
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const removeMutation = useMutation({
    ...orpc.admin.removeUser.mutationOptions(),
    onSuccess: () => {
      toast.success("Usuario eliminado");
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleSearch = () => {
    setOffset(0);
    setQuerySearch(searchValue);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!(name.trim() && email.trim() && password.trim())) {
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
      role,
    });
  };

  const users = (data?.users as UserItem[]) ?? [];

  return (
    <div className="flex flex-col">
      <PageHeader
        actions={
          !hasError && (
            <Button onClick={() => setShowForm((s) => !s)} size="sm">
              <Plus size={14} />
              <span className="ml-1.5">Nuevo usuario</span>
            </Button>
          )
        }
        description="Gestione los usuarios del sistema"
        title="Administracion de usuarios"
      />

      <div className="p-6">
        {hasError && (
          <div className="flex flex-col items-center justify-center border py-12 text-center">
            <div className="mb-3 inline-flex size-10 items-center justify-center bg-muted">
              {isForbidden ? (
                <Lock className="text-muted-foreground" size={20} />
              ) : (
                <AlertTriangle className="text-muted-foreground" size={20} />
              )}
            </div>
            <p className="font-medium text-sm">
              {isForbidden ? "Acceso denegado" : "Error al cargar usuarios"}
            </p>
            <p className="mt-1 max-w-xs text-muted-foreground text-xs">
              {isForbidden
                ? "No tienes permisos para administrar usuarios. Contacta a un administrador si crees que esto es un error."
                : error?.message ||
                  "Ocurrio un error inesperado. Intenta de nuevo mas tarde."}
            </p>
          </div>
        )}

        {!hasError && showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Nuevo usuario</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                onSubmit={handleCreate}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="user-name">Nombre *</Label>
                  <Input
                    id="user-name"
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre completo"
                    required
                    value={name}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="user-email">Correo electronico *</Label>
                  <Input
                    id="user-email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="user-password">Contrasena *</Label>
                  <Input
                    id="user-password"
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contrasena"
                    required
                    type="password"
                    value={password}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="user-role">Rol</Label>
                  <select
                    className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs outline-none"
                    id="user-role"
                    onChange={(e) =>
                      setRole(e.target.value as "user" | "admin")
                    }
                    value={role}
                  >
                    <option value="user">Usuario</option>
                    <option value="admin">Administrador</option>
                  </select>
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

        {!hasError && (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Input
                className="max-w-xs"
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Buscar por nombre o correo..."
                value={searchValue}
              />
              <Button onClick={handleSearch} size="sm" variant="outline">
                <Search size={14} />
              </Button>
            </div>

            <DataTable
              columns={[
                {
                  header: "Nombre",
                  accessor: (row: UserItem) => row.name,
                },
                {
                  header: "Correo",
                  accessor: (row: UserItem) => row.email,
                },
                {
                  header: "Rol",
                  accessor: (row: UserItem) => (
                    <span className="inline-flex items-center border border-border bg-muted px-1.5 py-0.5 font-medium text-[10px]">
                      {row.role}
                    </span>
                  ),
                },
                {
                  header: "Estado",
                  accessor: (row: UserItem) =>
                    row.banned ? (
                      <span className="inline-flex items-center border border-red-200 bg-red-50 px-1.5 py-0.5 font-medium text-[10px] text-red-700">
                        Baneado
                      </span>
                    ) : (
                      <span className="inline-flex items-center border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-medium text-[10px] text-emerald-700">
                        Activo
                      </span>
                    ),
                },
                {
                  header: "Creado",
                  accessor: (row: UserItem) =>
                    new Date(row.createdAt).toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }),
                },
                {
                  header: "Acciones",
                  accessor: (row: UserItem) => (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button size="icon-xs" variant="ghost">
                            <MoreHorizontal size={14} />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            setRoleMutation.mutate({
                              userId: row.id,
                              role: row.role === "admin" ? "user" : "admin",
                            })
                          }
                        >
                          Cambiar rol a{" "}
                          {row.role === "admin" ? "usuario" : "admin"}
                        </DropdownMenuItem>
                        {row.banned ? (
                          <DropdownMenuItem
                            onClick={() =>
                              unbanMutation.mutate({ userId: row.id })
                            }
                          >
                            <UserCheck className="mr-2" size={14} />
                            Desbanear
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              banMutation.mutate({ userId: row.id })
                            }
                          >
                            <Ban className="mr-2" size={14} />
                            Banear
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            removeMutation.mutate({ userId: row.id });
                          }}
                        >
                          <Trash2 className="mr-2" size={14} />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ),
                  className: "w-16",
                },
              ]}
              data={users}
              emptyDescription="No se encontraron usuarios."
              emptyTitle="Sin usuarios"
              isLoading={isLoading}
              keyExtractor={(row: UserItem) => row.id}
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
          </>
        )}
      </div>
    </div>
  );
}
