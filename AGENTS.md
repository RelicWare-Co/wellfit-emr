# WellFit EMR — Contexto del proyecto

> **Regla para agentes:** Si realizas cualquier avance funcional, arquitectónico o de implementación en este proyecto, debes actualizar este archivo `AGENTS.md` para reflejar el nuevo estado. No dejes el documento desactualizado.

Historia Clínica Electrónica conforme con la normativa colombiana. Diseñada para cumplir con: Ley 23 de 1981, Resolución 1995 de 1999, Ley 2015 de 2020 (HCE interoperable), Resolución 866 de 2021, Resolución 1888 de 2025 (IHCE/RDA), Ley 1581 de 2012 (protección de datos), Decreto 780 de 2016 (habilitación), y regulación de RIPS.

## Stack

- **Monorepo**: Turborepo + Bun
- **Frontend**: React 19 + Vite + Tanstack Router (file-based) + Tailwind CSS v4
- **API**: oRPC (similar a tRPC) + Hono + Zod
- **DB**: SQLite (libsql) + Drizzle ORM
- **Auth**: Better Auth (email/password, admin plugin)
- **IA médica**: AI SDK v6 + ToolLoopAgent + proveedor server-side configurado en `packages/api/src/ai/agent.ts` + Streamdown para chat clínico con streaming, herramientas server-side y contexto de paciente construido desde la DB.
- **UI**: Componentes custom basados en `@base-ui/react` (shadcn-like), estilo cuadrado/angular (`rounded-none`). Incluye `SearchSelect` (búsqueda con dropdown) para reemplazar inputs de ID crudos y seleccionar entidades de catálogos RIPS. Los formularios de pacientes, prescripciones, atenciones y otros usan catálogos SISPRO en vivo. La revisión transversal de formularios cubre edición de pacientes, creación de atenciones, detalle de atenciones (diagnósticos CIE10/tipo diagnóstico, procedimientos CUPS/profesionales), sedes/unidades de servicio y anexos para evitar IDs/códigos manuales cuando existe fuente consultable.

## Arquitectura de rutas (frontend)

File-based routing con Tanstack Router. Las rutas públicas están en `apps/web/src/routes/`. Las rutas protegidas viven bajo `_authenticated/` y heredan el layout con guard de autenticación (`beforeLoad` que redirige a `/login`). El `AppShell` (sidebar + main) se renderiza únicamente en el layout `_authenticated.tsx`; las rutas públicas como `/login` usan su propio layout independiente.

Patrón de oRPC en este proyecto:
```tsx
import { useQuery, useMutation } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

// Query
const { data } = useQuery(orpc.patients.list.queryOptions({ input: { limit: 25, offset: 0 } }));

// Query con options adicionales
const { data } = useQuery({ ...orpc.patients.get.queryOptions({ input: { id } }), enabled: !!id });

// Mutation
const mutation = useMutation({ ...orpc.patients.create.mutationOptions(), onSuccess: () => { ... } });
```

## Estado de implementación

### Backend routers (oRPC) existentes
- `patients` — CRUD + list paginado
- `encounters` — CRUD + list + close
- `clinicalRecords` — create/list de diagnosis, allergy, observation, procedure
- `clinicalDocuments` — create/get/list/sign/correct con versionado inmutable, secciones y hash SHA-256
- `consents` — consent_record (create/list/revoke) + data_disclosure_authorization (create/list/revoke)
- `medicationOrders` — medication_order (create/list) + medication_administration (create/list)
- `serviceRequests` — service_request (create/list) + diagnostic_report (create/get)
- `interconsultations` — create/list/respond
- `incapacityCertificates` — create/list
- `attachments` — binary_object (create) + attachment_link (create/list)
- `auditEvents` — create/list con filtros
- `ripsExports` — create/list
- `ihceBundles` — create/list
- `facilities` — organizations, sites, serviceUnits, practitioners. Los listados de sedes y unidades de servicio aplican filtros de búsqueda además del alcance por organización/sede.
- `admin` — gestión de usuarios (Better Auth admin plugin)
- `ripsReference` — catálogos SISPRO (list tables/entries, sync). `listEntries` filtra por tabla y agrupa correctamente la búsqueda por código/nombre para no mezclar resultados de otras tablas. La sincronización RIPS usa condiciones Drizzle estructuradas para búsquedas por tabla/código y conteos.

