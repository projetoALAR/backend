import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class MensagemFeedbackDto {
  @IsBoolean()
  util!: boolean;
}

export class ExportarConversaQueryDto {
  @IsOptional()
  @IsIn(['markdown', 'json'])
  formato?: 'markdown' | 'json';
}
