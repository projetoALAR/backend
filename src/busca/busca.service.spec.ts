import { BuscaService } from './busca.service';
import { PrismaService } from '../prisma.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import { Role } from '../auth/roles';

describe('BuscaService', () => {
  const user = { id: 'u1', role: Role.ADVOGADO };

  const prisma = {
    cliente: { findMany: jest.fn().mockResolvedValue([]) },
    processo: { findMany: jest.fn().mockResolvedValue([]) },
  };

  const casoAcesso = {
    visibilidadeCliente: jest.fn().mockReturnValue({}),
    visibilidadeProcesso: jest.fn().mockReturnValue({}),
  };

  const service = new BuscaService(
    prisma as unknown as PrismaService,
    casoAcesso as unknown as CasoAcessoService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna vazio com termo curto', async () => {
    const res = await service.buscar(user, 'a');
    expect(res.resultados).toEqual([]);
    expect(prisma.cliente.findMany).not.toHaveBeenCalled();
  });

  it('busca clientes e processos com RBAC', async () => {
    prisma.cliente.findMany.mockResolvedValue([
      { id: 'c1', nome: 'Maria', cpf: '123', cnpj: null, tipo: 'PF', email: null },
    ]);
    prisma.processo.findMany.mockResolvedValue([
      {
        id: 'p1',
        numero: '0001',
        titulo: 'Ação',
        status: 'Em andamento',
        cliente: { nome: 'Maria' },
      },
    ]);

    const res = await service.buscar(user, 'maria');
    expect(casoAcesso.visibilidadeCliente).toHaveBeenCalledWith(user);
    expect(casoAcesso.visibilidadeProcesso).toHaveBeenCalledWith(user);
    expect(res.resultados).toHaveLength(2);
    expect(res.resultados[0].tipo).toBe('CLIENTE');
    expect(res.resultados[1].tipo).toBe('PROCESSO');
  });
});
