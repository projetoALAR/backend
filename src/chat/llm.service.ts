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

export type LlmResposta = {
  content: string;
  tokensUsados: number;
};

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

  private estimarTokens(texto: string): number {
    return Math.max(1, Math.ceil(texto.length / 4));
  }

  private respostaMock(): LlmResposta {
    const texto =
      RESPOSTAS_MOCK[Math.floor(Math.random() * RESPOSTAS_MOCK.length)];
    const content = `[Modo demonstração] ${texto}`;
    return { content, tokensUsados: this.estimarTokens(content) };
  }

  async gerarRespostaJuridica(
    mensagemUsuario: string,
    historico: { role: 'user' | 'assistant'; content: string }[] = [],
    opcoes: LlmOpcoes | string = {},
  ): Promise<LlmResposta> {
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
    const antiAlucinacao =
      'NÃO invente jurisprudência, súmulas, acórdãos, ementas, números de processo ou decisões judiciais. Se não houver base no contexto, diga explicitamente que não encontrou.';
    const systemPrompt = modoCaso
      ? [
          'Você é o assistente do Alar dedicado a UM caso específico (aberto no painel do processo).',
          'Use SEMPRE o contexto do caso fornecido (dados, cliente, prazos, lista de arquivos e textos/PDFs extraídos).',
          'Quando houver imagens anexadas na mensagem do usuário, analise o conteúdo visual e relate o que aparece de forma objetiva.',
          'OBRIGATÓRIO: se fizer resumo do caso ou listar anexos, mencione TODOS os arquivos do inventário pelo nome — nunca omita um anexo.',
          'Ao usar trecho de documento, cite o arquivo pelo nome entre colchetes, ex.: [contrato.pdf].',
          'Se a resposta NÃO se basear em nenhum anexo, diga explicitamente que não encontrou base nos anexos do caso.',
          'Não apresente afirmações factuais sobre o processo sem citar o arquivo correspondente ou admitir a ausência de fonte.',
          'Responda com base nos fatos deste caso. Não invente documentos, datas ou partes.',
          antiAlucinacao,
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
          'Não invente detalhes internos.',
          antiAlucinacao,
          'Responda em português do Brasil.',
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
   * Redige texto jurídico. Use proposito `rascunho` para peças reais (com revisão humana)
   * e `demo` para conteúdo fictício de seed/UI.
   */
  async gerarTextoDocumento(
    prompt: string,
    opcoes: { proposito?: 'rascunho' | 'demo' } = {},
  ): Promise<string> {
    const { content } = await this.gerarTextoDocumentoComUso(prompt, opcoes);
    return content;
  }

  async gerarTextoDocumentoComUso(
    prompt: string,
    opcoes: { proposito?: 'rascunho' | 'demo' } = {},
  ): Promise<LlmResposta> {
    const proposito = opcoes.proposito ?? 'demo';
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      if (this.isMockAllowed()) {
        this.logger.warn(
          'OPENAI_API_KEY ausente — CHAT_ALLOW_MOCK ativo (texto documento demonstração)',
        );
        const content =
          proposito === 'rascunho'
            ? [
                '[Modo demonstração] Rascunho jurídico genérico para revisão humana.',
                'Substitua os trechos [A COMPLETAR] com dados reais do caso.',
                '',
                'Rascunho gerado por IA — revise antes de usar. Não substitui a análise de um advogado habilitado.',
              ].join('\n')
            : [
                '[CONTEÚDO FICTÍCIO GERADO PARA TESTE — não representa o processo real sob este número CNJ]',
                '',
                '[Modo demonstração] Texto jurídico genérico de simulação para fins de UI.',
                'Trata-se de narrativa plausível e não de fatos reais sobre partes, valores ou decisões.',
              ].join('\n');
        return {
          content,
          tokensUsados: this.estimarTokens(prompt),
        };
      }
      throw new ServiceUnavailableException(
        'Geração de documento IA indisponível: configure OPENAI_API_KEY ou defina CHAT_ALLOW_MOCK=true.',
      );
    }

    const baseUrl =
      this.config.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
    const model = this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';

    const systemPrompt =
      proposito === 'rascunho'
        ? [
            'Você redige RASCUNHOS jurídicos para revisão humana obrigatória no software Alar.',
            'Use apenas fatos e dados fornecidos no prompt do usuário.',
            'NÃO invente jurisprudência, súmulas, acórdãos, ementas, números de processo, valores, datas ou partes.',
            'Se faltar informação, use o marcador [A COMPLETAR] em vez de inventar.',
            'Quando houver lacunas, prefira vários [A COMPLETAR] claros a inventar conteúdo.',
            'Não afirme como verdade o que não estiver no contexto.',
            'Responda em português do Brasil, em prosa formal adequada à peça.',
            'O texto deve ser tratado como rascunho — nunca como documento final.',
          ].join(' ')
        : [
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
      temperature: proposito === 'rascunho' ? 0.3 : 0.5,
    });
  }

  /**
   * Extrai dados estruturados (JSON) de um documento (texto e/ou imagens).
   * Usada para preencher formulários automaticamente — NUNCA deve inventar valores.
   */
  async extrairDadosEstruturados(
    instrucao: string,
    opcoes: { imagensUrls?: string[] } = {},
  ): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      if (this.isMockAllowed()) {
        this.logger.warn(
          'OPENAI_API_KEY ausente — CHAT_ALLOW_MOCK ativo (extração de dados demonstração)',
        );
        return '{}';
      }
      throw new ServiceUnavailableException(
        'Extração de dados por IA indisponível: configure OPENAI_API_KEY ou defina CHAT_ALLOW_MOCK=true.',
      );
    }

    const baseUrl =
      this.config.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
    const model = this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';

    const systemPrompt = [
      'Você extrai dados estruturados de documentos para preencher cadastros no sistema Alar.',
      'Responda SOMENTE com um objeto JSON válido — nenhum texto antes ou depois do JSON.',
      'NUNCA invente, adivinhe ou complete um valor que não esteja claramente legível no documento.',
      'Quando não encontrar um campo com certeza, use o valor null para ele.',
    ].join(' ');

    const imagens = (opcoes.imagensUrls || []).slice(0, 4);
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];
    if (imagens.length > 0) {
      const parts: Array<ChatTextPart | ChatImagePart> = [
        { type: 'text', text: instrucao },
        ...imagens.map((url): ChatImagePart => ({
          type: 'image_url',
          image_url: { url, detail: 'high' },
        })),
      ];
      messages.push({ role: 'user', content: parts });
    } else {
      messages.push({ role: 'user', content: instrucao });
    }

    const { content, tokensUsados } = await this.chamarChatCompletions(
      apiKey,
      baseUrl,
      model,
      messages,
      { temperature: 0.1, responseFormat: { type: 'json_object' } },
    );
    this.logger.log(`Extração estruturada concluída (tokens=${tokensUsados})`);
    return content;
  }

  private async chamarChatCompletions(
    apiKey: string,
    baseUrl: string,
    model: string,
    messages: ChatMessage[],
    opts: { temperature: number; responseFormat?: { type: 'json_object' } },
  ): Promise<LlmResposta> {
    const textoEntrada = messages
      .map((m) =>
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      )
      .join(' ');

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
            ...(opts.responseFormat
              ? { response_format: opts.responseFormat }
              : {}),
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        this.logger.error(`LLM HTTP ${response.status}: ${errText}`);
        throw new ServiceUnavailableException(ERRO_LLM);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { total_tokens?: number };
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        this.logger.warn('LLM retornou conteúdo vazio');
        throw new ServiceUnavailableException(ERRO_LLM);
      }
      const tokensUsados =
        data.usage?.total_tokens ?? this.estimarTokens(textoEntrada + content);
      return { content, tokensUsados };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error('Falha ao chamar LLM', error as Error);
      throw new ServiceUnavailableException(ERRO_LLM);
    }
  }
}
