import { IsUUID } from 'class-validator';

export class UploadDocumentoDto {
  @IsUUID('4', { message: 'processoId inválido' })
  processoId!: string;
}

/** MIME types aceitos no upload de documentos do caso. */
export const DOCUMENTO_MIME_ALLOWLIST = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
