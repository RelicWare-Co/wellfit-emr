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
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardPlus,
  Clock,
  HeartPulse,
  ShieldUser,
  Stethoscope,
  UserPlus,
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
  const { data: ripsStatus, isLoading: ripsStatusLoading } = useQuery(
    orpc.ripsReference.syncStatus.queryOptions()
  );

  const stats = [
    {
      label: "Pacientes registrados",
      value: patientsData?.total ?? 0,
      icon: Users,
      color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      loading: patientsLoading,
    },
    {
      label: "Atenciones del mes",
      value: encountersData?.total ?? 0,
      icon: CalendarDays,
      color:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      loading: encountersLoading,
    },
    {
      label: "Atenciones activas",
      value:
        encountersData?.encounters.filter((e) => e.status === "in-progress")
          .length ?? 0,
      icon: Activity,
      color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      loading: encountersLoading,
    },
    {
      label: "Profesionales activos",
      value: "—",
      icon: Stethoscope,
      color:
        "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
      loading: false,
    },
  ];

  let encountersContent: React.ReactNode;
  if (encountersLoading) {
    encountersContent = (
      <>
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </>
    );
  } else if (encountersData && encountersData.encounters.length > 0) {
    encountersContent = encountersData.encounters.map((enc) => (
      <Link
        className="group flex items-center justify-between rounded-none border p-3 transition-colors hover:bg-muted/60"
        key={enc.id}
        params={{ encounterId: enc.id }}
        to="/encounters/$encounterId"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center bg-muted">
            <HeartPulse size={15} />
          </div>
          <div>
            <p className="font-medium text-sm">{enc.reasonForVisit}</p>
            <p className="text-muted-foreground text-xs">
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
        <ChevronRight
          className="text-muted-foreground transition-colors group-hover:text-foreground"
          size={14}
        />
      </Link>
    ));
  } else {
    encountersContent = (
      <p className="py-6 text-center text-muted-foreground text-sm">
        No hay atenciones recientes.
      </p>
    );
  }

  let patientsContent: React.ReactNode;
  if (patientsLoading) {
    patientsContent = (
      <>
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </>
    );
  } else if (patientsData && patientsData.patients.length > 0) {
    patientsContent = patientsData.patients.map((pat) => (
      <Link
        className="group flex items-center justify-between rounded-none border p-3 transition-colors hover:bg-muted/60"
        key={pat.id}
        params={{ patientId: pat.id }}
        to="/patients/$patientId"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center bg-muted">
            <Users size={15} />
          </div>
          <div>
            <p className="font-medium text-sm">
              {pat.firstName} {pat.lastName1}
            </p>
            <p className="text-muted-foreground text-xs">
              {pat.primaryDocumentType} {pat.primaryDocumentNumber} ·{" "}
              {new Date(pat.birthDate).toLocaleDateString("es-CO")}
            </p>
          </div>
        </div>
        <ChevronRight
          className="text-muted-foreground transition-colors group-hover:text-foreground"
          size={14}
        />
      </Link>
    ));
  } else {
    patientsContent = (
      <p className="py-6 text-center text-muted-foreground text-sm">
        No hay pacientes registrados.
      </p>
    );
  }

  function getStatusDotClass(pending?: boolean, ok?: boolean): string {
    if (pending) {
      return "animate-pulse bg-slate-300";
    }
    if (ok) {
      return "bg-emerald-500";
    }
    return "bg-amber-500";
  }

  const quickAccess = [
    {
      label: "Nuevo paciente",
      to: "/patients",
      icon: UserPlus,
      description: "Registrar un paciente en el sistema",
    },
    {
      label: "Nueva atención",
      to: "/encounters",
      icon: ClipboardPlus,
      description: "Crear una atención clínica",
    },
    {
      label: "Catálogos RIPS",
      to: "/catalogs",
      icon: BookOpen,
      description: "Consultar tablas y códigos SISPRO",
    },
    {
      label: "Administración",
      to: "/admin/users",
      icon: ShieldUser,
      description: "Gestionar usuarios y permisos",
    },
  ];

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">
          Panel principal
        </h1>
        <p className="text-muted-foreground text-sm">
          Bienvenido, {session.data?.user.name}. Este es el resumen operativo de
          la institución.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} size="sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                {stat.label}
              </CardTitle>
              <div
                className={`flex size-8 items-center justify-center ${stat.color}`}
              >
                <stat.icon size={16} />
              </div>
            </CardHeader>
            <CardContent>
              {stat.loading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <div className="font-bold text-3xl tabular-nums tracking-tight">
                  {stat.value}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent encounters */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-semibold text-base">
                Atenciones recientes
              </CardTitle>
              <Link
                className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
                to="/encounters"
              >
                Ver todas
                <ArrowUpRight size={12} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">{encountersContent}</CardContent>
        </Card>

        {/* Recent patients */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-semibold text-base">
                Pacientes recientes
              </CardTitle>
              <Link
                className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
                to="/patients"
              >
                Ver todos
                <ArrowUpRight size={12} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">{patientsContent}</CardContent>
        </Card>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick access */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="font-semibold text-base">
              Accesos rápidos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickAccess.map((item) => (
              <Link
                className="group flex items-center gap-3 rounded-none border p-3 transition-colors hover:bg-muted/60"
                key={item.to}
                to={item.to}
              >
                <div className="flex size-9 shrink-0 items-center justify-center bg-slate-900 text-white">
                  <item.icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.description}
                  </p>
                </div>
                <ChevronRight
                  className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                  size={14}
                />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* System status */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="font-semibold text-base">
              Estado del sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "API", status: "Operativa", ok: true },
                { label: "Base de datos", status: "Conectada", ok: true },
                { label: "Autenticación", status: "Activa", ok: true },
                {
                  label: "RIPS",
                  status: ripsStatusLoading
                    ? "Cargando..."
                    : (ripsStatus?.message ?? "Desconocido"),
                  ok: ripsStatus?.status === "ok",
                  pending: ripsStatusLoading,
                },
              ].map((item) => (
                <div className="border p-4" key={item.label}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {item.label}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`size-2.5 ${getStatusDotClass(item.pending, item.ok)}`}
                    />
                    <span className="font-medium text-sm">{item.status}</span>
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
