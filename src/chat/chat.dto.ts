import { IsBoolean } from 'class-validator';

export class MensagemFeedbackDto {
  @IsBoolean()
  util!: boolean;
}
