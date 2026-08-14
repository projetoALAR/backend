import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import 'multer';
import { LlmService } from '../chat/llm.service';
import { ChatQuotaService } from '../chat/chat-quota.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuditActor } from '../auditoria/auditoria.types';
import type { Role } from '../auth/roles';
import { CLIENTE_TIPOS, type ClienteTipo } from './clientes.dto';
import { DadosClienteExtraidos } from './clientes-extracao.dto';

/** Subconjunto restrito de DOCUMENTO_MIME_ALLOWLIST: só o que a IA consegue ler bem. */
export const EXTRACAO_MIME_ALLOWLIST = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

/** Abaixo disso, tratamos como PDF escaneado sem camada de texto útil. */
const MIN_CARACTERES_TEXTO_UTIL = 20;
const MAX_CARACTERES_TEXTO_PROMPT = 8_000;

const CAMPOS_TEXTO = [
  'nome',
  'cpf',
  'cnpj',
  'nomeFantasia',
  'rg',
  'email',
  'telefone',
  'endereco',
  'cidade',
  'cep',
] as const;

@Injectable()
export class ClientesExtracaoService {
  private readonly logger = new Logger(ClientesExtracaoService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly chatQuota: ChatQuotaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Extrai dados de cadastro de cliente a partir de um documento (PDF ou imagem).
   * O arquivo é processado somente em memória e nunca é persistido em disco/Storage.
   */
  async extrairDeArquivo(
    arquivo: Express.Multer.File,
    usuarioId: string,
    role?: Role,
    ator?: AuditActor,
  ): Promise<DadosClienteExtraidos> {
    if (!arquivo?.buffer?.length) {
      throw new BadRequestException('Arquivo obrigatório');
    }

    const mime = (arquivo.mimetype || '').toLowerCase();
    if (!EXTRACAO_MIME_ALLOWLIST.has(mime)) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido (${mime || 'desconhecido'}). Envie PDF, JPG, PNG ou WEBP.`,
      );
    }

    let textoDocumento: string | null = null;
    let imagensUrls: string[] = [];

    if (mime === 'application/pdf') {
      textoDocumento = await this.extrairTextoPdf(arquivo.buffer);
      if (
        !textoDocumento ||
        textoDocumento.length < MIN_CARACTERES_TEXTO_UTIL
      ) {
        return { avisos: ['pdf_sem_texto'] };
      }
    } else {
      imagensUrls = [
        `data:${mime};base64,${arquivo.buffer.toString('base64')}`,
      ];
    }

    await this.chatQuota.assertPodeUsar(usuarioId, role);

    const bruto = await this.llm.extrairDadosEstruturados(
      this.montarInstrucao(textoDocumento),
      { imagensUrls },
    );
    const dados = this.parsearResposta(bruto);

    await this.auditoria.registrar({
      acao: 'EXTRACAO_IA',
      entidade: 'CLIENTE',
      resumo: `Extração automática de dados de cliente a partir de documento (${mime})`,
      ator,
    });

    return dados;
  }

  private montarInstrucao(textoDocumento: string | null): string {
    const partes = [
      'Extraia os dados de cadastro de um cliente (pessoa física ou jurídica) a partir do documento anexado (RG, CNH, cartão CNPJ, contrato social ou comprovante de residência).',
      'Devolva um objeto JSON com EXATAMENTE estas chaves: nome, tipo, cpf, cnpj, nomeFantasia, rg, email, telefone, endereco, cidade, uf, cep.',
      '"tipo" deve ser a string "PF" ou "PJ" (ou null se não for possível determinar com segurança).',
      'Use o valor null para qualquer campo que não esteja clara e explicitamente presente no documento.',
      'NUNCA invente, adivinhe, complete ou deduza um valor que não esteja escrito no documento — na dúvida, use null.',
    ];
    if (textoDocumento) {
      partes.push(
        '',
        '## Texto extraído do documento',
        textoDocumento.slice(0, MAX_CARACTERES_TEXTO_PROMPT),
      );
    }
    return partes.join('\n');
  }

  private async extrairTextoPdf(buffer: Buffer): Promise<string | null> {
    try {
      // pdf-parse v2+: classe PDFParse (não mais função default)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require('pdf-parse') as {
        PDFParse: new (opts: { data: Buffer }) => {
          getText: () => Promise<{ text?: string }>;
          destroy: () => Promise<void>;
        };
      };
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        return (parsed.text || '').replace(/\0/g, '').trim() || null;
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } catch (error) {
      this.logger.warn(
        'Erro ao extrair texto do PDF em memória',
        error as Error,
      );
      return null;
    }
  }

  /** Parser defensivo: nunca deixa uma resposta malformada derrubar a requisição. */
  private parsearResposta(bruto: string): DadosClienteExtraidos {
    let obj: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(bruto);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('resposta da IA não é um objeto JSON');
      }
      obj = parsed as Record<string, unknown>;
    } catch (error) {
      this.logger.warn(
        `IA retornou JSON inválido na extração de cliente: ${String(error)}`,
      );
      return { avisos: ['ia_resposta_invalida'] };
    }

    const resultado: DadosClienteExtraidos = {};
    for (const campo of CAMPOS_TEXTO) {
      resultado[campo] = this.comoTextoOuNulo(obj[campo]);
    }
    resultado.cpf = this.soDigitosOuNulo(resultado.cpf);
    resultado.cnpj = this.soDigitosOuNulo(resultado.cnpj);
    resultado.cep = this.soDigitosOuNulo(resultado.cep);
    resultado.telefone = this.soDigitosOuNulo(resultado.telefone);
    resultado.tipo = this.comoTipoOuNulo(obj.tipo);
    resultado.uf = this.comoUfOuNulo(obj.uf);
    return resultado;
  }

  private comoTextoOuNulo(valor: unknown): string | null {
    return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
  }

  private soDigitosOuNulo(valor: string | null | undefined): string | null {
    if (!valor) return null;
    const digitos = valor.replace(/\D/g, '');
    return digitos || null;
  }

  private comoTipoOuNulo(valor: unknown): ClienteTipo | null {
    const texto = this.comoTextoOuNulo(valor)?.toUpperCase();
    if (texto && (CLIENTE_TIPOS as readonly string[]).includes(texto)) {
      return texto as ClienteTipo;
    }
    return null;
  }

  private comoUfOuNulo(valor: unknown): string | null {
    const texto = this.comoTextoOuNulo(valor)?.toUpperCase();
    return texto && /^[A-Z]{2}$/.test(texto) ? texto : null;
  }
}
