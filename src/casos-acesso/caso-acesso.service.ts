import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { Role } from '../auth/roles';

export type CasoAcessoUser = { id: string; role: Role };

@Injectable()
export class CasoAcessoService {
  constructor(private readonly prisma: PrismaService) {}

  precisaFiltrar(user: CasoAcessoUser): boolean {
    return user.role === Role.ASSISTENTE;
  }

  visibilidadeProcesso(user: CasoAcessoUser): Prisma.ProcessoWhereInput {
    if (!this.precisaFiltrar(user)) return {};
    return {
      OR: [
        { responsavelId: user.id },
        { coResponsavelId: user.id },
      ],
    };
  }

  visibilidadeCliente(user: CasoAcessoUser): Prisma.ClienteWhereInput {
    if (!this.precisaFiltrar(user)) return {};
    return { processos: { some: this.visibilidadeProcesso(user) } };
  }

  visibilidadeCompromisso(
    user: CasoAcessoUser,
  ): Prisma.CompromissoWhereInput {
    if (!this.precisaFiltrar(user)) return {};
    return { processo: this.visibilidadeProcesso(user) };
  }

  async assertPodeVer(user: CasoAcessoUser, processoId: string) {
    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
      select: {
        id: true,
        responsavelId: true,
        coResponsavelId: true,
      },
    });
    if (!processo) {
      throw new NotFoundException('Processo não encontrado');
    }
    if (!this.precisaFiltrar(user)) return;
    const ok =
      processo.responsavelId === user.id ||
      processo.coResponsavelId === user.id;
    if (!ok) {
      throw new ForbiddenException('Você não tem acesso a este caso');
    }
  }
}
