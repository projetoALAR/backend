import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

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
}
