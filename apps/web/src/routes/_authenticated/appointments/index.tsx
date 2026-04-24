import { useForm } from "@tanstack/react-form";
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
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Plus,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/appointments/")({
  component: AppointmentsPage,
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

const WEEK_DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function getMonthData(year: number, month: number) {
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDayOfWeek = firstDayOfMonth.getDay();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonthDays = Array.from({ length: startDayOfWeek }, (_, i) => ({
    date: new Date(year, month - 1, daysInPrevMonth - startDayOfWeek + i + 1),
    isCurrentMonth: false,
  }));

  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => ({
    date: new Date(year, month, i + 1),
    isCurrentMonth: true,
  }));

  const remainingCells =
    (7 - ((prevMonthDays.length + currentMonthDays.length) % 7)) % 7;
  const nextMonthDays = Array.from({ length: remainingCells }, (_, i) => ({
    date: new Date(year, month + 1, i + 1),
    isCurrentMonth: false,
  }));

  return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const statusConfig: Record<string, { color: string; label: string }> = {
  scheduled: { color: "bg-blue-500", label: "Programada" },
  confirmed: { color: "bg-emerald-500", label: "Confirmada" },
  cancelled: { color: "bg-slate-400", label: "Cancelada" },
  completed: { color: "bg-slate-700", label: "Completada" },
  "no-show": { color: "bg-amber-500", label: "No asistió" },
};

