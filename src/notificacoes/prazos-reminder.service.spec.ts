import {
  PrazosReminderService,
  diasAte,
  rotuloJanela,
} from './prazos-reminder.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from './notificacoes.service';

describe('PrazosReminderService', () => {
  const prisma = {
    processo: { findMany: jest.fn().mockResolvedValue([]) },
    compromisso: { findMany: jest.fn().mockResolvedValue([]) },
    usuario: {
      findMany: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]),
    },
  };

  const notificacoes = {
    notificarComDedup: jest.fn().mockResolvedValue(true),
  };

  const service = new PrazosReminderService(
    prisma as unknown as PrismaService,
    notificacoes as unknown as NotificacoesService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calcula dias até o prazo', () => {
    const ref = new Date('2026-08-12T15:00:00');
    expect(diasAte(new Date('2026-08-12T09:00:00'), ref)).toBe(0);
    expect(diasAte(new Date('2026-08-13T09:00:00'), ref)).toBe(1);
    expect(rotuloJanela(3)).toBe('em 3 dias');
  });

  it('notifica responsáveis do processo na janela correta', async () => {
    prisma.processo.findMany.mockResolvedValue([
      {
        id: 'p1',
        titulo: 'Ação',
        numero: '123',
        prazo: new Date('2026-08-13T12:00:00'),
        responsavelId: 'u1',
        coResponsavelId: null,
      },
    ]);

    const ref = new Date('2026-08-12T08:00:00');
    const res = await service.executar(ref);

    expect(res.enviados).toBe(1);
    expect(notificacoes.notificarComDedup).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 'u1',
        tipo: 'prazo-lembrete',
      }),
    );
  });
});
