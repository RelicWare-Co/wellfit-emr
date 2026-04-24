import type { AnyRouter, RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { adminRouter } from "./admin";
import { clinicalRecordsRouter } from "./clinical-records";
import { encountersRouter } from "./encounters";
import { facilitiesRouter } from "./facilities";
import { patientsRouter } from "./patients";

const healthCheckProcedure = publicProcedure.handler(() => "OK");

const privateDataProcedure = protectedProcedure.handler(({ context }) => ({
  message: "This is private",
  user: context.session?.user,
}));

export interface AppRouter extends Record<string, AnyRouter> {
  admin: typeof adminRouter;
  clinicalRecords: typeof clinicalRecordsRouter;
  encounters: typeof encountersRouter;
  facilities: typeof facilitiesRouter;
  healthCheck: typeof healthCheckProcedure;
  patients: typeof patientsRouter;
  privateData: typeof privateDataProcedure;
}

export const appRouter: AppRouter = {
  admin: adminRouter,
  clinicalRecords: clinicalRecordsRouter,
  encounters: encountersRouter,
  facilities: facilitiesRouter,
  healthCheck: healthCheckProcedure,
  patients: patientsRouter,
  privateData: privateDataProcedure,
};
export type AppRouterClient = RouterClient<typeof appRouter>;
