import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from './roles';
import { IsSenhaForte } from './password-policy';

export class LoginDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Senha obrigatória' })
  senha!: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
  nome!: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @IsString()
  @IsSenhaForte()
  senha!: string;
}

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsSenhaForte()
  senha!: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Senha atual obrigatória' })
  senhaAtual!: string;

  @IsString()
  @IsSenhaForte()
  novaSenha!: string;
}
