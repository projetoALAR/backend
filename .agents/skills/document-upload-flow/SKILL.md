---
name: document-upload-flow
description: Implements document upload and listing flow in `src/documentos/` with `multer` and Supabase storage. Use when user says `upload file`, `anexar documento`, `documentos`, `arquivo`, or edits `src/documentos/documentos.controller.ts`, `src/documentos/documentos.service.ts`, or `src/documentos/documentos.module.ts`. Do NOT use for non-file features. Capabilities: `FileInterceptor`, `Express.Multer.File`, size limits, process-linked document persistence.
---
# document-upload-flow

## Critical
- Only use this skill for file upload and listing work in the document feature.
- Keep the existing NestJS pattern: controller handles file interception, service handles persistence and storage, module wires dependencies.
- Always validate the upload path before coding:
  1. Confirm the target route exists in the document controller.
  2. Confirm the service method exists in the document service.
  3. Confirm the module already imports any needed providers.
- This flow must preserve process-linked document persistence. Do not store upload metadata without linking it to the process/document record used by the current codebase.
- Enforce upload limits at the controller boundary with file interceptor options. Do not rely only on service-side checks.

## Instructions
1. Inspect the existing document feature before changing anything.
   ```ts
   // Example of the feature shape to inspect
   @Controller('documentos')
   export class DocumentosController {}
   ```
   - Open the document controller, service, and module.
   - Identify the exact route names, DTOs, and response shape already used for documents and process-linked records.
   - Verify you found the current controller method signatures before proceeding to the next step.

2. Add or update the upload route using NestJS file interception.
   ```ts
   @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
   ```
   - Use `FileInterceptor('file', { ... })` for the upload endpoint.
   - Keep the file field name exactly `file` unless the existing controller already uses a different name.
   - Accept the uploaded file parameter from the Nest upload decorator and keep the rest of the request payload in the same DTO pattern already used in the controller.
   - Apply size limits in the interceptor options. Match the project’s current upload constraints if they exist; otherwise define them explicitly in the controller rather than the service.
   - Verify the controller still compiles with the existing imports before proceeding to the next step.

3. Implement the upload persistence in the service.
   ```ts
   // Example service responsibility
   async uploadDocumento(file: unknown, metadata: unknown) {
     // upload to storage, then persist the document record
   }
   ```
   - Add a service method that receives the uploaded file plus the metadata needed to link the document to its process record.
   - Keep storage logic in the service: create the Supabase upload call here, then persist the document record after the upload succeeds.
   - Use the existing `@supabase/supabase-js` client pattern from the project. If the service already has a storage client, reuse it rather than creating a second client.
   - Persist the file URL/path, filename, MIME type, size, and process linkage fields in the same shape used by the current document records.
   - If the Supabase upload fails, throw the same NestJS exception style already used elsewhere in the service layer.
   - Verify the service returns the same document shape used by existing listing endpoints before proceeding to the next step.

4. Wire the module.
   ```ts
   @Module({
     controllers: [DocumentosController],
     providers: [DocumentosService],
   })
   export class DocumentosModule {}
   ```
   - Ensure the controller and service are both registered in the module.
   - If the upload flow needs config access, import `ConfigModule` or keep the existing config provider pattern already used in the backend.
   - Do not add new providers unless the current module pattern requires them.
   - Verify Nest can resolve the service dependencies before proceeding to the next step.

5. Keep the document listing flow aligned with the upload data model.
   - Update the list method if needed so uploaded documents appear with the new stored fields.
   - Update the controller response only if the existing endpoint format must expose the new metadata.
   - Preserve the response structure already used by the rest of the document feature.
   - Verify upload-created documents appear in the same listing query used by the current feature before proceeding to the next step.

6. Validate the flow with project commands.
   - Run the relevant test command from the repository root, typically the repo’s existing Jest script.
   - If the repo has a document-specific test file under the test suite, run that focused test first, then run the broader suite if the route or persistence changed.
   - Verify the route compiles and the tests cover the upload and list behavior before finishing.

## Examples
- User says: `anexar documento ao processo`
  - Actions taken: inspect the document controller, add a file upload route with limits, update the document service to upload to Supabase and persist the process-linked record, then confirm the document appears in the existing list method.
  - Result: the backend accepts a file upload, stores it in Supabase, and saves a document record linked to the correct processo.

- User says: `upload file` and points to the document service
  - Actions taken: reuse the current document service pattern, keep file handling in the controller, add persistence and error handling in the service, then run the relevant Jest tests.
  - Result: the upload flow matches the current NestJS structure and does not break document listing.

## Common Issues
- If you see `Nest can't resolve dependencies of the DocumentosService`, then:
  1. Check the document module for missing providers or imports.
  2. Verify the Supabase/config provider is exported from the module that owns it.
  3. Confirm the service constructor arguments match the registered providers exactly.

- If you see `Cannot read properties of undefined (reading 'file')`, then:
  1. Verify the controller uses `FileInterceptor('file', ...)`.
  2. Confirm the client sends the multipart field as `file`.
  3. Check that the route uses the uploaded file decorator and not only the body decorator.

- If you see `File too large`, then:
  1. Verify the file size limit in the document controller.
  2. Confirm the client upload is within the configured bytes limit.
  3. If the current project already defines a smaller upload size, keep the existing limit and do not raise it without approval.

- If you see `Supabase upload failed` or a storage error response, then:
  1. Verify the storage bucket name and path used in the document service.
  2. Confirm the environment variables required by the Supabase client are loaded.
  3. Check that the file buffer and MIME type are passed from the upload object without transformation.

- If you see the file uploads successfully but does not appear in listing, then:
  1. Verify the document record is persisted after the Supabase upload succeeds.
  2. Check the list query in the document service includes the same process-link field used on insert.
  3. Confirm the controller returns the saved record, not only the storage response.