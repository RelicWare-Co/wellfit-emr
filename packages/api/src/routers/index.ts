import type { AnyRouter, RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { adminRouter } from "./admin";
import { appointmentsRouter } from "./appointments";
import { attachmentsRouter } from "./attachments";
import { auditEventsRouter } from "./audit-events";
import { clinicalDocumentsRouter } from "./clinical-documents";
import { clinicalRecordsRouter } from "./clinical-records";
import { consentsRouter } from "./consents";
import { encountersRouter } from "./encounters";
import { facilitiesRouter } from "./facilities";
import { ihceBundlesRouter } from "./ihce-bundles";
import { incapacityCertificatesRouter } from "./incapacity-certificates";
import { interconsultationsRouter } from "./interconsultations";
import { medicationOrdersRouter } from "./medication-orders";
import { patientsRouter } from "./patients";
import { ripsExportsRouter } from "./rips-exports";
import { ripsReferenceRouter } from "./rips-reference";
import { serviceRequestsRouter } from "./service-requests";

const healthCheckProcedure = publicProcedure.handler(() => "OK");

const privateDataProcedure = protectedProcedure.handler(({ context }) => ({
  message: "This is private",
  user: context.session?.user,
}));

export interface AppRouter extends Record<string, AnyRouter> {
  admin: typeof adminRouter;
  appointments: typeof appointmentsRouter;
  attachments: typeof attachmentsRouter;
  auditEvents: typeof auditEventsRouter;
  clinicalDocuments: typeof clinicalDocumentsRouter;
  clinicalRecords: typeof clinicalRecordsRouter;
  consents: typeof consentsRouter;
  encounters: typeof encountersRouter;
  facilities: typeof facilitiesRouter;
  healthCheck: typeof healthCheckProcedure;
  ihceBundles: typeof ihceBundlesRouter;
  incapacityCertificates: typeof incapacityCertificatesRouter;
  interconsultations: typeof interconsultationsRouter;
  medicationOrders: typeof medicationOrdersRouter;
  patients: typeof patientsRouter;
  privateData: typeof privateDataProcedure;
  ripsExports: typeof ripsExportsRouter;
  ripsReference: typeof ripsReferenceRouter;
  serviceRequests: typeof serviceRequestsRouter;
}

export const appRouter: AppRouter = {
  admin: adminRouter,
  appointments: appointmentsRouter,
  attachments: attachmentsRouter,
  auditEvents: auditEventsRouter,
  clinicalDocuments: clinicalDocumentsRouter,
  clinicalRecords: clinicalRecordsRouter,
  consents: consentsRouter,
  encounters: encountersRouter,
  facilities: facilitiesRouter,
  healthCheck: healthCheckProcedure,
  ihceBundles: ihceBundlesRouter,
  incapacityCertificates: incapacityCertificatesRouter,
  interconsultations: interconsultationsRouter,
  medicationOrders: medicationOrdersRouter,
  patients: patientsRouter,
  privateData: privateDataProcedure,
  ripsExports: ripsExportsRouter,
  ripsReference: ripsReferenceRouter,
  serviceRequests: serviceRequestsRouter,
};
export type AppRouterClient = RouterClient<typeof appRouter>;
