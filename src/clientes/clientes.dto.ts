import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const CLIENTE_TIPOS = ['PF', 'PJ'] as const;
export type ClienteTipo = (typeof CLIENTE_TIPOS)[number];

export class CreateClienteDto {
  @ApiProperty({ minLength: 2 })
  @IsString()
  @MinLength(2)
  nome!: string;

  @ApiPropertyOptional({ enum: CLIENTE_TIPOS, default: 'PF' })
  @IsOptional()
  @IsIn([...CLIENTE_TIPOS])
  tipo?: ClienteTipo;

  @ApiPropertyOptional({ example: '12345678901' })
  @IsOptional()
  @IsString()
  cpf?: string | null;

  @ApiPropertyOptional({ example: '12345678000199' })
  @IsOptional()
  @IsString()
  cnpj?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nomeFantasia?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rg?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  endereco?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cidade?: string | null;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  uf?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(9)
  cep?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string | null;
}

export class UpdateClienteDto {
  @ApiPropertyOptional({ minLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @ApiPropertyOptional({ enum: CLIENTE_TIPOS })
  @IsOptional()
  @IsIn([...CLIENTE_TIPOS])
  tipo?: ClienteTipo;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cpf?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnpj?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nomeFantasia?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rg?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  endereco?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cidade?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2)
  uf?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(9)
  cep?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string | null;
}
