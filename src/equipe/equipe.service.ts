import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { DocumentosService } from '../documentos/documentos.service';
import { Role } from '../auth/roles';
import { CreateMembroDto, UpdateMembroDto } from './equipe.dto';
import { assertSenhaForte } from '../auth/password-policy';
import { BillingService } from '../billing/billing.service';
import {
  CAMPOS_ALVO_EQUIPE,
  linhasDeTabelaEquipe,
  normalizarRoleEquipe,
  normalizarStatusEquipe,
  sugerirColunaEquipe,
  type LinhaImportacaoEquipe,
} from './equipe-importacao.util';
import { montarModeloEquipeXlsx } from '../importacao/planilha-importacao.util';
import {
  aplicarMapeamento,
  lerTabelaDeArquivo,
  montarPreview,
  type MapeamentoColunas,
  type PreviewImportacao,
  validarMapeamento,
} from '../importacao/importacao-mapeamento.util';

export const MAX_LINHAS_IMPORTACAO_EQUIPE = 100;

export type ResultadoLinhaImportacaoEquipe = {
  linha: number;
  status: 'criado' | 'duplicado' | 'erro';
  nome?: string;
  email?: string;
  membroId?: string;
  motivo?: string;
};

export type ResultadoImportacaoEquipe = {
  total: number;
  criados: number;
  duplicados: number;
  erros: number;
  resultados: ResultadoLinhaImportacaoEquipe[];
};

