import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from './roles';
import { IsSenhaForte } from './password-policy';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty()
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @ApiProperty()
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

export class Enable2faDto {
  @IsString()
  @MinLength(6, { message: 'Informe o código de 6 dígitos' })
  @MaxLength(12)
  code!: string;
}

export class Disable2faDto {
  @IsString()
  @MinLength(1, { message: 'Senha atual obrigatória' })
  senha!: string;

  @IsString()
  @MinLength(6, { message: 'Informe o código 2FA ou de recuperação' })
  @MaxLength(20)
  code!: string;
}

export class Verify2faDto {
  @IsString()
  @MinLength(10)
  preAuthToken!: string;

  @IsString()
  @MinLength(6, { message: 'Informe o código 2FA ou de recuperação' })
  @MaxLength(20)
  code!: string;
}
