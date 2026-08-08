import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../auth/roles';

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
  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres' })
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
