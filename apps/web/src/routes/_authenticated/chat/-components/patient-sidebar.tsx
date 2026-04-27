import { SearchSelect } from "@wellfit-emr/ui/components/search-select";
import { Activity, AlertTriangle, Pill, User } from "lucide-react";

interface PatientSidebarProps {
  onPatientIdChange: (id: string | null) => void;
  onPatientSearchChange: (search: string) => void;
  patientAllergies:
    | Array<{
        id: string;
        substanceCode: string;
        criticality: string | null;
        reactionText: string | null;
      }>
    | undefined;
  patientEncounters:
    | {
        encounters: Array<{
          id: string;
          reasonForVisit: string;
          startedAt: Date;
          status: string;
        }>;
      }
    | undefined;
  patientMedications:
    | {
        items: Array<{
          id: string;
          genericName: string;
          dose: string;
          frequencyText: string;
          status: string;
        }>;
      }
    | undefined;
  patientSearch: string;
  patientsData:
    | {
        patients: Array<{
          id: string;
          firstName: string;
          middleName: string | null;
          lastName1: string;
          lastName2: string | null;
          primaryDocumentType: string;
          primaryDocumentNumber: string;
        }>;
      }
    | undefined;
  patientsLoading: boolean;
  selectedPatient:
    | {
        id: string;
        firstName: string;
        middleName: string | null;
        lastName1: string;
        lastName2: string | null;
        primaryDocumentType: string;
        primaryDocumentNumber: string;
        birthDate: Date;
        sexAtBirth: string;
        genderIdentity: string | null;
      }
    | undefined;
  selectedPatientId: string | null;
}

function formatPatientName(p: {
  firstName: string;
  middleName: string | null;
  lastName1: string;
  lastName2: string | null;
}) {
  return `${p.firstName}${p.middleName ? ` ${p.middleName}` : ""} ${p.lastName1}${p.lastName2 ? ` ${p.lastName2}` : ""}`;
}

export function PatientSidebar({
  patientSearch,
  patientsLoading,
  patientsData,
  selectedPatientId,
  selectedPatient,
  patientAllergies,
  patientEncounters,
  patientMedications,
  onPatientIdChange,
  onPatientSearchChange,
}: PatientSidebarProps) {
  return (
    <div className="flex w-80 flex-col border-r bg-muted/30">
      <div className="border-b p-4">
        <h2 className="mb-2 font-semibold text-sm">Contexto del paciente</h2>
        <SearchSelect
          clearable
          emptyMessage="Escribe para buscar"
          loading={patientsLoading}
          onChange={(v) => onPatientIdChange(v)}
          onSearchChange={onPatientSearchChange}
          options={
            patientsData?.patients.map((p) => ({
              value: p.id,
              label: formatPatientName(p),
              description: `${p.primaryDocumentType} ${p.primaryDocumentNumber}`,
            })) ?? []
          }
          placeholder="Buscar paciente..."
          search={patientSearch}
          value={selectedPatientId ?? ""}
        />
      </div>

      {selectedPatient && (
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            <PatientHeader patient={selectedPatient} />

            <PatientBasicInfo patient={selectedPatient} />

            {patientAllergies && patientAllergies.length > 0 && (
              <PatientAllergies allergies={patientAllergies} />
            )}

            {patientMedications && patientMedications.items.length > 0 && (
              <PatientMedications medications={patientMedications.items} />
            )}

            {patientEncounters && patientEncounters.encounters.length > 0 && (
              <PatientEncounters encounters={patientEncounters.encounters} />
            )}
          </div>
        </div>
      )}

      {!selectedPatient && (
        <div className="flex flex-1 flex-col items-center justify-center p-4">
          <User className="mb-2 text-muted-foreground" size={32} />
          <p className="text-center text-muted-foreground text-sm">
            Selecciona un paciente para que la IA tenga contexto clínico
          </p>
        </div>
      )}
    </div>
  );
}

function PatientHeader({
  patient,
}: {
  patient: {
    firstName: string;
    middleName: string | null;
    lastName1: string;
    lastName2: string | null;
    primaryDocumentType: string;
    primaryDocumentNumber: string;
  };
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-10 shrink-0 items-center justify-center bg-primary font-semibold text-primary-foreground">
        {patient.firstName[0]}
        {patient.lastName1[0]}
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-sm">
          {formatPatientName(patient)}
        </p>
        <p className="text-muted-foreground text-xs">
          {patient.primaryDocumentType} {patient.primaryDocumentNumber}
        </p>
      </div>
    </div>
  );
}

function PatientBasicInfo({
  patient,
}: {
  patient: {
    birthDate: Date;
    sexAtBirth: string;
    genderIdentity: string | null;
  };
}) {
  return (
    <div className="space-y-2">
      <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
        Datos básicos
      </p>
      <div className="space-y-1 text-xs">
        <p>
          <span className="text-muted-foreground">Nacimiento:</span>{" "}
          {new Date(patient.birthDate).toLocaleDateString("es-CO")}
        </p>
        <p>
          <span className="text-muted-foreground">Sexo:</span>{" "}
          {patient.sexAtBirth}
        </p>
        {patient.genderIdentity && (
          <p>
            <span className="text-muted-foreground">Género:</span>{" "}
            {patient.genderIdentity}
          </p>
        )}
      </div>
    </div>
  );
}

function PatientAllergies({
  allergies,
}: {
  allergies: Array<{
    id: string;
    substanceCode: string;
    criticality: string | null;
    reactionText: string | null;
  }>;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1 font-medium text-destructive text-xs uppercase tracking-wider">
        <AlertTriangle size={12} />
        Alergias
      </p>
      <div className="space-y-1">
        {allergies.map((a) => (
          <div
            className="rounded-none border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs"
            key={a.id}
          >
            <span className="font-medium">{a.substanceCode}</span>
            {a.criticality && (
              <span className="ml-1 text-destructive">({a.criticality})</span>
            )}
            {a.reactionText && (
              <span className="ml-1 text-muted-foreground">
                - {a.reactionText}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PatientMedications({
  medications,
}: {
  medications: Array<{
    id: string;
    genericName: string;
    dose: string;
    frequencyText: string;
    status: string;
  }>;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
        <Pill size={12} />
        Medicamentos
      </p>
      <div className="space-y-1">
        {medications.slice(0, 5).map((m) => (
          <div className="rounded-none border px-2 py-1 text-xs" key={m.id}>
            <p className="font-medium">{m.genericName}</p>
            <p className="text-muted-foreground">
              {m.dose} - {m.frequencyText} - {m.status}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PatientEncounters({
  encounters,
}: {
  encounters: Array<{
    id: string;
    reasonForVisit: string;
    startedAt: Date;
    status: string;
  }>;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1 font-medium text-muted-foreground text-xs uppercase tracking-wider">
        <Activity size={12} />
        Atenciones recientes
      </p>
      <div className="space-y-1">
        {encounters.slice(0, 3).map((e) => (
          <div className="rounded-none border px-2 py-1 text-xs" key={e.id}>
            <p className="font-medium">{e.reasonForVisit}</p>
            <p className="text-muted-foreground">
              {new Date(e.startedAt).toLocaleDateString("es-CO")} - {e.status}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
