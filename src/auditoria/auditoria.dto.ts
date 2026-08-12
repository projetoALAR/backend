import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AUDIT_ACOES, AUDIT_ENTIDADES } from './auditoria.types';

export class ListarAuditQueryDto {
  @IsOptional()
  @IsIn([...AUDIT_ENTIDADES])
  entidade?: string;

  @IsOptional()
  @IsIn([...AUDIT_ACOES])
  acao?: string;

  @IsOptional()
  @IsString()
  usuarioId?: string;

  @IsOptional()
  @IsString()
  de?: string;

  @IsOptional()
  @IsString()
  ate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
