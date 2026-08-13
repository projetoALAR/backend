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

  async criar(dados: CreateMembroDto) {
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

        usuario = await tx.usuario.create({
          data: {
            nome,
            email,
            senhaHash: await bcrypt.hash(dados.senha, 10),
            role,
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

    await this.notificacoes.notificarTodosUsuarios(
      'Novo membro na equipe',
      `${membro.nome} (${membro.cargo}) foi adicionado à equipe.`,
      '/equipe',
      'teamUpdates',
    );

    return this.withSignedAvatar(membro);
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
