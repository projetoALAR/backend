import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class MensagemFeedbackDto {
  @IsBoolean()
  util!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class ExportarConversaQueryDto {
  @IsOptional()
  @IsIn(['markdown', 'json'])
  formato?: 'markdown' | 'json';
}
