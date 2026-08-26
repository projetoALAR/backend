import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CheckoutBillingDto {
  @IsString()
  @IsIn(['essencial', 'profissional', 'escritorio'])
  planoId!: string;

  @IsOptional()
  @IsString()
  @IsIn(['mensal', 'anual', 'MONTHLY', 'YEARLY'])
  ciclo?: string;

  @IsString()
  @MinLength(11)
  cpfCnpj!: string;

  @IsOptional()
  @IsBoolean()
  trial?: boolean;
}
