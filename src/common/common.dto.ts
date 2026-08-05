import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsArray,
  MinLength,
} from 'class-validator';

export class UpdatePreferenciasDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nome?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  fotoUrl?: string | null;

  @IsOptional()
  @IsObject()
  notificacoes?: Record<string, boolean>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notificacoesLidas?: string[];

  @IsOptional()
  @IsString()
  tema?: string;
}

export class CreateContatoDto {
  @IsString()
  @MinLength(1)
  alvoTipo!: string;

  @IsString()
  @MinLength(1)
  alvoId!: string;

  @IsString()
  @MinLength(1)
  alvoNome!: string;

  @IsIn(['email', 'telefone'])
  canal!: 'email' | 'telefone';

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsString()
  destino?: string;
}

export class CreateConversaDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  processoId?: string;
}

export class EnviarMensagemDto {
  @IsString()
  @MinLength(1)
  conteudo!: string;
}
