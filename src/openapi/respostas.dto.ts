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

  @ApiProperty({ enum: ['PF', 'PJ'] })
  tipo!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  cpf!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  cnpj!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  nomeFantasia!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  rg!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  telefone!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  endereco!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  cidade!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  uf!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  cep!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  observacoes!: string | null;

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

  @ApiPropertyOptional({ enum: ['PF', 'PJ'] })
  tipo?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  telefone?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  cpf?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  cnpj?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  nomeFantasia?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  endereco?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  cidade?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  uf?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  cep?: string | null;
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

export class ProcessoTarefaCriadorDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty()
  email!: string;
}

export class ProcessoTarefaRespostaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  processoId!: string;

  @ApiProperty()
  titulo!: string;

  @ApiProperty()
  concluida!: boolean;

  @ApiProperty()
  ordem!: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  prazo!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  criadoPorId!: string | null;

  @ApiPropertyOptional({ type: ProcessoTarefaCriadorDto, nullable: true })
  criadoPor?: ProcessoTarefaCriadorDto | null;

  @ApiProperty()
  criadoEm!: string;

  @ApiProperty()
  atualizadoEm!: string;
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
