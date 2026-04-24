import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { ChevronRight, Plus, Search, User, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_authenticated/encounters/")({
  component: EncountersPage,
});

const STATUS_OPTIONS = [
  { label: "Todas", value: "" },
  { label: "En progreso", value: "in-progress" },
  { label: "Finalizadas", value: "finished" },
  { label: "Canceladas", value: "cancelled" },
];

function PatientName({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    ...orpc.patients.get.queryOptions({ input: { id: patientId } }),
    enabled: !!patientId,
  });
  if (isLoading) {
    return <Skeleton className="h-3 w-20" />;
  }
  if (!data) {
    return (
      <span className="text-[10px] text-muted-foreground">{patientId}</span>
    );
  }
  return (
    <span>
      {data.firstName} {data.lastName1}
    </span>
  );
}

function EncountersPage() {
  const [offset, setOffset] = useState(0);
  const [limit] = useState(25);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedServiceUnitId, setSelectedServiceUnitId] = useState("");
  const [admissionSearch, setAdmissionSearch] = useState("");
  const [causeSearch, setCauseSearch] = useState("");
  const [finalidadSearch, setFinalidadSearch] = useState("");

  const [formData, setFormData] = useState({
    encounterClass: "",
    careModality: "",
    reasonForVisit: "",
    startedAt: new Date().toISOString().slice(0, 16),
    admissionSource: "",
    causeExternalCode: "",
    finalidadConsultaCode: "",
    modalidadAtencionCode: "",
  });

  const { data, isLoading, refetch } = useQuery(
    orpc.encounters.list.queryOptions({
      input: {
        limit,
        offset,
        search: search || undefined,
        status: status || undefined,
      },
    })
  );

  const { data: patientsData } = useQuery(
    orpc.patients.list.queryOptions({
      input: {
        limit: 20,
        offset: 0,
        search: patientSearch || undefined,
      },
    })
  );

  const { data: sitesData } = useQuery(
    orpc.facilities.listSites.queryOptions({
      input: {
        limit: 50,
        offset: 0,
      },
    })
  );

  const { data: serviceUnitsData } = useQuery({
    ...orpc.facilities.listServiceUnits.queryOptions({
      input: {
        limit: 50,
        offset: 0,
        siteId: selectedSiteId || undefined,
      },
    }),
    enabled: !!selectedSiteId,
  });

  const { data: admissionData, isLoading: admissionLoading } = useQuery(
    orpc.ripsReference.listEntries.queryOptions({
      input: {
        tableName: "ViaIngresoUsuario",
        limit: 20,
        search: admissionSearch || undefined,
      },
    })
  );

  const { data: causeData, isLoading: causeLoading } = useQuery(
    orpc.ripsReference.listEntries.queryOptions({
      input: {
        tableName: "RIPSCausaExternaVersion2",
        limit: 20,
        search: causeSearch || undefined,
      },
    })
  );

  const { data: finalidadData, isLoading: finalidadLoading } = useQuery(
    orpc.ripsReference.listEntries.queryOptions({
      input: {
        tableName: "RIPSFinalidadConsultaVersion2",
        limit: 20,
        search: finalidadSearch || undefined,
      },
    })
  );

  const createMutation = useMutation({
    ...orpc.encounters.create.mutationOptions(),
    onSuccess: () => {
      toast.success("Atención creada correctamente");
      setShowForm(false);
      resetForm();
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Error al crear atención: ${error.message}`);
    },
  });

  function resetForm() {
    setSelectedPatientId("");
    setSelectedSiteId("");
    setSelectedServiceUnitId("");
    setPatientSearch("");
    setFormData({
      encounterClass: "",
      careModality: "",
      reasonForVisit: "",
      startedAt: new Date().toISOString().slice(0, 16),
      admissionSource: "",
      causeExternalCode: "",
      finalidadConsultaCode: "",
      modalidadAtencionCode: "",
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!(selectedPatientId && selectedSiteId && selectedServiceUnitId)) {
      toast.error("Paciente, sede y unidad de servicio son obligatorios");
      return;
    }
    createMutation.mutate({
      patientId: selectedPatientId,
      siteId: selectedSiteId,
      serviceUnitId: selectedServiceUnitId,
      encounterClass: formData.encounterClass,
      careModality: formData.careModality,
      reasonForVisit: formData.reasonForVisit,
      startedAt: new Date(formData.startedAt),
      status: "in-progress",
      admissionSource: formData.admissionSource || null,
      causeExternalCode: formData.causeExternalCode || null,
      finalidadConsultaCode: formData.finalidadConsultaCode || null,
      modalidadAtencionCode: formData.modalidadAtencionCode || null,
      vidaCode: null,
      condicionDestinoCode: null,
    });
  }

  const columns = [
    {
      header: "Paciente",
      accessor: (row: NonNullable<typeof data>["encounters"][0]) => (
        <div className="flex items-center gap-2">
          <User className="text-muted-foreground" size={14} />
          <PatientName patientId={row.patientId} />
        </div>
      ),
    },
    {
      header: "Motivo de consulta",
      accessor: (row: NonNullable<typeof data>["encounters"][0]) => (
        <span className="font-medium">{row.reasonForVisit}</span>
      ),
    },
    {
      header: "Fecha inicio",
      accessor: (row: NonNullable<typeof data>["encounters"][0]) => (
        <span className="text-[10px]">
          {new Date(row.startedAt).toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      header: "Estado",
      accessor: (row: NonNullable<typeof data>["encounters"][0]) => (
        <span
          className={`inline-flex border px-1.5 py-0.5 text-[10px] ${
            row.status === "in-progress"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : row.status === "finished"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-gray-50 text-gray-700"
          }`}
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
      header: "Acciones",
      accessor: (row: NonNullable<typeof data>["encounters"][0]) => (
        <Link
          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          params={{ encounterId: row.id }}
          to="/encounters/$encounterId"
        >
          Ver <ChevronRight size={12} />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? "Cancelar" : "Nueva atención"}
          </Button>
        }
        description="Gestión de atenciones clínicas y registro de consultas"
        title="Atenciones"
      />

      {showForm && (
        <Card className="mx-6">
          <CardHeader>
            <CardTitle>Nueva atención</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
              onSubmit={handleSubmit}
            >
              <div className="space-y-1">
                <Label>Paciente</Label>
                <Input
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setSelectedPatientId("");
                  }}
                  placeholder="Buscar paciente..."
                  value={patientSearch}
                />
                {patientsData &&
                  patientsData.patients.length > 0 &&
                  !selectedPatientId && (
                    <div className="max-h-32 overflow-auto border">
                      {patientsData.patients.map(
                        (p: (typeof patientsData.patients)[0]) => (
                          <button
                            className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                            key={p.id}
                            onClick={() => {
                              setSelectedPatientId(p.id);
                              setPatientSearch(`${p.firstName} ${p.lastName1}`);
                            }}
                            type="button"
                          >
                            {p.firstName} {p.lastName1} ·{" "}
                            {p.primaryDocumentType} {p.primaryDocumentNumber}
                          </button>
                        )
                      )}
                    </div>
                  )}
                {selectedPatientId && (
                  <div className="flex items-center justify-between border px-2.5 py-1.5 text-xs">
                    <span>Paciente seleccionado</span>
                    <Button
                      onClick={() => {
                        setSelectedPatientId("");
                        setPatientSearch("");
                      }}
                      size="icon-xs"
                      variant="ghost"
                    >
                      <X size={12} />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label>Sede</Label>
                <select
                  className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                  onChange={(e) => {
                    setSelectedSiteId(e.target.value);
                    setSelectedServiceUnitId("");
                  }}
                  value={selectedSiteId}
                >
                  <option value="">Seleccione sede</option>
                  {sitesData?.sites.map((s: (typeof sitesData.sites)[0]) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>Unidad de servicio</Label>
                <select
                  className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
                  disabled={!(selectedSiteId && serviceUnitsData)}
                  onChange={(e) => setSelectedServiceUnitId(e.target.value)}
                  value={selectedServiceUnitId}
                >
                  <option value="">
                    {selectedSiteId
                      ? serviceUnitsData?.serviceUnits.length === 0
                        ? "Sin unidades"
                        : "Seleccione unidad"
                      : "Seleccione sede primero"}
                  </option>
                  {serviceUnitsData?.serviceUnits.map(
                    (u: (typeof serviceUnitsData.serviceUnits)[0]) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <Label>Clase de atención (grupo servicios)</Label>
                <Input
                  onChange={(e) =>
                    setFormData({ ...formData, encounterClass: e.target.value })
                  }
                  placeholder="Ej: consultaExterna"
                  required
                  value={formData.encounterClass}
                />
              </div>

              <div className="space-y-1">
                <Label>Modalidad de atención</Label>
                <Input
                  onChange={(e) =>
                    setFormData({ ...formData, careModality: e.target.value })
                  }
                  placeholder="Ej: presencial"
                  required
                  value={formData.careModality}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>Motivo de consulta</Label>
                <Input
                  onChange={(e) =>
                    setFormData({ ...formData, reasonForVisit: e.target.value })
                  }
                  placeholder="Describa el motivo de consulta"
                  required
                  value={formData.reasonForVisit}
                />
              </div>

              <div className="space-y-1">
                <Label>Fecha y hora de inicio</Label>
                <Input
                  onChange={(e) =>
                    setFormData({ ...formData, startedAt: e.target.value })
                  }
                  required
                  type="datetime-local"
                  value={formData.startedAt}
                />
              </div>

              <div className="space-y-1">
                <Label>Vía de ingreso (RIPS)</Label>
                <SearchSelect
                  value={formData.admissionSource}
                  onChange={(v) =>
                    setFormData((f) => ({ ...f, admissionSource: v }))
                  }
                  search={admissionSearch}
                  onSearchChange={setAdmissionSearch}
                  options={
                    admissionData?.entries.map((e) => ({
                      value: e.code,
                      label: e.name,
                      description: e.code,
                    })) ?? []
                  }
                  loading={admissionLoading}
                  placeholder="Buscar vía de ingreso..."
                  emptyMessage="Escribe para buscar"
                  clearable
                />
              </div>

              <div className="space-y-1">
                <Label>Causa externa (RIPS)</Label>
                <SearchSelect
                  value={formData.causeExternalCode}
                  onChange={(v) =>
                    setFormData((f) => ({ ...f, causeExternalCode: v }))
                  }
                  search={causeSearch}
                  onSearchChange={setCauseSearch}
                  options={
                    causeData?.entries.map((e) => ({
                      value: e.code,
                      label: e.name,
                      description: e.code,
                    })) ?? []
                  }
                  loading={causeLoading}
                  placeholder="Buscar causa externa..."
                  emptyMessage="Escribe para buscar"
                  clearable
                />
              </div>

              <div className="space-y-1">
                <Label>Finalidad consulta (RIPS)</Label>
                <SearchSelect
                  value={formData.finalidadConsultaCode}
                  onChange={(v) =>
                    setFormData((f) => ({ ...f, finalidadConsultaCode: v }))
                  }
                  search={finalidadSearch}
                  onSearchChange={setFinalidadSearch}
                  options={
                    finalidadData?.entries.map((e) => ({
                      value: e.code,
                      label: e.name,
                      description: e.code,
                    })) ?? []
                  }
                  loading={finalidadLoading}
                  placeholder="Buscar finalidad..."
                  emptyMessage="Escribe para buscar"
                  clearable
                />
              </div>

              <div className="space-y-1">
                <Label>Modalidad atención (RIPS)</Label>
                <Input
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      modalidadAtencionCode: e.target.value,
                    })
                  }
                  placeholder="Código RIPS"
                  value={formData.modalidadAtencionCode}
                />
              </div>

              <div className="flex justify-end md:col-span-2">
                <Button
                  disabled={createMutation.isPending}
                  size="sm"
                  type="submit"
                >
                  {createMutation.isPending
                    ? "Guardando..."
                    : "Guardar atención"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              onClick={() => {
                setStatus(opt.value);
                setOffset(0);
              }}
              size="xs"
              variant={status === opt.value ? "default" : "outline"}
            >
              {opt.label}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Search className="text-muted-foreground" size={14} />
            <Input
              className="h-7 w-48 text-xs"
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              placeholder="Buscar por motivo..."
              value={search}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data?.encounters ?? []}
          emptyDescription="Cree una nueva atención para comenzar."
          emptyTitle="No hay atenciones"
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
      </div>
    </div>
  );
}
