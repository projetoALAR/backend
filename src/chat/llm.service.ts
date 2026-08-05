import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const RESPOSTAS_MOCK = [
  'Com base nos dados do processo, recomendo revisar os prazos processuais e a documentação anexada.',
  'Esse ponto geralmente exige análise da jurisprudência recente. Posso ajudar a organizar os próximos passos.',
  'Sugiro validar as partes, o objeto e a forma do ato jurídico antes de avançar com a petição.',
  'Para esse cenário, um checklist de documentos e um cronograma de audiências costuma reduzir riscos.',
  'Entendi. Vamos priorizar os prazos mais próximos e alinhar as tarefas da equipe.',
];

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly config: ConfigService) {}

  async gerarRespostaJuridica(
    mensagemUsuario: string,
    historico: { role: 'user' | 'assistant'; content: string }[] = [],
  ): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY ausente — usando resposta mock');
      return RESPOSTAS_MOCK[Math.floor(Math.random() * RESPOSTAS_MOCK.length)];
    }

    const baseUrl =
      this.config.get<string>('OPENAI_BASE_URL') ||
      'https://api.openai.com/v1';
    const model =
      this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          messages: [
            {
              role: 'system',
              content:
                'Você é um assistente jurídico brasileiro do sistema Alar. Responda em português do Brasil, de forma objetiva e profissional. Não invente jurisprudência específica; oriente com boas práticas e próximos passos. Aviso: não substitui parecer de advogado.',
            },
            ...historico.slice(-10),
            { role: 'user', content: mensagemUsuario },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        this.logger.error(`LLM HTTP ${response.status}: ${errText}`);
        return RESPOSTAS_MOCK[Math.floor(Math.random() * RESPOSTAS_MOCK.length)];
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      return (
        content ||
        RESPOSTAS_MOCK[Math.floor(Math.random() * RESPOSTAS_MOCK.length)]
      );
    } catch (error) {
      this.logger.error('Falha ao chamar LLM', error as Error);
      return RESPOSTAS_MOCK[Math.floor(Math.random() * RESPOSTAS_MOCK.length)];
    }
  }
}
