import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

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
}
