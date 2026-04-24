import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
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
import {
  Activity,
  AlertTriangle,
  Eye,
  Plus,
  Scissors,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/encounters/$encounterId")(
  {
    component: EncounterDetailPage,
  }
);

const TABS = [
  { id: "diagnoses", label: "Diagnósticos", icon: Activity },
  { id: "allergies", label: "Alergias", icon: AlertTriangle },
  { id: "observations", label: "Observaciones", icon: Eye },
  { id: "procedures", label: "Procedimientos", icon: Scissors },
];

function EncounterDetailPage() {
  const { encounterId } = useParams({
    from: "/_authenticated/encounters/$encounterId",
  });
  const [activeTab, setActiveTab] = useState("diagnoses");

  const { data: encounter, isLoading: encounterLoading } = useQuery(
    orpc.encounters.get.queryOptions({ input: { id: encounterId } })
  );

  const { data: patient } = useQuery({
    ...orpc.patients.get.queryOptions({
      input: { id: encounter?.patientId ?? "" },
    }),
    enabled: !!encounter?.patientId,
  });

  const closeMutation = useMutation({
    ...orpc.encounters.close.mutationOptions(),
    onSuccess: () => {
      toast.success("Atención cerrada correctamente");
    },
    onError: (error: Error) => {
      toast.error(`Error al cerrar: ${error.message}`);
    },
  });

  function handleClose() {
    closeMutation.mutate({
      id: encounterId,
      endedAt: new Date(),
      status: "finished",
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          encounter?.status === "in-progress" ? (
            <Button
              disabled={closeMutation.isPending}
              onClick={handleClose}
              size="sm"
              variant="destructive"
            >
              <XCircle size={14} />
              {closeMutation.isPending ? "Cerrando..." : "Cerrar atención"}
            </Button>
          ) : null
        }
        backTo="/encounters"
        description={
          encounterLoading
            ? "..."
            : `Estado: ${
                encounter?.status === "in-progress"
                  ? "En progreso"
                  : (encounter?.status ?? "—")
              }`
        }
        title={
          encounterLoading
            ? "Cargando..."
            : (encounter?.reasonForVisit ?? "Atención")
        }
      />

      <div className="grid grid-cols-1 gap-4 px-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Información general</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-xs">
            {encounterLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton className="h-4 w-full" key={i} />
              ))
            ) : encounter ? (
              [
                {
                  label: "Clase de atención",
                  value: encounter.encounterClass,
                },
                {
                  label: "Modalidad",
                  value: encounter.careModality,
                },
                {
                  label: "Fecha inicio",
                  value: new Date(encounter.startedAt).toLocaleString("es-CO"),
                },
                {
                  label: "Estado",
                  value:
                    encounter.status === "in-progress"
                      ? "En progreso"
                      : encounter.status,
                },
                { label: "Sede ID", value: encounter.siteId },
                {
                  label: "Unidad de servicio",
                  value: encounter.serviceUnitId,
                },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[10px] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="font-medium">{item.value}</p>
                </div>
              ))
            ) : (
              <p className="col-span-2 text-muted-foreground">
                No se encontró la atención
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {patient ? (
              <>
                <div>
                  <p className="text-[10px] text-muted-foreground">Nombre</p>
                  <p className="font-medium">
                    {patient.firstName} {patient.lastName1}{" "}
                    {patient.lastName2 ?? ""}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Documento</p>
                  <p className="font-medium">
                    {patient.primaryDocumentType}{" "}
                    {patient.primaryDocumentNumber}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    Fecha nacimiento
                  </p>
                  <p className="font-medium">
                    {new Date(patient.birthDate).toLocaleDateString("es-CO")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Sexo</p>
                  <p className="font-medium">{patient.sexAtBirth}</p>
                </div>
                <Link
                  className="inline-block pt-2 text-[10px] text-primary hover:underline"
                  params={{ patientId: patient.id }}
                  to="/patients/$patientId"
                >
                  Ver historia clínica completa →
                </Link>
              </>
            ) : (
              <>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="px-6">
        <div className="mb-3 flex items-center gap-1 border-b">
          {TABS.map((tab) => (
            <button
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 font-medium text-xs transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "diagnoses" && (
          <DiagnosesTab encounterId={encounterId} />
        )}
        {activeTab === "allergies" && (
          <AllergiesTab patientId={encounter?.patientId ?? ""} />
        )}
        {activeTab === "observations" && (
          <ObservationsTab
            encounterId={encounterId}
            patientId={encounter?.patientId ?? ""}
          />
        )}
        {activeTab === "procedures" && (
          <ProceduresTab
            encounterId={encounterId}
            patientId={encounter?.patientId ?? ""}
          />
        )}
      </div>
    </div>
  );
}

function DiagnosesTab({ encounterId }: { encounterId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [diagnosisSearch, setDiagnosisSearch] = useState("");
  const [diagnosisTypeSearch, setDiagnosisTypeSearch] = useState("");
  const [form, setForm] = useState({
    codeSystem: "CIE10",
    code: "",
    description: "",
    diagnosisType: "",
    rank: "",
    certainty: "",
  });

  const { data, isLoading, refetch } = useQuery(
    orpc.clinicalRecords.listDiagnoses.queryOptions({ input: { encounterId } })
  );

  const { data: diagnosesData, isLoading: diagnosesLoading } = useQuery(
    orpc.ripsReference.listEntries.queryOptions({
      input: {
        tableName: "CIE10",
        limit: 20,
        search: diagnosisSearch || undefined,
      },
    })
  );

  const { data: diagnosisTypesData, isLoading: diagnosisTypesLoading } =
    useQuery(
      orpc.ripsReference.listEntries.queryOptions({
        input: {
          tableName: "RIPSTipoDiagnosticoPrincipalVersion2",
          limit: 20,
          search: diagnosisTypeSearch || undefined,
        },
      })
    );

  const create = useMutation({
    ...orpc.clinicalRecords.createDiagnosis.mutationOptions(),
    onSuccess: () => {
      toast.success("Diagnóstico agregado");
      setShowForm(false);
      setForm({
        codeSystem: "CIE10",
        code: "",
        description: "",
        diagnosisType: "",
        rank: "",
        certainty: "",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      encounterId,
      codeSystem: form.codeSystem,
      code: form.code,
      description: form.description,
      diagnosisType: form.diagnosisType,
      rank: form.rank ? Number(form.rank) : null,
      certainty: form.certainty || null,
      documentVersionId: null,
      onsetAt: null,
    });
  }

  const columns = [
    {
      header: "Código",
      accessor: (row: NonNullable<typeof data>[0]) => (
        <span className="font-medium">
          {row.codeSystem} {row.code}
        </span>
      ),
    },
    {
      header: "Descripción",
      accessor: (row: NonNullable<typeof data>[0]) => row.description,
    },
    {
      header: "Tipo",
      accessor: (row: NonNullable<typeof data>[0]) => row.diagnosisType,
    },
    {
      header: "Rango",
      accessor: (row: NonNullable<typeof data>[0]) => row.rank ?? "—",
    },
    {
      header: "Certeza",
      accessor: (row: NonNullable<typeof data>[0]) => row.certainty ?? "—",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Cancelar" : "Agregar diagnóstico"}
        </Button>
      </div>

      {showForm && (
        <form
          className="grid grid-cols-1 gap-3 border p-4 md:grid-cols-3"
          onSubmit={handleSubmit}
        >
          <div className="space-y-1">
            <Label>Sistema de codificación</Label>
            <select
              className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              onChange={(e) => setForm({ ...form, codeSystem: e.target.value })}
              required
              value={form.codeSystem}
            >
              <option value="CIE10">CIE10</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Diagnóstico CIE10</Label>
            <SearchSelect
              emptyMessage="Escribe para buscar en CIE10"
              loading={diagnosesLoading}
              onChange={(v) => {
                const selected = diagnosesData?.entries.find(
                  (entry) => entry.code === v
                );
                setForm((f) => ({
                  ...f,
                  code: v,
                  description: selected?.name ?? f.description,
                }));
              }}
              onSearchChange={setDiagnosisSearch}
              options={
                diagnosesData?.entries.map((e) => ({
                  value: e.code,
                  label: e.name,
                  description: e.code,
                })) ?? []
              }
              placeholder="Buscar diagnóstico..."
              required
              search={diagnosisSearch}
              value={form.code}
            />
          </div>
          <div className="space-y-1">
            <Label>Tipo de diagnóstico</Label>
            <SearchSelect
              emptyMessage="Escribe para buscar tipo"
              loading={diagnosisTypesLoading}
              onChange={(v) => setForm((f) => ({ ...f, diagnosisType: v }))}
              onSearchChange={setDiagnosisTypeSearch}
              options={
                diagnosisTypesData?.entries.map((e) => ({
                  value: e.code,
                  label: e.name,
                  description: e.code,
                })) ?? []
              }
              placeholder="Buscar tipo..."
              required
              search={diagnosisTypeSearch}
              value={form.diagnosisType}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Descripción</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              required
              value={form.description}
            />
          </div>
          <div className="space-y-1">
            <Label>Rango (rank)</Label>
            <Input
              onChange={(e) => setForm({ ...form, rank: e.target.value })}
              type="number"
              value={form.rank}
            />
          </div>
          <div className="space-y-1">
            <Label>Certeza</Label>
            <Input
              onChange={(e) => setForm({ ...form, certainty: e.target.value })}
              placeholder="Ej: confirmed"
              value={form.certainty}
            />
          </div>
          <div className="flex items-end md:col-span-3">
            <Button disabled={create.isPending} size="sm" type="submit">
              {create.isPending ? "Guardando..." : "Guardar diagnóstico"}
            </Button>
          </div>
        </form>
      )}

      <DataTable
        columns={columns}
        data={data ?? []}
        emptyDescription="No hay diagnósticos registrados para esta atención."
        emptyTitle="Sin diagnósticos"
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
      />
    </div>
  );
}

function AllergiesTab({ patientId }: { patientId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [practitionerSearch, setPractitionerSearch] = useState("");
  const [form, setForm] = useState({
    substanceCode: "",
    codeSystem: "",
    criticality: "",
    reactionText: "",
    status: "active",
    recordedBy: "",
  });

  const { data, isLoading, refetch } = useQuery({
    ...orpc.clinicalRecords.listAllergies.queryOptions({
      input: { patientId },
    }),
    enabled: !!patientId,
  });

  const { data: practitionersData, isLoading: practitionersLoading } = useQuery(
    orpc.facilities.listPractitioners.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: practitionerSearch || undefined,
      },
    })
  );

  const create = useMutation({
    ...orpc.clinicalRecords.createAllergy.mutationOptions(),
    onSuccess: () => {
      toast.success("Alergia registrada");
      setShowForm(false);
      setForm({
        substanceCode: "",
        codeSystem: "",
        criticality: "",
        reactionText: "",
        status: "active",
        recordedBy: "",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      patientId,
      substanceCode: form.substanceCode,
      codeSystem: form.codeSystem,
      criticality: form.criticality || null,
      reactionText: form.reactionText || null,
      status: form.status,
      recordedBy: form.recordedBy,
      recordedAt: new Date(),
    });
  }

  const columns = [
    {
      header: "Sustancia",
      accessor: (row: NonNullable<typeof data>[0]) => row.substanceCode,
    },
    {
      header: "Sistema",
      accessor: (row: NonNullable<typeof data>[0]) => row.codeSystem,
    },
    {
      header: "Crítica",
      accessor: (row: NonNullable<typeof data>[0]) => row.criticality ?? "—",
    },
    {
      header: "Reacción",
      accessor: (row: NonNullable<typeof data>[0]) => row.reactionText ?? "—",
    },
    {
      header: "Estado",
      accessor: (row: NonNullable<typeof data>[0]) => row.status,
    },
    {
      header: "Registrado por",
      accessor: (row: NonNullable<typeof data>[0]) => row.recordedBy,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Cancelar" : "Agregar alergia"}
        </Button>
      </div>

      {showForm && (
        <form
          className="grid grid-cols-1 gap-3 border p-4 md:grid-cols-3"
          onSubmit={handleSubmit}
        >
          <div className="space-y-1">
            <Label>Código de sustancia</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, substanceCode: e.target.value })
              }
              required
              value={form.substanceCode}
            />
          </div>
          <div className="space-y-1">
            <Label>Sistema de codificación</Label>
            <Input
              onChange={(e) => setForm({ ...form, codeSystem: e.target.value })}
              required
              value={form.codeSystem}
            />
          </div>
          <div className="space-y-1">
            <Label>Criticidad</Label>
            <select
              className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              onChange={(e) =>
                setForm({ ...form, criticality: e.target.value })
              }
              value={form.criticality}
            >
              <option value="">Seleccione...</option>
              <option value="low">Baja</option>
              <option value="high">Alta</option>
              <option value="unable-to-assess">No evaluable</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Texto de reacción</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, reactionText: e.target.value })
              }
              placeholder="Describa la reacción"
              value={form.reactionText}
            />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <select
              className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              required
              value={form.status}
            >
              <option value="active">Activa</option>
              <option value="inactive">Inactiva</option>
              <option value="resolved">Resuelta</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Registrado por</Label>
            <SearchSelect
              emptyMessage="Escribe para buscar profesionales"
              loading={practitionersLoading}
              onChange={(v) => setForm((f) => ({ ...f, recordedBy: v }))}
              onSearchChange={setPractitionerSearch}
              options={
                practitionersData?.practitioners.map((p) => ({
                  value: p.id,
                  label: p.fullName,
                  description: p.documentNumber,
                })) ?? []
              }
              placeholder="Buscar profesional..."
              required
              search={practitionerSearch}
              value={form.recordedBy}
            />
          </div>
          <div className="flex items-end">
            <Button disabled={create.isPending} size="sm" type="submit">
              {create.isPending ? "Guardando..." : "Guardar alergia"}
            </Button>
          </div>
        </form>
      )}

      <DataTable
        columns={columns}
        data={data ?? []}
        emptyDescription="No hay alergias registradas para este paciente."
        emptyTitle="Sin alergias"
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
      />
    </div>
  );
}

function ObservationsTab({
  encounterId,
  patientId,
}: {
  encounterId: string;
  patientId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    observationType: "",
    code: "",
    codeSystem: "",
    valueText: "",
    valueNum: "",
    valueUnit: "",
    observedAt: new Date().toISOString().slice(0, 16),
    status: "preliminary",
  });

  const { data, isLoading, refetch } = useQuery({
    ...orpc.clinicalRecords.listObservations.queryOptions({
      input: { encounterId },
    }),
    enabled: !!encounterId,
  });

  const create = useMutation({
    ...orpc.clinicalRecords.createObservation.mutationOptions(),
    onSuccess: () => {
      toast.success("Observación registrada");
      setShowForm(false);
      setForm({
        observationType: "",
        code: "",
        codeSystem: "",
        valueText: "",
        valueNum: "",
        valueUnit: "",
        observedAt: new Date().toISOString().slice(0, 16),
        status: "preliminary",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      encounterId,
      patientId,
      observationType: form.observationType,
      code: form.code || null,
      codeSystem: form.codeSystem || null,
      valueText: form.valueText || null,
      valueNum: form.valueNum ? Number(form.valueNum) : null,
      valueUnit: form.valueUnit || null,
      observedAt: new Date(form.observedAt),
      status: form.status,
      documentVersionId: null,
    });
  }

  const columns = [
    {
      header: "Tipo",
      accessor: (row: NonNullable<typeof data>[0]) => row.observationType,
    },
    {
      header: "Código",
      accessor: (row: NonNullable<typeof data>[0]) =>
        row.code ? `${row.codeSystem} ${row.code}` : "—",
    },
    {
      header: "Valor",
      accessor: (row: NonNullable<typeof data>[0]) => {
        if (row.valueNum != null) {
          return `${row.valueNum} ${row.valueUnit ?? ""}`;
        }
        return row.valueText ?? "—";
      },
    },
    {
      header: "Fecha observación",
      accessor: (row: NonNullable<typeof data>[0]) =>
        new Date(row.observedAt).toLocaleString("es-CO"),
    },
    {
      header: "Estado",
      accessor: (row: NonNullable<typeof data>[0]) => row.status,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Cancelar" : "Agregar observación"}
        </Button>
      </div>

      {showForm && (
        <form
          className="grid grid-cols-1 gap-3 border p-4 md:grid-cols-3"
          onSubmit={handleSubmit}
        >
          <div className="space-y-1">
            <Label>Tipo de observación</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, observationType: e.target.value })
              }
              placeholder="Ej: vital-signs"
              required
              value={form.observationType}
            />
          </div>
          <div className="space-y-1">
            <Label>Código</Label>
            <Input
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Ej: 8867-4"
              value={form.code}
            />
          </div>
          <div className="space-y-1">
            <Label>Sistema de codificación</Label>
            <Input
              onChange={(e) => setForm({ ...form, codeSystem: e.target.value })}
              placeholder="Ej: LOINC"
              value={form.codeSystem}
            />
          </div>
          <div className="space-y-1">
            <Label>Valor textual</Label>
            <Input
              onChange={(e) => setForm({ ...form, valueText: e.target.value })}
              placeholder="Descricpción"
              value={form.valueText}
            />
          </div>
          <div className="space-y-1">
            <Label>Valor numérico</Label>
            <Input
              onChange={(e) => setForm({ ...form, valueNum: e.target.value })}
              type="number"
              value={form.valueNum}
            />
          </div>
          <div className="space-y-1">
            <Label>Unidad</Label>
            <Input
              onChange={(e) => setForm({ ...form, valueUnit: e.target.value })}
              placeholder="Ej: mmHg"
              value={form.valueUnit}
            />
          </div>
          <div className="space-y-1">
            <Label>Fecha de observación</Label>
            <Input
              onChange={(e) => setForm({ ...form, observedAt: e.target.value })}
              required
              type="datetime-local"
              value={form.observedAt}
            />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Input
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              required
              value={form.status}
            />
          </div>
          <div className="flex items-end">
            <Button disabled={create.isPending} size="sm" type="submit">
              {create.isPending ? "Guardando..." : "Guardar observación"}
            </Button>
          </div>
        </form>
      )}

      <DataTable
        columns={columns}
        data={data ?? []}
        emptyDescription="No hay observaciones registradas para esta atención."
        emptyTitle="Sin observaciones"
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
      />
    </div>
  );
}

function ProceduresTab({
  encounterId,
  patientId,
}: {
  encounterId: string;
  patientId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [cupsSearch, setCupsSearch] = useState("");
  const [performerSearch, setPerformerSearch] = useState("");
  const [form, setForm] = useState({
    cupsCode: "",
    description: "",
    performedAt: new Date().toISOString().slice(0, 16),
    performerId: "",
    status: "completed",
  });

  const { data: practitionersData, isLoading: practitionersLoading } = useQuery(
    orpc.facilities.listPractitioners.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: performerSearch || undefined,
      },
    })
  );

  const { data: cupsData, isLoading: cupsLoading } = useQuery(
    orpc.ripsReference.listEntries.queryOptions({
      input: {
        tableName: "CUPSRips",
        limit: 20,
        search: cupsSearch || undefined,
      },
    })
  );

  const { data, isLoading, refetch } = useQuery({
    ...orpc.clinicalRecords.listProcedures.queryOptions({
      input: { encounterId },
    }),
    enabled: !!encounterId,
  });

  const create = useMutation({
    ...orpc.clinicalRecords.createProcedure.mutationOptions(),
    onSuccess: () => {
      toast.success("Procedimiento registrado");
      setShowForm(false);
      setForm({
        cupsCode: "",
        description: "",
        performedAt: new Date().toISOString().slice(0, 16),
        performerId: "",
        status: "completed",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      encounterId,
      patientId,
      cupsCode: form.cupsCode,
      description: form.description,
      performedAt: form.performedAt ? new Date(form.performedAt) : null,
      performerId: form.performerId || null,
      status: form.status,
    });
  }

  const columns = [
    {
      header: "Código CUPS",
      accessor: (row: NonNullable<typeof data>[0]) => (
        <span className="font-medium">{row.cupsCode}</span>
      ),
    },
    {
      header: "Descripción",
      accessor: (row: NonNullable<typeof data>[0]) =>
        row.ripsReferenceName ?? row.description,
    },
    {
      header: "Fecha realización",
      accessor: (row: NonNullable<typeof data>[0]) =>
        row.performedAt
          ? new Date(row.performedAt).toLocaleString("es-CO")
          : "—",
    },
    {
      header: "Estado",
      accessor: (row: NonNullable<typeof data>[0]) => row.status,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Cancelar" : "Agregar procedimiento"}
        </Button>
      </div>

      {showForm && (
        <form
          className="grid grid-cols-1 gap-3 border p-4 md:grid-cols-3"
          onSubmit={handleSubmit}
        >
          <div className="space-y-1">
            <Label>Código CUPS</Label>
            <SearchSelect
              emptyMessage="Escribe para buscar en CUPS"
              loading={cupsLoading}
              onChange={(v) => {
                const selected = cupsData?.entries.find(
                  (entry) => entry.code === v
                );
                setForm((f) => ({
                  ...f,
                  cupsCode: v,
                  description: selected?.name ?? f.description,
                }));
              }}
              onSearchChange={setCupsSearch}
              options={
                cupsData?.entries.map((e) => ({
                  value: e.code,
                  label: e.name,
                  description: e.code,
                })) ?? []
              }
              placeholder="Buscar CUPS..."
              required
              search={cupsSearch}
              value={form.cupsCode}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Descripción</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              required
              value={form.description}
            />
          </div>
          <div className="space-y-1">
            <Label>Fecha de realización</Label>
            <Input
              onChange={(e) =>
                setForm({ ...form, performedAt: e.target.value })
              }
              type="datetime-local"
              value={form.performedAt}
            />
          </div>
          <div className="space-y-1">
            <Label>Profesional</Label>
            <SearchSelect
              clearable
              emptyMessage="Escribe para buscar profesionales"
              loading={practitionersLoading}
              onChange={(v) => setForm((f) => ({ ...f, performerId: v }))}
              onSearchChange={setPerformerSearch}
              options={
                practitionersData?.practitioners.map((p) => ({
                  value: p.id,
                  label: p.fullName,
                  description: p.documentNumber,
                })) ?? []
              }
              placeholder="Buscar profesional..."
              search={performerSearch}
              value={form.performerId}
            />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <select
              className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              required
              value={form.status}
            >
              <option value="completed">Completado</option>
              <option value="in-progress">En progreso</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button disabled={create.isPending} size="sm" type="submit">
              {create.isPending ? "Guardando..." : "Guardar procedimiento"}
            </Button>
          </div>
        </form>
      )}

      <DataTable
        columns={columns}
        data={data ?? []}
        emptyDescription="No hay procedimientos registrados para esta atención."
        emptyTitle="Sin procedimientos"
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
      />
    </div>
  );
}
