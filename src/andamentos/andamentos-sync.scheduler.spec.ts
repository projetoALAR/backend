import { AndamentosSyncScheduler } from './andamentos-sync.scheduler';
import { AndamentosService } from './andamentos.service';
import { PrismaService } from '../prisma.service';

describe('AndamentosSyncScheduler', () => {
  const prisma = {
    processo: {
      findMany: jest.fn(),
    },
  };

  const andamentos = {
    sincronizarProcesso: jest.fn(),
  };

  let scheduler: AndamentosSyncScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new AndamentosSyncScheduler(
      prisma as unknown as PrismaService,
      andamentos as unknown as AndamentosService,
    );
  });

  it('itera processos abertos e continua se um falhar', async () => {
    prisma.processo.findMany.mockResolvedValue([
      { id: 'p1', numero: '1' },
      { id: 'p2', numero: '2' },
      { id: 'p3', numero: '3' },
    ]);
    andamentos.sincronizarProcesso
      .mockResolvedValueOnce({ processoId: 'p1', inseridos: 1 })
      .mockRejectedValueOnce(new Error('falha DataJud'))
      .mockResolvedValueOnce({ processoId: 'p3', inseridos: 0 });

    await scheduler.sincronizarProcessosAbertos();

    expect(prisma.processo.findMany).toHaveBeenCalledWith({
      where: { concluido: false },
      select: { id: true, numero: true },
    });
    expect(andamentos.sincronizarProcesso).toHaveBeenCalledTimes(3);
    expect(andamentos.sincronizarProcesso).toHaveBeenNthCalledWith(1, 'p1');
    expect(andamentos.sincronizarProcesso).toHaveBeenNthCalledWith(2, 'p2');
    expect(andamentos.sincronizarProcesso).toHaveBeenNthCalledWith(3, 'p3');
  });

  it('não chama DataJud direto — delega ao AndamentosService', async () => {
    prisma.processo.findMany.mockResolvedValue([{ id: 'p1', numero: '1' }]);
    andamentos.sincronizarProcesso.mockResolvedValue({
      processoId: 'p1',
      inseridos: 0,
    });

    await scheduler.sincronizarProcessosAbertos();

    expect(andamentos.sincronizarProcesso).toHaveBeenCalledWith('p1');
  });
});
