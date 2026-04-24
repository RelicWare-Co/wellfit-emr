import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wellfit-emr/ui/components/card";
import { Skeleton } from "@wellfit-emr/ui/components/skeleton";
import {
  Activity,
  Calendar,
  ChevronRight,
  Clock,
  Stethoscope,
  Users,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
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

function DashboardPage() {
  const { session } = Route.useRouteContext();
  const { data: patientsData, isLoading: patientsLoading } = useQuery(
    orpc.patients.list.queryOptions({ input: { limit: 5, offset: 0 } })
  );
  const { data: encountersData, isLoading: encountersLoading } = useQuery(
    orpc.encounters.list.queryOptions({ input: { limit: 5, offset: 0 } })
  );

  const stats = [
    {
      label: "Pacientes registrados",
      value: patientsData?.total ?? 0,
      icon: Users,
      loading: patientsLoading,
    },
    {
      label: "Atenciones del mes",
      value: encountersData?.total ?? 0,
      icon: Calendar,
      loading: encountersLoading,
    },
    {
      label: "Atenciones activas",
      value:
        encountersData?.encounters.filter((e) => e.status === "in-progress")
          .length ?? 0,
      icon: Activity,
      loading: encountersLoading,
    },
    {
      label: "Profesionales activos",
      value: "—",
      icon: Stethoscope,
      loading: false,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-medium text-xl">Dashboard</h1>
        <p className="text-muted-foreground text-xs">
          Bienvenido, {session.data?.user.name}. Resumen operativo de la
          institución.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} size="sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-normal text-muted-foreground text-xs">
                {stat.label}
              </CardTitle>
              <stat.icon className="text-muted-foreground" size={16} />
            </CardHeader>
            <CardContent>
              {stat.loading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <div className="font-semibold text-2xl">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Atenciones recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {encountersLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton className="h-10 w-full" key={i} />
              ))
            ) : encountersData && encountersData.encounters.length > 0 ? (
              encountersData.encounters.map((enc) => (
                <Link
                  className="flex items-center justify-between rounded-none border p-3 transition-colors hover:bg-muted/50"
                  key={enc.id}
                  params={{ encounterId: enc.id }}
                  to="/encounters/$encounterId"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center bg-muted">
                      <Stethoscope size={14} />
                    </div>
                    <div>
                      <p className="font-medium text-xs">
                        {enc.reasonForVisit}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        <Clock className="mr-1 inline" size={10} />
                        {new Date(enc.startedAt).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="text-muted-foreground" size={14} />
                </Link>
              ))
            ) : (
              <p className="py-4 text-center text-muted-foreground text-xs">
                No hay atenciones recientes.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pacientes recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {patientsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton className="h-10 w-full" key={i} />
              ))
            ) : patientsData && patientsData.patients.length > 0 ? (
              patientsData.patients.map((pat) => (
                <Link
                  className="flex items-center justify-between rounded-none border p-3 transition-colors hover:bg-muted/50"
                  key={pat.id}
                  params={{ patientId: pat.id }}
                  to="/patients/$patientId"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center bg-muted">
                      <Users size={14} />
                    </div>
                    <div>
                      <p className="font-medium text-xs">
                        {pat.firstName} {pat.lastName1}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {pat.primaryDocumentType} {pat.primaryDocumentNumber} ·{" "}
                        {new Date(pat.birthDate).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="text-muted-foreground" size={14} />
                </Link>
              ))
            ) : (
              <p className="py-4 text-center text-muted-foreground text-xs">
                No hay pacientes registrados.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {[
              { label: "Nuevo paciente", to: "/patients" },
              { label: "Nueva atención", to: "/encounters" },
              { label: "Catálogos RIPS", to: "/catalogs" },
              { label: "Administración de usuarios", to: "/admin/users" },
            ].map((item) => (
              <Link
                className="flex items-center justify-between rounded-none border p-2.5 text-xs transition-colors hover:bg-muted/50"
                key={item.to}
                to={item.to}
              >
                <span>{item.label}</span>
                <ChevronRight className="text-muted-foreground" size={12} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Estado del sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "API", status: "Operativa", ok: true },
                { label: "Base de datos", status: "Conectada", ok: true },
                { label: "Autenticación", status: "Activa", ok: true },
                { label: "RIPS", status: "Pendiente sync", ok: false },
              ].map((item) => (
                <div className="border p-3" key={item.label}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {item.label}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`size-2 ${item.ok ? "bg-emerald-500" : "bg-amber-500"}`}
                    />
                    <span className="font-medium text-xs">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
