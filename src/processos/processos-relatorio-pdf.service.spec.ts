import {
  MAX_LINHAS_RELATORIO_PDF,
  ProcessosRelatorioPdfService,
} from './processos-relatorio-pdf.service';

describe('ProcessosRelatorioPdfService', () => {
  const service = new ProcessosRelatorioPdfService();

  it('gera PDF com resumo e lista', async () => {
    const { buffer, filename } = await service.gerar({
      filtrosResumo: 'status=Em andamento',
      linhas: [
        {
          numero: '0001234-56.2024.8.26.0100',
          titulo: 'Cobranca',
          status: 'Em andamento',
          cliente: 'Maria',
          responsavel: 'Ana',
          prazo: '01/09/2026',
        },
        {
          numero: '2',
          status: 'Concluído',
          responsavel: 'Ana',
        },
      ],
    });
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    expect(filename).toMatch(/^relatorio-casos-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('aceita lista vazia', async () => {
    const { buffer } = await service.gerar({ linhas: [] });
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it(`limita a ${MAX_LINHAS_RELATORIO_PDF} linhas no PDF`, async () => {
    const linhas = Array.from({ length: MAX_LINHAS_RELATORIO_PDF + 3 }, (_, i) => ({
      numero: String(i + 1),
      status: 'Em andamento',
    }));
    const { buffer } = await service.gerar({ linhas });
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(100);
  });
});
