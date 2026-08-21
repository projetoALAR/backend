import {
  ArrayMaxSize,
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
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListarPaginadoQueryDto } from '../common/paginacao.dto';

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
  @ApiProperty({ example: '0001234-56.2026.8.26.0100' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(NUMERO_PROCESSO_REGEX, {
    message:
      'Número inválido. Use CNJ (0000000-00.0000.0.00.0000) ou código interno alfanumérico.',
  })
  numero!: string;

  @ApiProperty()
  @IsString()
  @IsIn([...PROCESSO_STATUS], {
    message: `Status inválido. Use: ${PROCESSO_STATUS.join(', ')}`,
  })
  status!: string;

  @ApiProperty()
  @IsUUID()
  clienteId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  titulo?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  descricao?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prioridade?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsDateString()
  prazo?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  concluido?: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  responsavelId?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
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

export class CreateProcessoComentarioDto {
  @IsString()
  @MinLength(1, { message: 'Comentário obrigatório' })
  @MaxLength(2000)
  texto!: string;
}

export class CreateProcessoTarefaDto {
  @ApiProperty({ example: 'Protocolar petição no TJSP' })
  @IsString()
  @MinLength(1, { message: 'Título obrigatório' })
  @MaxLength(200)
  titulo!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsDateString()
  prazo?: string | null;
}

export class UpdateProcessoTarefaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  concluida?: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsDateString()
  prazo?: string | null;
}

export class LinhaRelatorioPdfDto {
  @ApiProperty({ example: '0001234-56.2026.8.26.0100' })
  @IsString()
  @MaxLength(120)
  numero!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  titulo?: string;

  @ApiProperty({ example: 'Em andamento' })
  @IsString()
  @MaxLength(80)
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  prioridade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  prazo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  situacao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cliente?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsavel?: string;
}

/** PDF do recorte já filtrado no front (máx. 500 linhas). */
export class GerarRelatorioPdfDto {
  @ApiPropertyOptional({
    example: 'status=Em andamento; prazoDe=2026-08-01',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  filtrosResumo?: string;

  @ApiProperty({ type: [LinhaRelatorioPdfDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => LinhaRelatorioPdfDto)
  linhas!: LinhaRelatorioPdfDto[];
}

function splitCsv(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined;
  if (Array.isArray(value)) {
    return value.map(String).flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Query de listagem paginada de processos (filtros do FilterModal). */
export class ListarProcessosQueryDto extends ListarPaginadoQueryDto {
  @ApiPropertyOptional({ enum: ['ativos', 'concluidos'] })
  @IsOptional()
  @IsIn(['ativos', 'concluidos'])
  situacao?: 'ativos' | 'concluidos';

  @ApiPropertyOptional({
    description: 'Status (CSV ou repetido), ex.: Em andamento,Suspenso',
  })
  @IsOptional()
  @Transform(({ value }) => splitCsv(value))
  @IsArray()
  @IsString({ each: true })
  status?: string[];

  @ApiPropertyOptional({
    description: 'Prioridades (CSV), ex.: Alta,Média',
  })
  @IsOptional()
  @Transform(({ value }) => splitCsv(value))
  @IsArray()
  @IsString({ each: true })
  prioridade?: string[];

  @ApiPropertyOptional({ description: 'Prazo a partir de (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  prazoDe?: string;

  @ApiPropertyOptional({ description: 'Prazo até (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  prazoAte?: string;
}
