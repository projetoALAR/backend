import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAndamentoManualDto {
  @ApiProperty({
    example: 'Petição inicial protocolada no protocolo digital do TJSP',
  })
  @IsString()
  @MinLength(1, { message: 'Descrição obrigatória' })
  @MaxLength(2000)
  descricao!: string;

  @ApiPropertyOptional({
    description: 'Data do movimento (ISO). Se omitida, usa agora.',
    example: '2026-08-13',
  })
  @IsOptional()
  @IsDateString()
  data?: string;
}
