import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Query comum para listagens paginadas (clientes, processos, …). */
export class ListarPaginadoQueryDto {
  @ApiPropertyOptional({ minimum: 1, description: 'Página (1-based). Se omitido com limit, assume 1.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Busca textual' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export type PaginaResultado<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export function normalizarPaginacao(filtro?: {
  page?: number;
  limit?: number;
}): { paginar: boolean; page: number; limit: number } {
  const querPaginar = filtro?.page != null || filtro?.limit != null;
  if (!querPaginar) {
    return { paginar: false, page: 1, limit: 0 };
  }
  const page = Math.max(1, filtro?.page ?? 1);
  const limit = Math.min(100, Math.max(1, filtro?.limit ?? 24));
  return { paginar: true, page, limit };
}
