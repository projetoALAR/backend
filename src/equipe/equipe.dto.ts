import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '../auth/roles';
import { IsSenhaForte } from '../auth/password-policy';

export class CreateMembroDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  cargo!: string;

  @IsOptional()
  @IsString()
  status?: string;

  /** Obrigatória se o e-mail ainda não tiver conta de login. */
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.length > 0)
  @IsString()
  @IsSenhaForte()
  senha?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class UpdateMembroDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