function mensagemErroImportacao(err: unknown): string {
  if (err instanceof BadRequestException || err instanceof ConflictException) {
    const res = err.getResponse();
    if (typeof res === 'string') return res;
    if (res && typeof res === 'object' && 'message' in res) {
      const msg = (res as { message?: string | string[] }).message;
      if (Array.isArray(msg)) return msg.join('; ');
      if (typeof msg === 'string') return msg;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Falha ao importar';
}

const membroInclude = {
  usuario: {
    select: {
      id: true,
      role: true,
      fotoUrl: true,
    },
  },
} satisfies Prisma.MembroEquipeInclude;

type MembroComUsuario = Prisma.MembroEquipeGetPayload<{
  include: typeof membroInclude;
}>;

export function cargoPadraoPorRole(role: Role): string {
  switch (role) {
    case Role.ADMIN:
      return 'Administrador';
    case Role.ADVOGADO:
      return 'Advogado';
    default:
      return 'Assistente';
  }
}

@Injectable()
export class EquipeService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
    private documentos: DocumentosService,
    private billing: BillingService,
  ) {}

  private async withSignedAvatar(membro: MembroComUsuario) {
    if (!membro.usuario?.fotoUrl) {
      return membro;
    }
    return {
      ...membro,
      usuario: {
        ...membro.usuario,
        fotoUrl: await this.documentos.resolveSignedUrl(membro.usuario.fotoUrl),
      },
    };
  }

  async criar(
    dados: CreateMembroDto,
    opcoes?: { silencioso?: boolean },
  ) {
    const email = dados.email.trim().toLowerCase();
    const nome = dados.nome.trim();
    const cargo = dados.cargo.trim();
    const status = dados.status || 'active';
    const role = dados.role ?? Role.ASSISTENTE;

    const membro = await this.prisma.$transaction(async (tx) => {
      const emailEmUso = await tx.membroEquipe.findUnique({ where: { email } });
      if (emailEmUso) {
        throw new ConflictException('Já existe um membro com este e-mail');
      }

      let usuario = await tx.usuario.findUnique({ where: { email } });

      if (usuario) {
        const jaVinculado = await tx.membroEquipe.findUnique({
          where: { usuarioId: usuario.id },
        });
        if (jaVinculado) {
          throw new ConflictException(
            'Este usuário já está vinculado à equipe',
          );
        }
      } else {
        if (!dados.senha) {
          throw new BadRequestException(
            'Informe uma senha forte para criar o acesso, ou use o e-mail de um usuário existente.',
          );
        }
        assertSenhaForte(dados.senha);
        if (!Object.values(Role).includes(role)) {
          throw new BadRequestException('Papel inválido');
        }

        await this.billing.assertPodeAdicionarUsuario();

        usuario = await tx.usuario.create({
          data: {
            nome,
            email,
            senhaHash: await bcrypt.hash(dados.senha, 10),
            role,
            mustChangePassword: true,
          },
        });

        await tx.preferencia.create({
          data: {
            usuarioId: usuario.id,
            nome,
            email,
          },
        });
      }

      return tx.membroEquipe.create({
        data: {
          nome,
          email,
          cargo,
          status,
          usuarioId: usuario.id,
        },
        include: membroInclude,
      });
    });

    if (!opcoes?.silencioso) {
      await this.notificacoes.notificarTodosUsuarios(
        'Novo membro na equipe',
        `${membro.nome} (${membro.cargo}) foi adicionado à equipe.`,
        '/equipe',
        'teamUpdates',
      );
    }

    if (dados.senha && membro.usuarioId) {
      await this.enviarConviteMembro(
        { id: membro.usuarioId, nome: membro.nome, email: membro.email },
        dados.senha,
      );
    }

    return this.withSignedAvatar(membro);
  }

  async enviarConviteMembro(
    user: { id: string; nome: string; email: string },
    senhaTemporaria: string,
  ) {
    const base = this.notificacoes.appPublicUrl().replace(/\/$/, '');
    await this.notificacoes.enviarEmailTransacional({
      para: user.email,
      assunto: 'Bem-vindo ao Alar — acesso criado',
      titulo: 'Conta criada',
      corpo: [
        `Olá, ${user.nome}.`,
        '',
        'Sua conta no Alar foi criada pela equipe do escritório.',
        `Senha temporária: ${senhaTemporaria}`,
        '',
        'No primeiro acesso você deverá trocar a senha.',
        `E-mail de login: ${user.email}`,
      ].join('\n'),
      link: `${base}/login`,
      linkRotulo: 'Entrar no Alar',
    });
    await this.notificacoes.criarInbox({
      usuarioId: user.id,
      titulo: 'Bem-vindo ao Alar',
      corpo:
        'Sua conta foi criada. Troque a senha temporária no primeiro acesso.',
      tipo: 'sistema',
      link: '/trocar-senha',
    });
  }

  async modeloXlsx(): Promise<Buffer> {
    return montarModeloEquipeXlsx();
  }

  async previewArquivo(
    buffer: Buffer,
    nomeArquivo: string,
    mime?: string,
  ): Promise<PreviewImportacao> {
    try {
      const tabela = await lerTabelaDeArquivo(buffer, nomeArquivo, mime);
      return montarPreview(
        tabela,
        [...CAMPOS_ALVO_EQUIPE],
        (h) => sugerirColunaEquipe(h),
      );
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Arquivo inválido',
      );
    }
  }

  async importarArquivo(
    buffer: Buffer,
    nomeArquivo: string,
    mime?: string,
    mapeamento?: MapeamentoColunas | null,
    senhaPadrao?: string | null,
  ): Promise<ResultadoImportacaoEquipe> {
    let linhas: LinhaImportacaoEquipe[];
    try {
      const tabela = await lerTabelaDeArquivo(buffer, nomeArquivo, mime);
      if (mapeamento && Object.keys(mapeamento).length > 0) {
        const erroMap = validarMapeamento(mapeamento, [...CAMPOS_ALVO_EQUIPE]);
        if (erroMap) throw new BadRequestException(erroMap);
        linhas = aplicarMapeamento<LinhaImportacaoEquipe>(tabela, mapeamento);
      } else {
        linhas = linhasDeTabelaEquipe(tabela);
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Arquivo inválido',
      );
    }

    if (linhas.length === 0) {
      throw new BadRequestException(
        'Arquivo sem linhas de dados. Preencha a aba Dados do modelo.',
      );
    }
    if (linhas.length > MAX_LINHAS_IMPORTACAO_EQUIPE) {
      throw new BadRequestException(
        `Limite de ${MAX_LINHAS_IMPORTACAO_EQUIPE} membros por importação.`,
      );
    }

    if (senhaPadrao?.trim()) {
      try {
        assertSenhaForte(senhaPadrao.trim());
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error
            ? `Senha padrão inválida: ${err.message}`
            : 'Senha padrão inválida',
        );
      }
    }

    const resultados: ResultadoLinhaImportacaoEquipe[] = [];
    let criados = 0;
    let duplicados = 0;
    let erros = 0;
    const emailsNoArquivo = new Set<string>();

    for (const linha of linhas) {
      const nome = linha.nome?.trim();
      const email = linha.email?.trim().toLowerCase();
      if (!nome || nome.length < 2) {
        erros += 1;
        resultados.push({
          linha: linha.linha,
          status: 'erro',
          motivo: 'Nome obrigatório (mín. 2 caracteres)',
        });
        continue;
      }
      if (!email || !email.includes('@')) {
        erros += 1;
        resultados.push({
          linha: linha.linha,
          status: 'erro',
          nome,
          motivo: 'E-mail inválido',
        });
        continue;
      }
      if (emailsNoArquivo.has(email)) {
        duplicados += 1;
        resultados.push({
          linha: linha.linha,
          status: 'duplicado',
          nome,
          email,
          motivo: 'E-mail repetido neste arquivo',
        });
        continue;
      }
      emailsNoArquivo.add(email);

      const role = normalizarRoleEquipe(linha.role);
      if (!role) {
        erros += 1;
        resultados.push({
          linha: linha.linha,
          status: 'erro',
          nome,
          email,
          motivo: 'Papel inválido. Use ADMIN, ADVOGADO ou ASSISTENTE',
        });
        continue;
      }

      const cargo =
        linha.cargo?.trim() || cargoPadraoPorRole(role);
      const status = normalizarStatusEquipe(linha.status);
      const senha = linha.senha?.trim() || senhaPadrao?.trim() || undefined;

      try {
        const criado = await this.criar(
          { nome, email, cargo, role, status, senha },
          { silencioso: true },
        );
        criados += 1;
        resultados.push({
          linha: linha.linha,
          status: 'criado',
          nome: criado.nome,
          email: criado.email,
          membroId: criado.id,
        });
      } catch (err) {
        if (err instanceof ConflictException) {
          duplicados += 1;
          resultados.push({
            linha: linha.linha,
            status: 'duplicado',
            nome,
            email,
            motivo: mensagemErroImportacao(err),
          });
          continue;
        }
        erros += 1;
        resultados.push({
          linha: linha.linha,
          status: 'erro',
          nome,
          email,
          motivo: mensagemErroImportacao(err),
        });
      }
    }

    return {
      total: linhas.length,
      criados,
      duplicados,
      erros,
      resultados,
    };
  }

  async listarTodos() {
    const membros = await this.prisma.membroEquipe.findMany({
      orderBy: { criadoEm: 'desc' },
      include: membroInclude,
    });
    return Promise.all(membros.map((m) => this.withSignedAvatar(m)));
  }

  async atualizar(id: string, dados: UpdateMembroDto) {
    const atual = await this.prisma.membroEquipe.findUnique({ where: { id } });
    if (!atual) {
      throw new NotFoundException('Membro não encontrado');
    }

    const email =
      dados.email !== undefined ? dados.email.trim().toLowerCase() : undefined;

    if (email && email !== atual.email) {
      const conflito = await this.prisma.membroEquipe.findUnique({
        where: { email },
      });
      if (conflito && conflito.id !== id) {
        throw new ConflictException('Já existe um membro com este e-mail');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const membro = await tx.membroEquipe.update({
        where: { id },
        data: {
          ...(dados.nome !== undefined ? { nome: dados.nome.trim() } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(dados.cargo !== undefined ? { cargo: dados.cargo.trim() } : {}),
          ...(dados.status !== undefined ? { status: dados.status } : {}),
        },
        include: membroInclude,
      });

      if (membro.usuarioId) {
        const userData: Prisma.UsuarioUpdateInput = {};
        if (dados.nome !== undefined) userData.nome = dados.nome.trim();
        if (email !== undefined) userData.email = email;
        if (dados.role !== undefined) {
          if (!Object.values(Role).includes(dados.role)) {
            throw new BadRequestException('Papel inválido');
          }
          userData.role = dados.role;
        }

        if (Object.keys(userData).length > 0) {
          await tx.usuario.update({
            where: { id: membro.usuarioId },
            data: userData,
          });
        }
      }

      return this.withSignedAvatar(
        await tx.membroEquipe.findUniqueOrThrow({
          where: { id },
          include: membroInclude,
        }),
      );
    });
  }

  async remover(id: string) {
    const membro = await this.prisma.membroEquipe.findUnique({ where: { id } });
    if (!membro) {
      throw new NotFoundException('Membro não encontrado');
    }

    // Remove só o vínculo na equipe; a conta de login permanece
    return this.prisma.membroEquipe.delete({
      where: { id },
      include: membroInclude,
    });
  }

  /** Garante registro na equipe ao criar usuário (auth/admin/register). */
  async ensureMembroForUsuario(usuario: {
    id: string;
    nome: string;
    email: string;
    role: Role;
  }) {
    const email = usuario.email.trim().toLowerCase();
    const existingByUser = await this.prisma.membroEquipe.findUnique({
      where: { usuarioId: usuario.id },
    });
    if (existingByUser) {
      return existingByUser;
    }

    const existingByEmail = await this.prisma.membroEquipe.findUnique({
      where: { email },
    });
    if (existingByEmail) {
      if (!existingByEmail.usuarioId) {
        return this.prisma.membroEquipe.update({
          where: { id: existingByEmail.id },
          data: {
            usuarioId: usuario.id,
            nome: usuario.nome,
          },
          include: membroInclude,
        });
      }
      return existingByEmail;
    }

    return this.prisma.membroEquipe.create({
      data: {
        nome: usuario.nome,
        email,
        cargo: cargoPadraoPorRole(usuario.role),
        status: 'active',
        usuarioId: usuario.id,
      },
      include: membroInclude,
    });
  }
}
