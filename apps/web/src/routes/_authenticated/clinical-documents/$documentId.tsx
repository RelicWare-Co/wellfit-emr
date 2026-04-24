import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@wellfit-emr/ui/components/card";
import { Skeleton } from "@wellfit-emr/ui/components/skeleton";
import { FileText } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute(
  "/_authenticated/clinical-documents/$documentId"
)({
  component: ClinicalDocumentDetailPage,
});

function ClinicalDocumentDetailPage() {
  const { documentId } = useParams({
    from: "/_authenticated/clinical-documents/$documentId",
  });

  const { data, isLoading } = useQuery(
    orpc.clinicalDocuments.get.queryOptions({ input: { id: documentId } })
  );

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        backTo="/clinical-documents"
        title={
          isLoading
            ? "Cargando..."
            : (data?.document.documentType ?? "Documento clínico")
        }
      />

      <div className="grid grid-cols-1 gap-4 px-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <FileText size={16} />
              Información del documento
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-xs">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton className="h-4 w-full" key={i} />
              ))
            ) : data?.document ? (
              [
                { label: "ID", value: data.document.id },
                { label: "Tipo", value: data.document.documentType },
                { label: "Estado", value: data.document.status },
                { label: "Paciente ID", value: data.document.patientId },
                { label: "Atención ID", value: data.document.encounterId },
                {
                  label: "Fecha creación",
                  value: new Date(data.document.createdAt).toLocaleString(
                    "es-CO"
                  ),
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
                Documento no encontrado
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Versión actual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {isLoading ? (
              <>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </>
            ) : data?.version ? (
              <>
                <div>
                  <p className="text-[10px] text-muted-foreground">Versión</p>
                  <p className="font-medium">{data.version.versionNo}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Autor</p>
                  <p className="font-medium">
                    {data.version.authorPractitionerId}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    Hash SHA-256
                  </p>
                  <p className="truncate font-medium">
                    {data.version.hashSha256}
                  </p>
                </div>
                {data.version.signedAt && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Firmado</p>
                    <p className="font-medium">
                      {new Date(data.version.signedAt).toLocaleString("es-CO")}
                    </p>
                  </div>
                )}
                {data.version.correctionReason && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Motivo corrección
                    </p>
                    <p className="font-medium">
                      {data.version.correctionReason}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Sin versión</p>
            )}
          </CardContent>
        </Card>
      </div>

      {data && data.sections.length > 0 && (
        <div className="px-6">
          <Card>
            <CardHeader>
              <CardTitle>Secciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.sections.map((section) => (
                <div className="border p-3" key={section.id}>
                  <p className="mb-1 text-[10px] text-muted-foreground uppercase">
                    {section.sectionCode} (orden {section.sectionOrder})
                  </p>
                  <pre className="overflow-auto text-xs">
                    {JSON.stringify(section.sectionPayloadJson, null, 2)}
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
