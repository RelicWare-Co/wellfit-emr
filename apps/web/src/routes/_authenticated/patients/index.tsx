import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Eye, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/patients/")({
  component: PatientsListPage,
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

const createPatientSchema = z.object({
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

function CreatePatientForm({ onCancel }: { onCancel: () => void }) {
  const [countrySearch, setCountrySearch] = useState("");
  const [municipalitySearch, setMunicipalitySearch] = useState("");

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

  const createMutation = useMutation({
    ...orpc.patients.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Paciente creado correctamente");
      queryClient.invalidateQueries({
        queryKey: orpc.patients.list.key({ type: "query" }),
      });
      onCancel();
    },
    onError: (error) => {
      toast.error(error.message || "Error al crear paciente");
    },
  });

  const form = useForm({
    defaultValues: {
      primaryDocumentType: "",
      primaryDocumentNumber: "",
      firstName: "",
      middleName: "",
      lastName1: "",
      lastName2: "",
      birthDate: "",
      sexAtBirth: "",
      genderIdentity: "",
      countryCode: "",
      municipalityCode: "",
      zoneCode: "",
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
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
      onSubmit: createPatientSchema,
    },
  });

  const fieldGrid = "space-y-1";

  return (
    <Card className="mx-6">
      <CardHeader>
        <CardTitle>Nuevo paciente</CardTitle>
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
                  {isSubmitting ? "Guardando..." : "Guardar"}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PatientsListPage() {
  const navigate = useNavigate({ from: "/patients/" });
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery(
    orpc.patients.list.queryOptions({
      input: {
        limit,
        offset,
        search: search || undefined,
        sortBy: "createdAt",
        sortDirection: "desc",
      },
    })
  );

  const columns = [
    {
      header: "Nombre completo",
      accessor: (row: {
        firstName: string;
        middleName: string | null;
        lastName1: string;
        lastName2: string | null;
      }) => (
        <span>
          {row.firstName}
          {row.middleName ? ` ${row.middleName}` : ""} {row.lastName1}
          {row.lastName2 ? ` ${row.lastName2}` : ""}
        </span>
      ),
    },
    {
      header: "Documento",
      accessor: (row: {
        primaryDocumentType: string;
        primaryDocumentNumber: string;
      }) => `${row.primaryDocumentType} ${row.primaryDocumentNumber}`,
    },
    {
      header: "Fecha nacimiento",
      accessor: (row: { birthDate: Date }) =>
        new Date(row.birthDate).toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
    },
    {
      header: "Sexo",
      accessor: (row: { sexAtBirth: string }) => row.sexAtBirth,
    },
    {
      header: "Acciones",
      accessor: (row: { id: string }) => (
        <Button
          onClick={() =>
            navigate({
              to: "/patients/$patientId",
              params: { patientId: row.id },
            })
          }
          size="sm"
          variant="ghost"
        >
          <Eye size={14} />
        </Button>
      ),
      className: "w-16",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button onClick={() => setShowForm((s) => !s)} size="sm">
            <Plus size={14} />
            {showForm ? "Cancelar" : "Nuevo paciente"}
          </Button>
        }
        description="Gestión de pacientes del sistema"
        title="Pacientes"
      />

      {showForm && <CreatePatientForm onCancel={() => setShowForm(false)} />}

      <div className="px-6">
        <div className="mb-3 flex items-center gap-2">
          <Search className="text-muted-foreground" size={14} />
          <Input
            className="h-7 max-w-xs text-xs"
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            placeholder="Buscar por nombre o documento..."
            value={search}
          />
        </div>

        <DataTable
          columns={columns}
          data={data?.patients ?? []}
          emptyDescription="No se encontraron pacientes registrados."
          emptyTitle="No hay pacientes"
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          onRowClick={(row) =>
            navigate({
              to: "/patients/$patientId",
              params: { patientId: row.id },
            })
          }
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
      </div>
    </div>
  );
}
