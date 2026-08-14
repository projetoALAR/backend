import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '../auth/roles';
import { CasoAcessoService } from './caso-acesso.service';
import { PrismaService } from '../prisma.service';

describe('CasoAcessoService', () => {
  const prisma = {
    processo: { findUnique: jest.fn() },
  };
  const service = new CasoAcessoService(prisma as unknown as PrismaService);

  const assistente = { id: 'a1', role: Role.ASSISTENTE };
  const advogado = { id: 'd1', role: Role.ADVOGADO };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('assistente só vê casos em que é responsável ou co-responsável', () => {
    expect(service.visibilidadeProcesso(assistente)).toEqual({
      OR: [{ responsavelId: 'a1' }, { coResponsavelId: 'a1' }],
    });
    expect(service.visibilidadeProcesso(advogado)).toEqual({});
  });

  it('bloqueia assistente em caso não atribuído', async () => {
    prisma.processo.findUnique.mockResolvedValue({
      id: 'p1',
      responsavelId: 'outro',
      coResponsavelId: null,
    });
    await expect(
      service.assertPodeVer(assistente, 'p1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('libera assistente atribuído e advogado em qualquer caso', async () => {
    prisma.processo.findUnique.mockResolvedValue({
      id: 'p1',
      responsavelId: 'a1',
      coResponsavelId: null,
    });
    await expect(
      service.assertPodeVer(assistente, 'p1'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertPodeVer(advogado, 'p1'),
    ).resolves.toBeUndefined();
  });

  it('404 se o processo não existe', async () => {
    prisma.processo.findUnique.mockResolvedValue(null);
    await expect(
      service.assertPodeVer(advogado, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
