import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ChatContextService } from '../chat/chat-context.service';
import { LlmService } from '../chat/llm.service';
import { ChatQuotaService } from '../chat/chat-quota.service';
import { DocumentosService } from '../documentos/documentos.service';
import { preencherModelo } from '../modelos-documento/placeholder.util';
import { SalvarRascunhoDto } from './peticoes.dto';
import type { Role } from '../auth/roles';

export const AVISO_RASCUNHO_IA =
  'Rascunho gerado por IA — revise antes de usar. Não substitui a análise de um advogado habilitado.';

@Injectable()
export class PeticoesService {
  private readonly logger = new Logger(PeticoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatContext: ChatContextService,
    private readonly llm: LlmService,
    private readonly documentos: DocumentosService,
    private readonly chatQuota: ChatQuotaService,
  ) {}

  async gerarRascunho(
    modeloId: string,
    processoId: string,
    usuarioId: string,
    role?: Role,
  ) {
    await this.chatQuota.assertPodeUsar(usuarioId, role);

    const modelo = await this.prisma.modeloDocumento.findUnique({
      where: { id: modeloId },
    });
    if (!modelo) {
      throw new NotFoundException('Modelo de documento não encontrado');
    }

    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
      include: { cliente: true },
    });
    if (!processo) {
      throw new NotFoundException('Processo não encontrado');
    }

    const esqueleto = preencherModelo(modelo.conteudo, {
      cliente: processo.cliente,
      processo: {
        numero: processo.numero,
        titulo: processo.titulo,
        status: processo.status,
        descricao: processo.descricao,
      },
    });

    const { textoContexto } =
      await this.chatContext.montarContextoCaso(processoId);

    const prompt = [
      `Expanda o esqueleto abaixo em um rascunho COMPLETO de documento jurídico do tipo "${modelo.categoria}", em português do Brasil.`,
      'Use APENAS os fatos do contexto do caso e do esqueleto.',
      'NÃO invente jurisprudência, súmulas, acórdãos, números de processo, valores, datas ou partes que não estejam no contexto.',
      'Se faltar informação essencial, indique claramente com [A COMPLETAR] em vez de inventar.',
      'Mantenha estrutura formal adequada à peça. O texto deve estar pronto para revisão humana obrigatória.',
      `Finalize SEMPRE com exatamente esta linha (sem aspas): ${AVISO_RASCUNHO_IA}`,
      '',
      '## Esqueleto preenchido (modelo)',
      esqueleto,
      '',
      '## Contexto do caso',
      textoContexto,
    ].join('\n');

    const { content: textoBruto, tokensUsados } =
      await this.llm.gerarTextoDocumentoComUso(prompt, {
        proposito: 'rascunho',
      });

    if (textoBruto.includes('Não consegui obter resposta da IA')) {
      this.logger.warn(`Falha LLM ao gerar rascunho modelo=${modeloId}`);
      throw new ServiceUnavailableException(
        'Não foi possível gerar o rascunho com IA. Tente novamente em instantes.',
      );
    }

    let texto = textoBruto.trim();
    if (!texto.includes('Rascunho gerado por IA')) {
      texto = `${texto}\n\n${AVISO_RASCUNHO_IA}`;
    }

    this.logger.log(
      `Rascunho gerado processo=${processoId} tokens=${tokensUsados}`,
    );

    return { texto, tokensUsados };
  }

  async salvarRascunho(dados: SalvarRascunhoDto) {
    return this.documentos.criarDocumentoDeTexto(
      dados.processoId,
      dados.nomeArquivo,
      dados.texto,
    );
  }
}