### Endpoint IA / Chat médico
- `apps/server/src/chat.ts` expone `POST /api/chat` con autenticación Better Auth, valida mensajes `UIMessage`, usa `createAgentUIStreamResponse` con `ToolLoopAgent`, y ejecuta el modelo server-side definido en `packages/api/src/ai/agent.ts`. El endpoint mantiene el protocolo de AI SDK UI para `DefaultChatTransport` y añade headers anti-buffering (`Content-Encoding: none`, `X-Accel-Buffering: no`) para preservar streaming. `apps/server/src/index.ts` exporta la configuración de Bun con `idleTimeout: 120` para que las respuestas largas del agente no sean cortadas por el timeout idle por defecto de 10 segundos.
- El cliente solo envía `selectedPatientId`; el servidor construye el contexto clínico desde la base de datos (datos demográficos, alergias activas, medicamentos y atenciones recientes). No se confía en contexto clínico textual enviado por el navegador.
- Las herramientas del agente viven en `packages/api/src/ai/agent.ts`: búsqueda/consulta de pacientes, atenciones, diagnósticos, alergias, observaciones, medicamentos, procedimientos, atención activa, profesionales, catálogos RIPS/SISPRO, timeline clínico, revisión de seguridad clínica, documentos clínicos, órdenes de servicio/resultados, interconsultas, incapacidades, consentimientos y anexos.
- Las herramientas quedan limitadas al paciente seleccionado cuando existe `selectedPatientId`; las consultas por `encounterId` verifican pertenencia al paciente. Las escrituras clínicas disponibles desde el chat incluyen creación de prescripciones, diagnósticos, observaciones/signos vitales, procedimientos CUPS, órdenes de servicio, interconsultas, incapacidades y borradores de documentos clínicos. Estas herramientas validan paciente/atención/profesional cuando aplica y registran eventos de auditoría en canal `ai-chat`; los documentos creados por IA quedan como borradores y no se firman automáticamente. Todas las herramientas están envueltas con observabilidad server-side (`started`, `completed`, `failed`) para evitar fallas silenciosas, y los errores de stream/tool se exponen al cliente mediante los estados de AI SDK UI.

### Backend routers PENDIENTES
_Ninguno. Todos los routers planificados están implementados._

### Vistas frontend implementadas
- `/` — Dashboard
- `/patients` — Listado, búsqueda, registro
- `/patients/$patientId` — Detalle, edición, historial de atenciones
- `/encounters` — Listado, filtros, nueva atención
- `/encounters/$encounterId` — Detalle con tabs: diagnósticos, alergias, observaciones, procedimientos
- `/clinical-documents` — Listado y creación de documentos clínicos
- `/clinical-documents/$documentId` — Detalle con versión actual y secciones
- `/consents` — Consentimientos informados y autorizaciones de divulgación de datos
- `/medication-orders` — Prescripciones y administraciones
- `/service-requests` — Órdenes de servicio y resultados
- `/interconsultations` — Interconsultas y remisiones
- `/incapacity-certificates` — Certificados de incapacidad
- `/attachments` — Anexos y enlaces documentales
- `/audit-events` — Bitácora de auditoría y acceso
- `/rips-exports` — Panel regulatorio RIPS
- `/ihce-bundles` — Bundles IHCE/RDA para interoperabilidad
- `/facilities/organizations`, `/sites`, `/service-units`, `/practitioners`
- `/admin/users` — Gestión de usuarios (maneja error 403/500 sin permisos)
- `/catalogs`, `/catalogs/$tableName` — Catálogos RIPS
- `/chat` — Asistente médico con streaming, selección/búsqueda de paciente, panel de contexto clínico, acciones rápidas, render Markdown con Streamdown, visualización de tool calls y creación de prescripciones mediante herramientas server-side.
- La pantalla `/chat` incluye acción de nuevo chat en el encabezado para detener cualquier stream activo y limpiar el historial local sin cambiar el paciente seleccionado. El transporte de AI SDK se mantiene estable y usa `prepareSendMessagesRequest` con un `ref` del paciente seleccionado para enviar siempre el `selectedPatientId` vigente, evitando que el chat conserve el valor inicial `null`.

