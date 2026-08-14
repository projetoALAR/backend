/**
 * ============================================================================
 * AVISO DE LICENCIAMENTO — DATAJUD (CNJ) — USO NÃO COMERCIAL
 * ============================================================================
 *
 * A API pública do DataJud é licenciada APENAS para uso NÃO COMERCIAL
 * (Termo de Uso do DataJud; Resoluções CNJ 331/2020 e 446/2022).
 *
 * Esta implementação destina-se SOMENTE a ambiente de desenvolvimento/teste
 * e demonstração não-comercial do projeto.
 *
 * Antes de qualquer lançamento comercial, substituir este provider por uma
 * solução licenciada (ex.: Jusbrasil Soluções, Escavador, Judit.io).
 *
 * Termo de Uso:
 *   https://formularios.cnj.jus.br/wp-content/uploads/2023/05/Termos-de-uso-api-publica-V1.1.pdf
 * Portal / documentação:
 *   https://www.cnj.jus.br/sistemas/datajud/api-publica/
 * ============================================================================
 */

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AndamentoProviderMovimento,
  AndamentosConsultaResultado,
  AndamentosProvider,
} from './andamentos-provider';
import {
  normalizarNumeroCnj,
  resolverTribunalSigla,
  validarDigitoCnj,
} from './datajud-tribunal.util';

type DatajudMovimentoBruto = {
  codigo?: number;
  nome?: string;
  dataHora?: string;
  [key: string]: unknown;
};

const DATAJUD_BASE = 'https://api-publica.datajud.cnj.jus.br';
const MAX_TENTATIVAS = 3;
const TIMEOUT_MS = 20_000;

@Injectable()
export class DatajudService implements AndamentosProvider {
  private readonly logger = new Logger(DatajudService.name);

  constructor(private readonly config: ConfigService) {}

  async consultarPorNumero(
    numeroProcesso: string,
    tribunalSiglaCache?: string | null,
  ): Promise<AndamentosConsultaResultado> {
    const apiKey = this.config.get<string>('DATAJUD_API_KEY')?.trim();
    if (!apiKey) {
      return {
        ok: false,
        motivo: 'sem_api_key',
        mensagem: 'DATAJUD_API_KEY não configurada',
      };
    }

    const numero = normalizarNumeroCnj(numeroProcesso);
    if (!numero) {
      return {
        ok: false,
        motivo: 'erro',
        mensagem: 'Número CNJ inválido (esperado 20 dígitos)',
      };
    }

    if (!validarDigitoCnj(numero)) {
      return {
        ok: false,
        motivo: 'cnj_invalido',
        mensagem:
          'Dígito verificador do CNJ não confere. Confira o número completo (20 dígitos).',
      };
    }

    const tribunalSigla =
      tribunalSiglaCache?.trim().toLowerCase() || resolverTribunalSigla(numero);
    if (!tribunalSigla) {
      return {
        ok: false,
        motivo: 'tribunal_nao_mapeado',
        mensagem: `Tribunal não mapeado para o número ${numeroProcesso}`,
      };
    }

    const url = `${DATAJUD_BASE}/api_publica_${tribunalSigla}/_search`;
    const body = {
      query: { match: { numeroProcesso: numero } },
      size: 1,
    };

    try {
      const json = await this.fetchComRetry(url, apiKey, body);
      const hits = json?.hits?.hits;
      if (!Array.isArray(hits) || hits.length === 0) {
        return {
          ok: false,
          motivo: 'nao_encontrado',
          mensagem: `Processo não encontrado no DataJud (${tribunalSigla})`,
        };
      }
      const source = (hits[0]._source ?? {}) as {
        movimentos?: DatajudMovimentoBruto[];
      };
      const movimentos = (source.movimentos ?? [])
        .map((mov) => this.mapearMovimento(mov))
        .filter((m): m is AndamentoProviderMovimento => m != null);

      return { ok: true, tribunalSigla, movimentos };
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : 'Falha ao consultar DataJud';
      this.logger.error(mensagem);
      return { ok: false, motivo: 'erro', mensagem };
    }
  }

  private mapearMovimento(
    mov: DatajudMovimentoBruto,
  ): AndamentoProviderMovimento | null {
    const descricao = (mov.nome || '').trim();
    if (!descricao || !mov.dataHora) return null;
    const data = new Date(mov.dataHora);
    if (Number.isNaN(data.getTime())) return null;
    const codigo =
      typeof mov.codigo === 'number' && Number.isFinite(mov.codigo)
        ? mov.codigo
        : null;
    return {
      data,
      descricao,
      codigoMovimento: codigo,
      origem: mov,
    };
  }

  private async fetchComRetry(
    url: string,
    apiKey: string,
    body: unknown,
  ): Promise<{ hits?: { hits?: Array<{ _source?: unknown }> } }> {
    let ultimoErro: Error | null = null;

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `APIKey ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (res.status === 429 || res.status >= 500) {
          ultimoErro = new Error(
            `DataJud HTTP ${res.status} (tentativa ${tentativa}/${MAX_TENTATIVAS})`,
          );
          await this.backoff(tentativa);
          continue;
        }

        if (!res.ok) {
          const texto = await res.text().catch(() => '');
          throw new ServiceUnavailableException(
            `DataJud HTTP ${res.status}: ${texto.slice(0, 200)}`,
          );
        }

        return (await res.json()) as {
          hits?: { hits?: Array<{ _source?: unknown }> };
        };
      } catch (error) {
        if (
          error instanceof ServiceUnavailableException &&
          !String(error.message).includes('HTTP 429') &&
          !String(error.message).includes('HTTP 5')
        ) {
          throw error;
        }
        ultimoErro =
          error instanceof Error
            ? error.name === 'AbortError'
              ? new Error('Timeout ao consultar DataJud')
              : error
            : new Error('Erro desconhecido no DataJud');
        if (tentativa < MAX_TENTATIVAS) {
          await this.backoff(tentativa);
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw ultimoErro ?? new Error('Falha ao consultar DataJud');
  }

  private async backoff(tentativa: number) {
    const ms = 500 * Math.pow(2, tentativa - 1);
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
