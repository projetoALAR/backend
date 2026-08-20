import { EquipeService, cargoPadraoPorRole } from './equipe.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { DocumentosService } from '../documentos/documentos.service';
import { Role } from '../auth/roles';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('EquipeService', () => {
  const prisma = {
    membroEquipe: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    usuario: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    preferencia: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const notificacoes = {
    notificarTodosUsuarios: jest.fn(),
    enviarEmailTransacional: jest.fn().mockResolvedValue({ sent: true }),
    appPublicUrl: jest.fn().mockReturnValue('http://localhost:3000'),
    criarInbox: jest.fn().mockResolvedValue({}),
  };

  const documentos = {
    resolveSignedUrl: jest.fn((url: string) => `signed:${url}`),
  };

  let service: EquipeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EquipeService(
      prisma as unknown as PrismaService,
      notificacoes as unknown as NotificacoesService,
      documentos as unknown as DocumentosService,
    );
  });

  it('cargoPadraoPorRole cobre os papéis', () => {
    expect(cargoPadraoPorRole(Role.ADMIN)).toBe('Administrador');
    expect(cargoPadraoPorRole(Role.ADVOGADO)).toBe('Advogado');
    expect(cargoPadraoPorRole(Role.ASSISTENTE)).toBe('Assistente');
  });

  it('ensureMembroForUsuario cria membro quando não existe', async () => {
    prisma.membroEquipe.findUnique
      .mockResolvedValueOnce(null) // by usuarioId
      .mockResolvedValueOnce(null); // by email
    prisma.membroEquipe.create.mockResolvedValue({
      id: 'm1',
      nome: 'Ana',
      email: 'ana@alar.com.br',
      cargo: 'Assistente',
      usuarioId: 'u1',
      usuario: { id: 'u1', role: Role.ASSISTENTE, fotoUrl: null },
    });

    const membro = await service.ensureMembroForUsuario({
      id: 'u1',
      nome: 'Ana',
      email: 'ana@alar.com.br',
      role: Role.ASSISTENTE,
    });

    expect(membro.id).toBe('m1');
    expect(prisma.membroEquipe.create).toHaveBeenCalled();
  });

  it('criar exige senha quando e-mail não tem usuário', async () => {
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    prisma.membroEquipe.findUnique.mockResolvedValue(null);
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      service.criar({
        nome: 'Bob',
        email: 'bob@alar.com.br',
        cargo: 'Estagiário',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('criar rejeita e-mail já na equipe', async () => {
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    prisma.membroEquipe.findUnique.mockResolvedValue({ id: 'm-exist' });

    await expect(
      service.criar({
        nome: 'Bob',
        email: 'bob@alar.com.br',
        cargo: 'Estagiário',
        senha: 'senha-forte',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('importarArquivo cria membro e marca e-mail inválido sem parar o lote', async () => {
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    prisma.membroEquipe.findUnique.mockResolvedValue(null);
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({
      id: 'u-new',
      nome: 'Ana',
      email: 'ana@alar.com.br',
      role: Role.ASSISTENTE,
    });
    prisma.preferencia.create.mockResolvedValue({});
    prisma.membroEquipe.create.mockResolvedValue({
      id: 'm-new',
      nome: 'Ana',
      email: 'ana@alar.com.br',
      cargo: 'Assistente',
      status: 'active',
      usuarioId: 'u-new',
      usuario: { id: 'u-new', role: Role.ASSISTENTE, fotoUrl: null },
    });

    const csv = [
      'Nome,E-mail,Papel,Senha',
      'Ana,ana@alar.com.br,ASSISTENTE,AlarTrocar123',
      'Sem Email,nao-email,ASSISTENTE,AlarTrocar123',
    ].join('\n');

    const resultado = await service.importarArquivo(
      Buffer.from(csv, 'utf8'),
      'equipe.csv',
      'text/csv',
      null,
      'AlarTrocar123',
    );

    expect(resultado.criados).toBe(1);
    expect(resultado.erros).toBe(1);
    expect(resultado.resultados.some((r) => r.status === 'erro')).toBe(true);
  });

  it('importarArquivo rejeita mapeamento sem nome/email', async () => {
    const csv = 'ColA,ColB\nx,y\n';
    await expect(
      service.importarArquivo(
        Buffer.from(csv, 'utf8'),
        'equipe.csv',
        'text/csv',
        { '0': 'cargo' },
        'AlarTrocar123',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
