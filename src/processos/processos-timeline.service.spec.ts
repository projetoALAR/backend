import { ProcessosTimelineService } from './processos-timeline.service';
import { PrismaService } from '../prisma.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import { Role } from '../auth/roles';

describe('ProcessosTimelineService', () => {
  const processoId = 'p1';
  const user = { id: 'u1', role: Role.ADVOGADO };
  const criadoEm = new Date('2026-01-01T10:00:00Z');

  const prisma = {
    processo: {
      findUnique: jest.fn().mockResolvedValue({
        id: processoId,
        titulo: 'Caso teste',
        numero: '123',
        criadoEm,
        documentos: [
          {
            id: 'd1',
            nome: 'peticao.pdf',
            criadoEm: new Date('2026-01-02T10:00:00Z'),
          },
        ],
        compromissos: [],
        andamentos: [],
        comentarios: [
          {
            id: 'c1',
            texto: 'Revisar docs',
            criadoEm: new Date('2026-01-03T10:00:00Z'),
            usuario: { nome: 'Ana', email: 'ana@alar.com.br' },
          },
        ],
      }),
    },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    processoComentario: { create: jest.fn() },
  };

  const casoAcesso = {
    assertPodeVer: jest.fn(),
  };

  const service = new ProcessosTimelineService(
    prisma as unknown as PrismaService,
    casoAcesso as unknown as CasoAcessoService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('agrega eventos ordenados do mais recente', async () => {
    const { eventos } = await service.listar(processoId, user);
    expect(casoAcesso.assertPodeVer).toHaveBeenCalledWith(user, processoId);
    expect(eventos[0].tipo).toBe('COMENTARIO');
    expect(eventos.some((e) => e.tipo === 'CASO_CRIADO')).toBe(true);
    expect(eventos.some((e) => e.tipo === 'DOCUMENTO')).toBe(true);
  });

  it('cria comentário interno', async () => {
    prisma.processoComentario.create.mockResolvedValue({
      id: 'c2',
      texto: 'Ok',
      criadoEm: new Date(),
      usuario: { nome: 'Ana', email: 'ana@alar.com.br' },
    });
    const result = await service.comentar(processoId, user, '  Ok  ');
    expect(result.texto).toBe('Ok');
    expect(prisma.processoComentario.create).toHaveBeenCalled();
  });
});
