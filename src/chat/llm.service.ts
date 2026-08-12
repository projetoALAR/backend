import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const RESPOSTAS_MOCK = [
  'Com base nos dados do processo, recomendo revisar os prazos processuais e a documentação anexada.',
  'Esse ponto geralmente exige análise da jurisprudência recente. Posso ajudar a organizar os próximos passos.',
  'Sugiro validar as partes, o objeto e a forma do ato jurídico antes de avançar com a petição.',
  'Para esse cenário, um checklist de documentos e um cronograma de audiências costuma reduzir riscos.',
  'Entendi. Vamos priorizar os prazos mais próximos e alinhar as tarefas da equipe.',
];

const ERRO_LLM =
  'Não consegui obter resposta da IA agora. Verifique OPENAI_API_KEY, a conexão e tente novamente.';

type ChatTextPart = { type: 'text'; text: string };
type ChatImagePart = {
  type: 'image_url';
  image_url: { url: string; detail?: 'low' | 'high' | 'auto' };
};
type ChatContent = string | Array<ChatTextPart | ChatImagePart>;

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: ChatContent;
};

export type LlmOpcoes = {
  contextoTexto?: string;
  imagensUrls?: string[];
  modo?: 'workspace' | 'caso';
  detalheImagem?: 'low' | 'high' | 'auto';
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly config: ConfigService) {}

  private isMockAllowed(): boolean {
    const raw = (
      this.config.get<string>('CHAT_ALLOW_MOCK') || ''
    ).toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }

  private respostaMock(): string {
    const texto =
      RESPOSTAS_MOCK[Math.floor(Math.random() * RESPOSTAS_MOCK.length)];
    return `[Modo demonstração] ${texto}`;
  }

  async gerarRespostaJuridica(
    mensagemUsuario: string,
    historico: { role: 'user' | 'assistant'; content: string }[] = [],
    opcoes: LlmOpcoes | string = {},
  ): Promise<string> {
    const opts: LlmOpcoes =
      typeof opcoes === 'string' ? { contextoTexto: opcoes } : opcoes;

    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      if (this.isMockAllowed()) {
        this.logger.warn(
          'OPENAI_API_KEY ausente — CHAT_ALLOW_MOCK ativo (resposta de demonstração)',
        );
        return this.respostaMock();
      }
      throw new ServiceUnavailableException(
        'Chat IA indisponível: configure OPENAI_API_KEY ou defina CHAT_ALLOW_MOCK=true para respostas de demonstração.',
      );
    }

    const baseUrl =
      this.config.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
    const model = this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';

    const modoCaso = opts.modo === 'caso';
    const systemPrompt = modoCaso
      ? [
          'Você é o assistente do Alar dedicado a UM caso específico (aberto no painel do processo).',
          'Use SEMPRE o contexto do caso fornecido (dados, cliente, prazos, lista de arquivos e textos/PDFs extraídos).',
          'Quando houver imagens anexadas na mensagem do usuário, analise o conteúdo visual e relate o que aparece de forma objetiva.',
          'OBRIGATÓRIO: se fizer resumo do caso ou listar anexos, mencione TODOS os arquivos do inventário pelo nome — nunca omita um anexo.',
          'Ao usar trecho de documento, cite o arquivo pelo nome entre colchetes, ex.: [contrato.pdf].',
          'Responda com base nos fatos deste caso. Não invente documentos, datas ou partes.',
          'Se a pergunta for sobre a imagem/anexo, descreva o que vê e relacione com o caso.',
          'Respostas conversacionais curtas quando a pergunta for curta; análises profundas quando pedirem resumo/análise.',
          'Responda em português do Brasil. Aviso: não substitui parecer de advogado.',
        ].join(' ')
      : [
          'Você é o assistente GERAL do workspace Alar (menu Chat IA).',
          'Pode responder perguntas gerais e usar APENAS dados agregados do escritório (quantidades, títulos e status dos casos).',
          'PRIVACIDADE CRÍTICA: você NÃO tem acesso ao conteúdo interno dos casos (descrição, cliente, documentos, imagens, vídeos, chats do caso).',
          'Se pedirem resumo ou detalhes de um caso específico (ex.: "resumo do caso do Matheus"), RECUSE educadamente e diga para abrir o caso no painel e usar o chat dali.',
          'Pode dizer quantos casos ativos existem e listar títulos/números/status.',
          'Não invente detalhes internos. Responda em português do Brasil.',
        ].join(' ');

    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

    if (opts.contextoTexto?.trim()) {
      messages.push({
        role: 'system',
        content: modoCaso
          ? `Contexto completo deste caso (use para responder com precisão):\n\n${opts.contextoTexto}`
          : `Contexto operacional do workspace:\n\n${opts.contextoTexto}`,
      });
    }

    for (const m of historico.slice(-10)) {
      messages.push({ role: m.role, content: m.content });
    }

    const imagens = (opts.imagensUrls || []).slice(0, 8);
    const detalhe = opts.detalheImagem || 'auto';
    if (imagens.length > 0) {
      const parts: Array<ChatTextPart | ChatImagePart> = [
        { type: 'text', text: mensagemUsuario },
        ...imagens.map((url): ChatImagePart => ({
          type: 'image_url',
          image_url: { url, detail: detalhe },
        })),
      ];
      messages.push({ role: 'user', content: parts });
    } else {
      messages.push({ role: 'user', content: mensagemUsuario });
    }

    return this.chamarChatCompletions(apiKey, baseUrl, model, messages, {
      temperature: modoCaso ? 0.4 : 0.35,
    });
  }

  /**
   * Redige textos jurídicos fictícios de demonstração (petições, sentenças, resumos).
   * Reutilizável pela futura feature de geração de petições via IA.
   */
  async gerarTextoDocumento(prompt: string): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      if (this.isMockAllowed()) {
        this.logger.warn(
          'OPENAI_API_KEY ausente — CHAT_ALLOW_MOCK ativo (texto documento demonstração)',
        );
        return [
          '[CONTEÚDO FICTÍCIO GERADO PARA TESTE — não representa o processo real sob este número CNJ]',
          '',
          '[Modo demonstração] Texto jurídico genérico de simulação para fins de UI.',
          'Trata-se de narrativa plausível e não de fatos reais sobre partes, valores ou decisões.',
        ].join('\n');
      }
      throw new ServiceUnavailableException(
        'Geração de documento IA indisponível: configure OPENAI_API_KEY ou defina CHAT_ALLOW_MOCK=true.',
      );
    }

    const baseUrl =
      this.config.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
    const model = this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';

    const systemPrompt = [
      'Gere textos jurídicos PLAUSÍVEIS e GENÉRICOS para fins de demonstração de software.',
      'Nunca afirme fatos específicos como se fossem reais.',
      'Não invente nomes de partes reais, valores concretos ou decisões específicas de processos identificados por número CNJ.',
      'Sempre inclua a marca de conteúdo fictício fornecida pelo usuário (no início ou no fim do texto).',
      'Responda em português do Brasil, em prosa clara adequada a peças processuais de demonstração.',
    ].join(' ');

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    return this.chamarChatCompletions(apiKey, baseUrl, model, messages, {
      temperature: 0.5,
    });
  }

  private async chamarChatCompletions(
    apiKey: string,
    baseUrl: string,
    model: string,
    messages: ChatMessage[],
    opts: { temperature: number },
  ): Promise<string> {
    try {
      const response = await fetch(
        `${baseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: opts.temperature,
            messages,
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        this.logger.error(`LLM HTTP ${response.status}: ${errText}`);
        return ERRO_LLM;
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        this.logger.warn('LLM retornou conteúdo vazio');
        return ERRO_LLM;
      }
      return content;
    } catch (error) {
      this.logger.error('Falha ao chamar LLM', error as Error);
      return ERRO_LLM;
    }
  }
}
