import { Test, TestingModule } from '@nestjs/testing';
import { CompromissosService } from './compromissos.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';

describe('CompromissosService', () => {
  let service: CompromissosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompromissosService,
        { provide: PrismaService, useValue: { compromisso: {} } },
        {
          provide: NotificacoesService,
          useValue: { notificarTodosUsuarios: jest.fn() },
        },
        {
          provide: CasoAcessoService,
          useValue: {
            visibilidadeCompromisso: jest.fn().mockReturnValue({}),
            assertPodeVer: jest.fn(),
            precisaFiltrar: jest.fn().mockReturnValue(false),
          },
        },
      ],
    }).compile();

    service = module.get<CompromissosService>(CompromissosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lista compromissos do caso depois de checar acesso', async () => {
    const prisma = (service as unknown as { prisma: { compromisso: { findMany: jest.Mock } } })
      .prisma;
    const casoAcesso = (
      service as unknown as { casoAcesso: { assertPodeVer: jest.Mock } }
    ).casoAcesso;
    prisma.compromisso = { findMany: jest.fn().mockResolvedValue([]) };
    const user = { id: 'u1', role: 'ADVOGADO' };
    await expect(service.listarPorProcesso('p1', user as never)).resolves.toEqual(
      [],
    );
    expect(casoAcesso.assertPodeVer).toHaveBeenCalledWith(user, 'p1');
    expect(prisma.compromisso.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { processoId: 'p1' } }),
    );
  });
});
