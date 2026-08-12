import {
  Equals,
  IsBoolean,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GerarRascunhoDto {
  @IsUUID()
  modeloId!: string;

  @IsUUID()
  processoId!: string;
}

export class SalvarRascunhoDto {
  @IsUUID()
  processoId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nomeArquivo!: string;

  @IsString()
  @MinLength(1)
  texto!: string;

  /** Obrigatório: confirma que um humano revisou o rascunho antes de salvar. */
  @IsBoolean()
  @Equals(true, {
    message:
      'Confirme a revisão humana do rascunho (revisaoConfirmada deve ser true) antes de salvar.',
  })
  revisaoConfirmada!: boolean;
}
