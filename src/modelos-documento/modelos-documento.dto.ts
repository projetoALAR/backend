import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const CATEGORIAS_MODELO = [
  'Petição',
  'Contrato',
  'Procuração',
  'Notificação',
  'Recurso',
  'Outro',
] as const;

export type CategoriaModelo = (typeof CATEGORIAS_MODELO)[number];

export class CreateModeloDocumentoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nome!: string;

  @IsString()
  @IsIn([...CATEGORIAS_MODELO], {
    message: `Categoria inválida. Use: ${CATEGORIAS_MODELO.join(', ')}`,
  })
  categoria!: string;

  @IsString()
  @MinLength(1)
  conteudo!: string;
}

export class UpdateModeloDocumentoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nome?: string;

  @IsOptional()
  @IsString()
  @IsIn([...CATEGORIAS_MODELO], {
    message: `Categoria inválida. Use: ${CATEGORIAS_MODELO.join(', ')}`,
  })
  categoria?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  conteudo?: string;
}
