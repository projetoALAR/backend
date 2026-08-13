import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClienteCountDto {
  @ApiProperty()
  processos!: number;
}

export class ClienteRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty()
  cpf!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  telefone!: string | null;

  @ApiProperty()
  criadoEm!: string;

  @ApiPropertyOptional({ type: ClienteCountDto })
  _count?: ClienteCountDto;
}

export class UsuarioResumoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ['ADMIN', 'ADVOGADO', 'ASSISTENTE'] })
  role!: string;
}

export class ProcessoClienteResumoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  telefone?: string | null;

  @ApiPropertyOptional()
  cpf?: string;
}

export class ProcessoCountDto {
  @ApiProperty()
  documentos!: number;

  @ApiProperty()
  compromissos!: number;
}

export class ProcessoRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  numero!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  descricao!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  titulo!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  prioridade!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  prazo!: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  tags!: string[] | null;

  @ApiProperty()
  concluido!: boolean;

  @ApiProperty()
  clienteId!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  responsavelId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  coResponsavelId!: string | null;

  @ApiPropertyOptional({ type: UsuarioResumoDto, nullable: true })
  responsavel?: UsuarioResumoDto | null;

  @ApiPropertyOptional({ type: UsuarioResumoDto, nullable: true })
  coResponsavel?: UsuarioResumoDto | null;

  @ApiProperty()
  criadoEm!: string;

  @ApiProperty()
  atualizadoEm!: string;

  @ApiPropertyOptional({ type: ProcessoClienteResumoDto })
  cliente?: ProcessoClienteResumoDto;

  @ApiPropertyOptional({ type: ProcessoCountDto })
  _count?: ProcessoCountDto;
}

export class DocumentoRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty()
  urlArquivo!: string;

  @ApiPropertyOptional({ nullable: true, type: Number })
  tamanho!: number | null;

  @ApiProperty()
  criadoEm!: string;

  @ApiProperty()
  processoId!: string;
}

export class UsuarioAuthDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ['ADMIN', 'ADVOGADO', 'ASSISTENTE'] })
  role!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  fotoUrl!: string | null;

  @ApiProperty()
  criadoEm!: string;

  @ApiPropertyOptional()
  totpEnabled?: boolean;
}
