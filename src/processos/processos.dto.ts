import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
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

export const PROCESSO_STATUS = [
  'Em andamento',
  'Aguardando',
  'Em análise',
  'Audiência marcada',
  'Suspenso',
  'Concluído',
  'Arquivado',
] as const;

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
  @IsIn([...PROCESSO_STATUS], {
    message: `Status inválido. Use: ${PROCESSO_STATUS.join(', ')}`,
  })
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

  @IsOptional()
  @IsUUID()
  responsavelId?: string | null;

  @IsOptional()
  @IsUUID()
  coResponsavelId?: string | null;
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
  @MinLength(1)
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

  @IsOptional()
  @IsUUID()
  responsavelId?: string | null;

  @IsOptional()
  @IsUUID()
  coResponsavelId?: string | null;
}
