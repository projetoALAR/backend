import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BuscaQueryDto {
  @IsString()
  @MinLength(2, { message: 'Digite ao menos 2 caracteres' })
  @MaxLength(120)
  q!: string;

  @IsOptional()
  @MaxLength(3)
  limit?: string;
}
