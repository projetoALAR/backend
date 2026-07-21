---
name: nestjs-prisma-backend
description: Creates new NestJS controllers, services, and modules wired to PrismaService. Use when user says add controller, new module, create service, route nova, integre com prisma, or edits src/clientes/, src/processos/, src/compromissos/, src/documentos/, src/dashboard/. Do NOT use for pure docs, refactors unrelated to src/, or frontend work. Capabilities: module wiring, DTO/type reuse from @prisma/client, repository-style queries, ConfigModule awareness.
---
# nestjs-prisma-backend

## Critical
- Keep new backend code inside `src/<feature>/` and match the existing NestJS structure already used in the project.
- Always wire the feature through a Nest module, service, and controller; do not create standalone classes in `src/` without module registration.
- Use `PrismaService` for all database access. Do not import or instantiate `PrismaClient` directly in feature code.
- Reuse generated Prisma types from `@prisma/client` for payloads and return values when possible. Do not invent duplicate domain types if Prisma already exposes the shape.
- If `ConfigModule` is needed, follow the existing app bootstrap/module pattern and verify env access through Nest DI before adding direct `process.env` reads.
- Verify the feature compiles and tests pass before finishing any change.

## Instructions
1. Identify the feature folder and mirror the existing pattern in `src/clientes/`, `src/processos/`, `src/compromissos/`, or `src/documentos/`.
   - Create files in the same naming style as the existing codebase: `*.module.ts`, `*.service.ts`, `*.controller.ts`, and DTOs under the feature directory when needed.
   - Use `src/<feature>/` as the root for all feature-specific files.
   - Verify the target folder exists and inspect sibling modules before proceeding to the next step.

2. Define the module and register its dependencies.
   - Create `src/<feature>/<feature>.module.ts` and import `Module` from `@nestjs/common`.
   - Add the controller and service to `controllers` and `providers`.
   - If the service uses configuration, import `ConfigModule` from `@nestjs/config` in the module, matching how the app already uses DI-based configuration.
   - Export the service only if another feature module needs to consume it.
   - Verify the module is registered in the application path used by the project before proceeding to the next step.
   - This step uses the output from Step 1.

3. Implement the service as the Prisma access layer.
   - Create `src/<feature>/<feature>.service.ts` and inject `PrismaService` via the constructor.
   - Import `Injectable` from `@nestjs/common` and the Prisma types you need from `@prisma/client`.
   - Put database logic in service methods; keep controller methods thin.
   - Use repository-style queries: `findMany`, `findUnique`, `create`, `update`, and `delete` should stay in the service.
   - Wrap write operations in `try/catch` only when the feature already follows explicit error translation patterns; otherwise let Nest handle unexpected errors consistently with the rest of the codebase.
   - Verify each service method returns the same shape the controller will expose before proceeding to the next step.
   - This step uses the output from Step 2.

4. Implement the controller and keep route naming consistent with the feature folder.
   - Create `src/<feature>/<feature>.controller.ts` and import `Controller`, `Get`, `Post`, `Body`, `Param`, `Patch`, and `Delete` from `@nestjs/common` only as needed.
   - Map routes under the feature name, e.g. `@Controller('<feature>')`, to match the folder and module naming.
   - Delegate all data access to the service; do not call Prisma directly in the controller.
   - Use DTO classes or typed payload objects for incoming requests if the feature already validates input that way.
   - Verify every controller endpoint calls the service method added in Step 3 before proceeding to the next step.
   - This step uses the output from Step 3.

5. Reuse Prisma-generated types and local DTOs instead of duplicating shapes.
   - Import types from `@prisma/client` for entities, enums, and create/update inputs when the Prisma schema already defines them.
   - If the feature needs request-only fields, define local DTOs inside `src/<feature>/dto/` or alongside the controller/service only when the existing feature folder already does so.
   - Do not create a DTO if the project already uses a direct typed object or Prisma input type for that exact operation.
   - Verify the DTO or type aligns with the service method signature before proceeding to the next step.
   - This step uses the output from Step 3.

6. Wire the feature into the application entrypoint.
   - Add the module import to the same Nest aggregation location used by the rest of the app, typically `src/app.module.ts` or the central module file already present in the project.
   - Preserve the existing import order and formatting conventions.
   - If the app uses `ConfigModule.forRoot(...)`, do not introduce a second competing global config setup.
   - Verify the module is discoverable by Nest and that the app boots without DI errors before proceeding to the next step.
   - This step uses the output from Steps 2–5.

7. Validate with the project’s existing tooling.
   - Run the relevant test or typecheck command used by the repo, typically Jest via `npm test` or a targeted `npm test -- <pattern>` run for the new feature.
   - If the project includes Prisma schema changes, run the Prisma checks/migration flow that matches the repo’s current state before finalizing the feature.
   - Verify the feature passes lint, typecheck, and tests for the touched area before closing the task.
   - This step uses the output from Steps 1–6.

## Examples
- User says: “add controller and service for compromissos”
  - Actions taken: create `src/compromissos/compromissos.module.ts`, `src/compromissos/compromissos.service.ts`, and `src/compromissos/compromissos.controller.ts`; inject `PrismaService` into the service; expose routes under `@Controller('compromissos')`; register the module in the app module.
  - Result: a Nest feature wired through Prisma with feature-scoped routes and service-layer database access.

- User says: “integre com prisma no módulo de documentos”
  - Actions taken: inspect `prisma/` models and the existing `src/documentos/` folder; reuse `@prisma/client` types in the service; keep queries in the service; update the feature module and app module import.
  - Result: the new documents feature follows the same repository-style Nest + Prisma pattern as the rest of the backend.

## Common Issues
- If you see `Nest can't resolve dependencies of the <Feature>Service (?)`, then:
  1. Verify `PrismaService` is listed in the feature module providers or imported through the module that exports it.
  2. Verify the service constructor injects `PrismaService` from the correct local path used in the project.
  3. Verify the feature module is imported by the app module.

- If you see `Unknown element <Feature>Controller` or the route never appears, then:
  1. Verify the controller is listed in `controllers` inside `src/<feature>/<feature>.module.ts`.
  2. Verify the feature module is imported in the root Nest module.
  3. Verify the controller decorator path matches the feature folder name.

- If you see `Property '<model>' does not exist on type 'PrismaService'`, then:
  1. Verify the Prisma schema in `prisma/` contains the model and the client was generated.
  2. Run the project’s Prisma generate flow used by the repo.
  3. Verify the service is importing the current generated Prisma client types, not stale local interfaces.

- If you see `Cannot find module '@prisma/client'` or missing Prisma types, then:
  1. Verify dependencies are installed with `npm install`.
  2. Verify `prisma generate` has been run after any schema change.
  3. Verify the service imports are from `@prisma/client` and not from a custom duplicate type file.

- If you see `ValidationPipe`-style bad request errors after adding DTOs, then:
  1. Verify the DTO properties match the exact request body shape used by the controller.
  2. Verify the controller method uses the DTO type in `@Body()`.
  3. Verify the feature is not mixing Prisma input types with request-only transport fields.