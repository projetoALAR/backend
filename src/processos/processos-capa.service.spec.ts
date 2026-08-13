import { NotFoundException } from '@nestjs/common';
import { ProcessosCapaService } from './processos-capa.service';
import { PrismaService } from '../prisma.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';

describe('ProcessosCapaService', () => {
  const prisma = {
    processo: { findUnique: jest.fn() },
  };
  const casoAcesso = { assertPodeVer: jest.fn() };
  const service = new ProcessosCapaService(
    prisma as unknown as PrismaService,
    casoAcesso as unknown as CasoAcessoService,
  );
  const user = { id: 'u1', role: 'ADVOGADO' as const };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gera PDF a partir do caso visivel', async () => {
    prisma.processo.findUnique.mockResolvedValue({
      numero: '0001234-56.2024.8.26.0100',
      titulo: 'Acao de cobranca',
      status: 'Em andamento',
      prioridade: 'Alta',
      concluido: false,
      prazo: new Date('2026-09-01'),
      descricao: 'Cobranca de honorarios',
      cliente: {
        nome: 'Maria Silva',
        tipo: 'PF',
        cpf: '12345678901',
        cnpj: null,
        nomeFantasia: null,
        cidade: 'Sao Paulo',
        uf: 'SP',
      },
      responsavel: { nome: 'Dr. Ana', email: 'ana@alar.com.br' },
      coResponsavel: null,
      compromissos: [{ titulo: 'Audiencia', dataHora: new Date('2026-08-20') }],
      tarefas: [{ titulo: 'Protocolar', prazo: new Date('2026-08-18') }],
    });

    const { buffer, filename } = await service.gerar('p1', user);
    expect(casoAcesso.assertPodeVer).toHaveBeenCalledWith(user, 'p1');
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    expect(filename).toContain('capa-');
    expect(filename.endsWith('.pdf')).toBe(true);
  });

  it('404 se o caso nao existe', async () => {
    prisma.processo.findUnique.mockResolvedValue(null);
    await expect(service.gerar('p1', user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
