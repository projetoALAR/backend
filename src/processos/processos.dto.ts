import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** CNJ oficial ou código interno do escritório (1–80 chars). */
const NUMERO_PROCESSO_REGEX =
  /^(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}|[A-Za-z0-9][\w./-]{0,79})$/;

export class CreateProcessoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(NUMERO_PROCESSO_REGEX, {
    message:
      'Número inválido. Use CNJ (0000000-00.0000.0.00.0000) ou código interno alfanumérico.',
  })
  numero!: string;

  @IsString()
  @MinLength(1)
  status!: string;

  @IsUUID()
  clienteId!: string;

  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;

  @IsOptional()
  @IsString()
  prioridade?: string;

  @IsOptional()
  @IsDateString()
  prazo?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  concluido?: boolean;
}

export class UpdateProcessoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(NUMERO_PROCESSO_REGEX, {
    message:
      'Número inválido. Use CNJ (0000000-00.0000.0.00.0000) ou código interno alfanumérico.',
  })
  numero?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;

  @IsOptional()
  @IsString()
  prioridade?: string;

  @IsOptional()
  @IsDateString()
  prazo?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  concluido?: boolean;
}