function AppointmentForm({
  initialDate,
  onCancel,
  onSuccess,
}: {
  initialDate?: Date;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const now = initialDate ?? new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:00`;

  const form = useForm({
    defaultValues: {
      durationMinutes: 30,
      notes: "",
      patientId: "",
      practitionerId: "",
      reason: "",
      scheduledAtDate: dateStr,
      scheduledAtTime: timeStr,
      serviceUnitId: "",
      siteId: "",
    },
    onSubmit: async ({ value }) => {
      const scheduledAt = new Date(
        `${value.scheduledAtDate}T${value.scheduledAtTime}:00`
      );

      await createMutation.mutateAsync({
        durationMinutes: value.durationMinutes,
        notes: value.notes || null,
        patientId: value.patientId,
        practitionerId: value.practitionerId || null,
        reason: value.reason,
        scheduledAt,
        serviceUnitId: value.serviceUnitId || null,
        siteId: value.siteId,
      });
    },
    validators: {
      onSubmit: z.object({
        durationMinutes: z.number().min(5).max(480),
        notes: z.string(),
        patientId: z.string().min(1, "Requerido"),
        practitionerId: z.string(),
        reason: z.string().min(1, "Requerido"),
        scheduledAtDate: z.string().min(1, "Requerido"),
        scheduledAtTime: z.string().min(1, "Requerido"),
        serviceUnitId: z.string(),
        siteId: z.string().min(1, "Requerido"),
      }),
    },
  });

  const createMutation = useMutation({
    ...orpc.appointments.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Cita creada correctamente");
      queryClient.invalidateQueries({
        queryKey: orpc.appointments.list.key({ type: "query" }),
      });
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Error al crear cita");
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form.Field name="patientId">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Paciente ID</Label>
              <Input
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="ID del paciente"
                value={field.state.value}
              />
              {field.state.meta.errors.map((error) => (
                <p className="text-destructive text-xs" key={String(error)}>
                  {String(error)}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="practitionerId">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Profesional ID (opcional)</Label>
              <Input
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="ID del profesional"
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="siteId">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Sede ID</Label>
              <Input
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="ID de la sede"
                value={field.state.value}
              />
              {field.state.meta.errors.map((error) => (
                <p className="text-destructive text-xs" key={String(error)}>
                  {String(error)}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="serviceUnitId">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>
                Unidad de servicio ID (opcional)
              </Label>
              <Input
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="ID de unidad"
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="scheduledAtDate">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Fecha</Label>
              <Input
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                type="date"
                value={field.state.value}
              />
              {field.state.meta.errors.map((error) => (
                <p className="text-destructive text-xs" key={String(error)}>
                  {String(error)}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="scheduledAtTime">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Hora</Label>
              <Input
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                type="time"
                value={field.state.value}
              />
              {field.state.meta.errors.map((error) => (
                <p className="text-destructive text-xs" key={String(error)}>
                  {String(error)}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="durationMinutes">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Duración (minutos)</Label>
              <Input
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) =>
                  field.handleChange(Number.parseInt(e.target.value, 10) || 30)
                }
                type="number"
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="reason">
          {(field) => (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={field.name}>Motivo de consulta</Label>
              <Input
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Motivo de la cita"
                value={field.state.value}
              />
              {field.state.meta.errors.map((error) => (
                <p className="text-destructive text-xs" key={String(error)}>
                  {String(error)}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="notes">
          {(field) => (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={field.name}>Notas (opcional)</Label>
              <Input
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Notas adicionales"
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onCancel} type="button" variant="outline">
          Cancelar
        </Button>
        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button disabled={!canSubmit || isSubmitting} type="submit">
              {isSubmitting ? "Guardando..." : "Guardar cita"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}

function AppointmentsPage() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowForm(false);
        setSelectedAppointmentId(null);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const fromDate = new Date(currentYear, currentMonth, 1);
  const toDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

  const { data, isLoading } = useQuery(
    orpc.appointments.list.queryOptions({
      input: {
        fromDate,
        limit: 500,
        offset: 0,
        sortBy: "scheduledAt",
        sortDirection: "asc",
        toDate,
      },
    })
  );

  const cancelMutation = useMutation({
    ...orpc.appointments.cancel.mutationOptions(),
    onSuccess: () => {
      toast.success("Cita cancelada");
      queryClient.invalidateQueries({
        queryKey: orpc.appointments.list.key({ type: "query" }),
      });
      setSelectedAppointmentId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Error al cancelar cita");
    },
  });

  const calendarDays = useMemo(
    () => getMonthData(currentYear, currentMonth),
    [currentMonth, currentYear]
  );

  const appointmentsByDay = useMemo(() => {
    const map = new Map<
      string,
      NonNullable<typeof data>["appointments"][number][]
    >();
    if (!data) {
      return map;
    }

    for (const appt of data.appointments) {
      const dateKey = new Date(appt.scheduledAt).toDateString();
      const existing = map.get(dateKey) ?? [];
      existing.push(appt);
      map.set(dateKey, existing);
    }
    return map;
  }, [data]);

  function goToPrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function goToToday() {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  }

  const selectedAppointment = useMemo(() => {
    if (!(selectedAppointmentId && data)) {
      return null;
    }
    return (
      data.appointments.find((a) => a.id === selectedAppointmentId) ?? null
    );
  }, [selectedAppointmentId, data]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Agenda</h1>
          <p className="text-muted-foreground text-sm">
            Gestión de citas médicas programadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={goToToday} size="sm" variant="outline">
            Hoy
          </Button>
          <Button
            onClick={() => {
              setSelectedDate(new Date());
              setShowForm(true);
            }}
            size="sm"
          >
            <Plus size={14} />
            Nueva cita
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button onClick={goToPrevMonth} size="icon" variant="ghost">
                <ChevronLeft size={16} />
              </Button>
              <h2 className="min-w-40 text-center font-semibold text-lg">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </h2>
              <Button onClick={goToNextMonth} size="icon" variant="ghost">
                <ChevronRight size={16} />
              </Button>
            </div>
            <div className="hidden items-center gap-3 text-xs sm:flex">
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <div className="flex items-center gap-1.5" key={key}>
                  <Circle className={cfg.color} fill="currentColor" size={8} />
                  <span>{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7">
            {WEEK_DAYS.map((day) => (
              <div
                className="border-r border-b py-2 text-center font-medium text-muted-foreground text-xs uppercase tracking-wider last:border-r-0"
                key={day}
              >
                {day}
              </div>
            ))}
            {isLoading
              ? Array.from({ length: 35 }).map((_, i) => (
                  <div
                    className="min-h-28 border-r border-b p-1.5 last:border-r-0"
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
                    key={`sk-${i}`}
                  >
                    <div className="mb-2 h-4 w-6 bg-muted" />
                    <div className="space-y-1">
                      <div className="h-4 w-full bg-muted" />
                      <div className="h-4 w-3/4 bg-muted" />
                    </div>
                  </div>
                ))
              : calendarDays.map(({ date, isCurrentMonth }) => {
                  const isToday = isSameDay(date, today);
                  const dateKey = date.toDateString();
                  const dayAppointments = appointmentsByDay.get(dateKey) ?? [];

                  function getDayNumberClass() {
                    if (isToday) {
                      return "inline-flex size-6 items-center justify-center bg-slate-900 font-bold text-white";
                    }
                    if (isCurrentMonth) {
                      return "font-medium text-foreground";
                    }
                    return "text-muted-foreground";
                  }

                  return (
                    <button
                      className={`min-h-28 cursor-pointer border-r border-b p-1.5 text-left transition-colors last:border-r-0 ${
                        isCurrentMonth ? "bg-background" : "bg-muted/30"
                      } ${isToday ? "bg-blue-50/50 dark:bg-blue-950/20" : ""} hover:bg-muted/40`}
                      key={dateKey}
                      onClick={() => {
                        setSelectedDate(date);
                        setShowForm(true);
                      }}
                      type="button"
                    >
                      <div
                        className={`mb-1 text-right text-xs ${getDayNumberClass()}`}
                      >
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayAppointments.slice(0, 3).map((appt) => {
                          const cfg = statusConfig[appt.status] ?? {
                            color: "bg-slate-500",
                            label: appt.status,
                          };
                          return (
                            <button
                              className={`flex w-full items-center gap-1.5 rounded-none px-1.5 py-0.5 text-left text-[10px] transition-opacity hover:opacity-80 ${
                                appt.status === "cancelled"
                                  ? "bg-muted line-through opacity-60"
                                  : "bg-slate-100 dark:bg-slate-800"
                              }`}
                              key={appt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAppointmentId(appt.id);
                              }}
                              type="button"
                            >
                              <span
                                className={`size-1.5 shrink-0 ${cfg.color}`}
                              />
                              <span className="truncate">
                                {formatTime(new Date(appt.scheduledAt))}{" "}
                                {appt.reason}
                              </span>
                            </button>
                          );
                        })}
                        {dayAppointments.length > 3 && (
                          <p className="px-1.5 text-[10px] text-muted-foreground">
                            +{dayAppointments.length - 3} más
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
          </div>
        </CardContent>
      </Card>

      {/* Create Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
        >
          <Card className="mx-4 max-h-[90vh] w-full max-w-lg overflow-auto">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle>Nueva cita</CardTitle>
              <Button
                onClick={() => setShowForm(false)}
                size="icon"
                variant="ghost"
              >
                <X size={16} />
              </Button>
            </CardHeader>
            <CardContent>
              <AppointmentForm
                initialDate={selectedDate}
                onCancel={() => setShowForm(false)}
                onSuccess={() => setShowForm(false)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detail Modal */}
      {selectedAppointment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
        >
          <Card className="mx-4 w-full max-w-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle>Detalle de cita</CardTitle>
              <Button
                onClick={() => setSelectedAppointmentId(null)}
                size="icon"
                variant="ghost"
              >
                <X size={16} />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="text-muted-foreground" size={14} />
                  <span>
                    {new Date(
                      selectedAppointment.scheduledAt
                    ).toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                    , {formatTime(new Date(selectedAppointment.scheduledAt))} (
                    {selectedAppointment.durationMinutes} min)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="text-muted-foreground" size={14} />
                  <span>Paciente: {selectedAppointment.patientId}</span>
                </div>
                {selectedAppointment.practitionerId && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="text-muted-foreground" size={14} />
                    <span>
                      Profesional: {selectedAppointment.practitionerId}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`size-2.5 ${
                      statusConfig[selectedAppointment.status]?.color ??
                      "bg-slate-500"
                    }`}
                  />
                  <span>
                    Estado:{" "}
                    {statusConfig[selectedAppointment.status]?.label ??
                      selectedAppointment.status}
                  </span>
                </div>
                <div className="border p-3 text-sm">
                  <p className="font-medium text-xs">Motivo</p>
                  <p className="mt-1">{selectedAppointment.reason}</p>
                </div>
                {selectedAppointment.notes && (
                  <div className="border p-3 text-sm">
                    <p className="font-medium text-xs">Notas</p>
                    <p className="mt-1 text-muted-foreground">
                      {selectedAppointment.notes}
                    </p>
                  </div>
                )}
                {selectedAppointment.cancelledReason && (
                  <div className="border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950">
                    <p className="font-medium text-red-700 text-xs dark:text-red-300">
                      Motivo de cancelación
                    </p>
                    <p className="mt-1 text-red-600 dark:text-red-300">
                      {selectedAppointment.cancelledReason}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={() => setSelectedAppointmentId(null)}
                  size="sm"
                  variant="outline"
                >
                  Cerrar
                </Button>
                {selectedAppointment.status !== "cancelled" &&
                  selectedAppointment.status !== "completed" && (
                    <Button
                      disabled={cancelMutation.isPending}
                      onClick={() =>
                        cancelMutation.mutate({
                          cancelledReason: "Cancelada por el usuario",
                          id: selectedAppointment.id,
                        })
                      }
                      size="sm"
                      variant="destructive"
                    >
                      {cancelMutation.isPending
                        ? "Cancelando..."
                        : "Cancelar cita"}
                    </Button>
                  )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
