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
import { SearchSelect } from "@wellfit-emr/ui/components/search-select";
import { Skeleton } from "@wellfit-emr/ui/components/skeleton";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/patients/$patientId")({
  component: PatientDetailPage,
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

const updatePatientSchema = z.object({
  primaryDocumentType: z.string().min(1, "Requerido"),
  primaryDocumentNumber: z.string().min(1, "Requerido"),
  firstName: z.string().min(1, "Requerido"),
  middleName: z.string(),
  lastName1: z.string().min(1, "Requerido"),
  lastName2: z.string(),
  birthDate: z.string().min(1, "Requerido"),
  sexAtBirth: z.string().min(1, "Requerido"),
  genderIdentity: z.string(),
  countryCode: z.string(),
  municipalityCode: z.string(),
  zoneCode: z.string(),
});

type Patient = {
  id: string;
  primaryDocumentType: string;
  primaryDocumentNumber: string;
  firstName: string;
  middleName: string | null;
  lastName1: string;
  lastName2: string | null;
  birthDate: Date;
  sexAtBirth: string;
  genderIdentity: string | null;
  countryCode: string | null;
  municipalityCode: string | null;
  zoneCode: string | null;
  deceasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function EditPatientForm({
  patient,
  onCancel,
}: {
  patient: Patient;
  onCancel: () => void;
}) {
  const [countrySearch, setCountrySearch] = useState(patient.countryCode ?? "");
  const [municipalitySearch, setMunicipalitySearch] = useState(
    patient.municipalityCode ?? ""
  );

  const { data: countriesData, isLoading: countriesLoading } = useQuery(
    orpc.ripsReference.listEntries.queryOptions({
      input: {
        tableName: "Pais",
        limit: 20,
        search: countrySearch || undefined,
      },
    })
  );

  const { data: municipalitiesData, isLoading: municipalitiesLoading } =
    useQuery(
      orpc.ripsReference.listEntries.queryOptions({
        input: {
          tableName: "Municipio",
          limit: 20,
          search: municipalitySearch || undefined,
        },
      })
    );

  const updateMutation = useMutation({
    ...orpc.patients.update.mutationOptions(),
    onSuccess: () => {
      toast.success("Paciente actualizado correctamente");
      queryClient.invalidateQueries({
        queryKey: orpc.patients.get.key({ type: "query" }),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.patients.list.key({ type: "query" }),
      });
      onCancel();
    },
    onError: (error) => {
      toast.error(error.message || "Error al actualizar paciente");
    },
  });

  const form = useForm({
    defaultValues: {
      primaryDocumentType: patient.primaryDocumentType,
      primaryDocumentNumber: patient.primaryDocumentNumber,
      firstName: patient.firstName,
      middleName: patient.middleName ?? "",
      lastName1: patient.lastName1,
      lastName2: patient.lastName2 ?? "",
      birthDate: new Date(patient.birthDate).toISOString().split("T")[0],
      sexAtBirth: patient.sexAtBirth,
      genderIdentity: patient.genderIdentity ?? "",
      countryCode: patient.countryCode ?? "",
      municipalityCode: patient.municipalityCode ?? "",
      zoneCode: patient.zoneCode ?? "",
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync({
        id: patient.id,
        primaryDocumentType: value.primaryDocumentType,
        primaryDocumentNumber: value.primaryDocumentNumber,
        firstName: value.firstName,
        middleName: value.middleName || null,
        lastName1: value.lastName1,
        lastName2: value.lastName2 || null,
        birthDate: new Date(value.birthDate),
        sexAtBirth: value.sexAtBirth,
        genderIdentity: value.genderIdentity || null,
        countryCode: value.countryCode || null,
        municipalityCode: value.municipalityCode || null,
        zoneCode: value.zoneCode || null,
      });
    },
    validators: {
      onSubmit: updatePatientSchema,
    },
  });

  const fieldGrid = "space-y-1";

  return (
    <Card className="mx-6" size="sm">
      <CardHeader>
        <CardTitle>Editar paciente</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <form.Field name="primaryDocumentType">
              {(field) => (
                <div className={fieldGrid}>
                  <Label htmlFor={field.name}>Tipo de documento</Label>
                  <select
                    className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  >
                    <option value="">Seleccione...</option>
                    <option value="CC">Cédula de ciudadanía</option>
                    <option value="CE">Cédula de extranjería</option>
                    <option value="PA">Pasaporte</option>
                    <option value="RC">Registro civil</option>
                    <option value="TI">Tarjeta de identidad</option>
                    <option value="PEP">Permiso especial de permanencia</option>
                    <option value="PPT">Permiso por protección temporal</option>
                    <option value="NIT">NIT</option>
                  </select>
                  {field.state.meta.errors.map((error) => (
                    <p
                      className="text-destructive text-xs"
                      key={error?.message}
                    >
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="primaryDocumentNumber">
              {(field) => (
                <div className={fieldGrid}>
                  <Label htmlFor={field.name}>Número de documento</Label>
                  <Input
                    className="text-xs"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p
                      className="text-destructive text-xs"
                      key={error?.message}
                    >
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="firstName">
              {(field) => (
                <div className={fieldGrid}>
                  <Label htmlFor={field.name}>Primer nombre</Label>
                  <Input
                    className="text-xs"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p
                      className="text-destructive text-xs"
                      key={error?.message}
                    >
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="middleName">
              {(field) => (
                <div className={fieldGrid}>
                  <Label htmlFor={field.name}>Segundo nombre</Label>
                  <Input
                    className="text-xs"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="lastName1">
              {(field) => (
                <div className={fieldGrid}>
                  <Label htmlFor={field.name}>Primer apellido</Label>
                  <Input
                    className="text-xs"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p
                      className="text-destructive text-xs"
                      key={error?.message}
                    >
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="lastName2">
              {(field) => (
                <div className={fieldGrid}>
                  <Label htmlFor={field.name}>Segundo apellido</Label>
                  <Input
                    className="text-xs"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="birthDate">
              {(field) => (
                <div className={fieldGrid}>
                  <Label htmlFor={field.name}>Fecha de nacimiento</Label>
                  <Input
                    className="text-xs"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="date"
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p
                      className="text-destructive text-xs"
                      key={error?.message}
                    >
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="sexAtBirth">
              {(field) => (
                <div className={fieldGrid}>
                  <Label htmlFor={field.name}>Sexo al nacer</Label>
                  <select
                    className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  >
                    <option value="">Seleccione...</option>
                    <option value="H">Hombre</option>
                    <option value="M">Mujer</option>
                    <option value="I">Indeterminado</option>
                  </select>
                  {field.state.meta.errors.map((error) => (
                    <p
                      className="text-destructive text-xs"
                      key={error?.message}
                    >
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="genderIdentity">
              {(field) => (
                <div className={fieldGrid}>
                  <Label htmlFor={field.name}>Identidad de género</Label>
                  <select
                    className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  >
                    <option value="">Seleccione...</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="transgenero">Transgénero</option>
                    <option value="no_binario">No binario</option>
                    <option value="otro">Otro</option>
                    <option value="prefiero_no_decir">Prefiero no decir</option>
                  </select>
                </div>
              )}
            </form.Field>

            <form.Field name="countryCode">
              {(field) => (
                <div className={fieldGrid}>
                  <Label htmlFor={field.name}>País</Label>
                  <SearchSelect
                    clearable
                    emptyMessage="Escribe para buscar"
                    id={field.name}
                    loading={countriesLoading}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(v) => field.handleChange(v)}
                    onSearchChange={setCountrySearch}
                    options={
                      countriesData?.entries.map((e) => ({
                        value: e.code,
                        label: e.name,
                        description: e.code,
                      })) ?? []
                    }
                    placeholder="Buscar país..."
                    search={countrySearch}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="municipalityCode">
              {(field) => (
                <div className={fieldGrid}>
                  <Label htmlFor={field.name}>Municipio</Label>
                  <SearchSelect
                    clearable
                    emptyMessage="Escribe para buscar"
                    id={field.name}
                    loading={municipalitiesLoading}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(v) => field.handleChange(v)}
                    onSearchChange={setMunicipalitySearch}
                    options={
                      municipalitiesData?.entries.map((e) => ({
                        value: e.code,
                        label: e.name,
                        description: e.code,
                      })) ?? []
                    }
                    placeholder="Buscar municipio..."
                    search={municipalitySearch}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="zoneCode">
              {(field) => (
                <div className={fieldGrid}>
                  <Label htmlFor={field.name}>Zona</Label>
                  <select
                    className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  >
                    <option value="">Seleccione...</option>
                    <option value="01">Rural</option>
                    <option value="02">Urbano</option>
                  </select>
                </div>
              )}
            </form.Field>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              onClick={onCancel}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  disabled={!canSubmit || isSubmitting}
                  size="sm"
                  type="submit"
                >
                  {isSubmitting ? "Guardando..." : "Guardar cambios"}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PatientInfoCard({
  patient,
  onEdit,
}: {
  patient: Patient;
  onEdit: () => void;
}) {
  const infoRows = [
    { label: "Tipo de documento", value: patient.primaryDocumentType },
    { label: "Número de documento", value: patient.primaryDocumentNumber },
    {
      label: "Nombres",
      value: `${patient.firstName} ${patient.middleName ?? ""}`.trim(),
    },
    {
      label: "Apellidos",
      value: `${patient.lastName1} ${patient.lastName2 ?? ""}`.trim(),
    },
    {
      label: "Fecha de nacimiento",
      value: new Date(patient.birthDate).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    },
    { label: "Sexo al nacer", value: patient.sexAtBirth },
    { label: "Identidad de género", value: patient.genderIdentity ?? "—" },
    { label: "País", value: patient.countryCode ?? "—" },
    { label: "Municipio", value: patient.municipalityCode ?? "—" },
    { label: "Zona", value: patient.zoneCode ?? "—" },
  ];

  return (
    <Card className="mx-6" size="sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Información personal</CardTitle>
        <Button onClick={onEdit} size="sm" variant="outline">
          <Pencil size={14} />
          Editar
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {infoRows.map((row) => (
            <div key={row.label}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {row.label}
              </p>
              <p className="mt-0.5 font-medium text-xs">{row.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EncountersSection({ patientId }: { patientId: string }) {
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);

  const { data, isLoading } = useQuery(
    orpc.encounters.list.queryOptions({
      input: {
        limit,
        offset,
        patientId,
        sortBy: "startedAt",
        sortDirection: "desc",
      },
    })
  );

  const columns = [
    {
      header: "Motivo de consulta",
      accessor: (row: { reasonForVisit: string }) => (
        <span className="font-medium">{row.reasonForVisit}</span>
      ),
    },
    {
      header: "Fecha de inicio",
      accessor: (row: { startedAt: Date }) =>
        new Date(row.startedAt).toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      header: "Estado",
      accessor: (row: { status: string }) => (
        <span
          className={
            row.status === "in-progress"
              ? "text-emerald-600"
              : row.status === "finished"
                ? "text-muted-foreground"
                : ""
          }
        >
          {row.status === "in-progress"
            ? "En progreso"
            : row.status === "finished"
              ? "Finalizada"
              : row.status}
        </span>
      ),
    },
    {
      header: "Modalidad",
      accessor: (row: { careModality: string }) => row.careModality,
    },
  ];

  return (
    <Card className="mx-6" size="sm">
      <CardHeader>
        <CardTitle>Historial de atenciones</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={data?.encounters ?? []}
          emptyDescription="Este paciente no tiene atenciones registradas."
          emptyTitle="Sin atenciones"
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          pagination={
            data
              ? {
                  limit,
                  offset,
                  total: data.total,
                  onPageChange: setOffset,
                }
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
}

function PatientDetailPage() {
  const { patientId } = Route.useParams();
  const [editing, setEditing] = useState(false);

  const { data: patient, isLoading: patientLoading } = useQuery(
    orpc.patients.get.queryOptions({ input: { id: patientId } })
  );

  const fullName = patient
    ? `${patient.firstName} ${patient.lastName1}`
    : "Paciente";

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        actions={
          !editing && patient ? (
            <Button
              onClick={() => setEditing(true)}
              size="sm"
              variant="outline"
            >
              <Pencil size={14} />
              Editar
            </Button>
          ) : undefined
        }
        backTo="/patients"
        description="Información clínica y atenciones del paciente"
        title={fullName}
      />

      {patientLoading ? (
        <div className="mx-6 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : patient ? (
        <>
          {editing ? (
            <EditPatientForm
              onCancel={() => setEditing(false)}
              patient={patient}
            />
          ) : (
            <PatientInfoCard
              onEdit={() => setEditing(true)}
              patient={patient}
            />
          )}
          <EncountersSection patientId={patientId} />
        </>
      ) : (
        <EmptyState
          description="No se encontró el paciente solicitado."
          title="Paciente no encontrado"
        />
      )}
    </div>
  );
}
