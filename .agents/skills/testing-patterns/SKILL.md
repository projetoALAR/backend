---
name: testing-patterns
description: Creates or updates Jest unit and e2e tests in this NestJS backend. Use when the user says "write tests", "add spec", "e2e", or "coverage", or when changing `*.service.ts`, `*.controller.ts`, or `test/jest-e2e.json`. Provides the repo’s TestingModule, supertest, and mocking patterns. Do NOT use for production code changes only.
---
# testing-patterns

## Critical
- Mirror the existing NestJS test layout exactly: unit specs live next to source files as `src/**\/*.spec.ts`, and e2e specs live in `test/app.e2e-spec.ts`.
- Use Jest with Nest testing utilities only. For unit tests, import from `@nestjs/testing` and create modules with `Test.createTestingModule()`.
- For HTTP e2e tests, use `supertest` against a Nest app created from `Test.createTestingModule()`.
- Do not invent a new test runner, assertion library, or folder structure.
- Verify the test target before writing code: if you are changing a `*.service.ts`, add/update the paired `*.spec.ts`; if you are changing a controller or routing behavior, add/update the matching spec and, if needed, `test/app.e2e-spec.ts`.

## Instructions
1. Identify the test type from the change.
   - If the change touches business logic in `src/**\/*.service.ts`, create or update the paired unit test at the same path with `.spec.ts` appended.
   - If the change touches request/response behavior in `src/**\/*.controller.ts`, update the paired unit test and, when the full HTTP flow matters, `test/app.e2e-spec.ts`.
   - If the change touches Jest configuration, keep e2e coverage aligned with `test/jest-e2e.json`.
   - Verify the target file(s) before proceeding to the next step.

2. Match the repo’s unit-test bootstrap pattern.
   - Use `import { Test, TestingModule } from '@nestjs/testing';` in Nest unit specs.
   - Build the test container with `await Test.createTestingModule({ ... }).compile();`.
   - Extract the service/controller from `module: TestingModule` using `module.get(...)`.
   - Keep the spec colocated with the implementation file and named exactly `*.spec.ts`.
   - This step uses the output from Step 1.
   - Verify the test module compiles before proceeding to the next step.

3. Mock Nest dependencies at the provider level, not with ad hoc global stubs.
   - Provide `useValue` mocks inside `providers: [...]` for injected dependencies such as Prisma-like services, config services, or other collaborators.
   - Reuse the same mock object within each test case so expectations stay explicit.
   - For controller tests, mock the underlying service rather than the HTTP layer.
   - This step uses the output from Step 2.
   - Verify each dependency used by the class under test is represented in the testing module before proceeding to the next step.

4. Write assertions that follow the class boundary being tested.
   - For services, assert direct return values and thrown errors.
   - For controllers, assert returned DTOs or delegated service calls.
   - Use `jest.fn()` for mocked methods and `expect(...).toHaveBeenCalledWith(...)` for interaction checks.
   - Keep tests narrow: one behavior per `it(...)` block unless the existing spec file already groups related cases.
   - This step uses the output from Step 3.
   - Verify every public behavior change has at least one passing assertion before proceeding to the next step.

5. Add or update e2e tests when the change affects the HTTP contract.
   - Use `supertest` in `test/app.e2e-spec.ts`.
   - Bootstrap the app from Nest’s testing utilities, then call the real endpoint path and assert status codes and payload shape.
   - Keep e2e coverage focused on route wiring, guards, serialization, and request/response format; do not duplicate all unit coverage.
   - This step uses the output from Step 4.
   - Verify the route returns the expected status and body shape before proceeding to the next step.

6. Run the relevant Jest scope before finishing.
   - For a single unit spec, run the focused Jest command for that file or pattern.
   - For HTTP flows, run the e2e test command that includes `test/app.e2e-spec.ts`.
   - If the repo already uses a coverage workflow for the touched area, run it after the targeted tests pass.
   - This step uses the output from Step 5.
   - Verify all touched tests pass before considering the task complete.

## Examples
- User says: “write tests for the clientes service”
  - Actions taken: locate `src/clientes/*.service.ts`, create or update the paired `src/clientes/*.spec.ts`, bootstrap a `TestingModule` with the service under test plus mocked providers, add `jest.fn()` expectations for the service methods, then run the focused Jest spec.
  - Result: a colocated unit spec that matches the repo’s Nest testing style and validates service behavior without starting the HTTP server.

- User says: “add e2e coverage for the compromissos endpoint”
  - Actions taken: inspect `src/compromissos/*.controller.ts` and `test/app.e2e-spec.ts`, wire the Nest app in the e2e test, call the endpoint with `supertest`, and assert the status code and response body.
  - Result: an HTTP-level Jest test in `test/app.e2e-spec.ts` that verifies routing and contract behavior.

## Common Issues
- If you see `Nest can't resolve dependencies of the XService (?, ...)`:
  1. Open the `providers` array in the `Test.createTestingModule()` setup.
  2. Add a mock provider for every constructor dependency used by the class.
  3. Verify the token matches the injected class or string token before rerunning the spec.

- If you see `Cannot find module '@nestjs/testing'` or `Cannot find module 'supertest'`:
  1. Verify `package-lock.json` includes the dependency.
  2. Run the project install step used in the repo.
  3. Confirm the import path is exactly `@nestjs/testing` for unit tests and `supertest` for e2e tests.

- If you see `Expected 1 arguments, but got 0` on `module.get(...)`:
  1. Check that the provider was registered in `providers` or `controllers`.
  2. Ensure the test is calling `module.get(TargetClass)` with the exact class reference.
  3. Verify the class is exported from the source file before rerunning.

- If you see e2e failures like `Expected 200 but received 404`:
  1. Check the controller route prefix in `src/**\/*.controller.ts`.
  2. Verify `test/app.e2e-spec.ts` is calling the full path used by Nest.
  3. Confirm the module exposing the controller is imported into the test app before rerunning.

- If you see `TypeError: Cannot read properties of undefined (reading '...' )` in a unit test:
  1. Inspect the mock object for the missing method or property.
  2. Add the missing `jest.fn()` or stub value to the provider mock.
  3. Verify the test is using the same mock instance passed into `providers`.