### Vistas frontend PENDIENTES
- Portal del paciente (solicitudes de copia)
- Firmas pendientes / panel de tareas regulatorias

## Seed y Test Infrastructure

### Archivos
- `packages/api/src/seed.ts` — Script de seed completo que usa los routers oRPC reales (no inserts directos a DB). Sirve dual propósito: poblar datos realistas y actuar como suite de integración.
- `packages/api/src/test-utils.ts` — Utilidades compartidas para tests: `ensureSeedUserExists`, `createSeedContext`, `createTestContext`.

### Características del seed
- **Sincronización RIPS obligatoria**: Antes de crear cualquier dato, ejecuta `ripsReference.syncAll()` para poblar catálogos SISPRO desde la API del estado. **Ningún código RIPS está hardcodeado**; todos se resuelven dinámicamente contra la base de datos post-sync.
- **Narrativas coherentes**: 10 pacientes con historias médicas realistas y evolutivas (diabetes, asma, prenatal, EPOC, pediatría, ortopedia, salud mental, cardiología, dermatología, gastroenterología).
- **Datos completos por paciente**: múltiples appointments, encounters, diagnósticos CIE10, observaciones (signos vitales), procedimientos CUPS, y prescripciones médicas.
- **Infraestructura base**: crea organización, sede, unidad de servicio y 8 profesionales de salud.
- **Uso de RPC real**: todas las operaciones pasan por `createRouterClient(appRouter, { context })` con un contexto que incluye DB real y una sesión de seed user.

### Comandos
```bash
# Ejecutar seed (primera vez o con DB limpia)
bun run seed

# Sobrescribir datos existentes del seed
bun run seed -- --clean

# Verificar tipos del seed
bun x tsc --noEmit -p packages/api/tsconfig.json
```

> **Nota:** El script `seed` carga automáticamente las variables de entorno desde `apps/server/.env` mediante `--env-file`. Asegúrate de que ese archivo exista y contenga `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` y `CORS_ORIGIN`.

> **Importante:** El seed debe ejecutarse desde el directorio `packages/api` para que el `DATABASE_URL` relativo (`file:../../local.db`) se resuelva correctamente. El comando en `package.json` ya maneja esto con `cd packages/api`.

> **Base de datos:** Asegúrate de que el servidor no esté usando exclusivamente la base de datos SQLite cuando ejecutes el seed, ya que puede causar conflictos de escritura. Si el seed falla con "Failed query", detén el servidor (`Ctrl+C` en la terminal de `dev:server`) y vuelve a ejecutar.

> **Idempotencia:** El seed detecta automáticamente si ya existe datos de un seed anterior (por `reps_code` de la organización). Si detecta datos existentes, muestra un error amigable y sugiere usar `--clean`. El flag `--clean` elimina todos los datos previos del seed antes de poblar la base de datos nuevamente.

### Test patterns establecidos
- **Unit tests** (existentes): usan `createRouterClient` con DB mocked (sin DB real).
- **Integration/seed tests** (nuevo): usan `createRouterClient` con DB real y `createSeedContext`.
- El seed user se crea/verifica en la tabla `user` de Better Auth para satisfacer FKs y el middleware de autenticación.

---

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

El `biome.jsonc` del repo excluye `.agents/` (skills locales externas al producto) y `apps/web/src/routeTree.gen.ts` (archivo generado por TanStack Router) para que `bun x ultracite check` reporte únicamente código mantenido del proyecto. También conserva overrides específicos para convenciones propias: rutas file-based dinámicas con `$param.tsx`, componentes de rutas existentes y el barrel público intencional de `packages/api/src/index.ts`.

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `bun x ultracite fix` before committing to ensure compliance.
