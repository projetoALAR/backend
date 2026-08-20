import { StreamableFile } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProcessosController } from './processos.controller';
import { ProcessosService } from './processos.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ProcessosTimelineService } from './processos-timeline.service';
import { ProcessosCapaService } from './processos-capa.service';
import { Role } from '../auth/roles';

describe('ProcessosController', () => {
  let controller: ProcessosController;
  const processosService = {
    criar: jest.fn(),
    listarTodos: jest.fn(),
    listarPorCliente: jest.fn(),
    buscarPorId: jest.fn(),
    atualizar: jest.fn(),
    remover: jest.fn(),
    modeloCsvImportacao: jest.fn().mockReturnValue('numero,status\n'),
    modeloXlsxImportacao: jest.fn().mockResolvedValue(Buffer.from('xlsx')),
    importarCsv: jest.fn(),
    importarArquivo: jest.fn(),
  };
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const timeline = {
    listar: jest.fn(),
    comentar: jest.fn(),
  };
  const capa = { gerar: jest.fn() };
  const ator = { id: 'u1', role: Role.ADVOGADO };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcessosController],
      providers: [
        { provide: ProcessosService, useValue: processosService },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: ProcessosTimelineService, useValue: timeline },
        { provide: ProcessosCapaService, useValue: capa },
      ],
    }).compile();

    controller = module.get(ProcessosController);
  });

  it('importa arquivo e registra auditoria', async () => {
    const resultado = {
      total: 1,
      criados: 1,
      duplicados: 0,
      erros: 0,
      resultados: [],
    };
    processosService.importarArquivo.mockResolvedValue(resultado);
    const arquivo = {
      buffer: Buffer.from('numero,status,clienteCpf\n1,Em andamento,123\n'),
      originalname: 'casos.csv',
      mimetype: 'text/csv',
    } as Express.Multer.File;

    await expect(controller.importar(arquivo, ator)).resolves.toEqual(
      resultado,
    );
    expect(processosService.importarArquivo).toHaveBeenCalledWith(
      arquivo.buffer,
      'casos.csv',
      'text/csv',
      'u1',
      undefined,
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'CRIAR',
        entidade: 'PROCESSO',
        resumo: expect.stringContaining('Importação'),
      }),
    );
  });

  it('cria caso e registra auditoria', async () => {
    const processo = { id: 'p1', titulo: 'Caso A', numero: '1' };
    processosService.criar.mockResolvedValue(processo);

    await expect(
      controller.criar(
        { numero: '1', clienteId: 'c1', status: 'Em andamento' },
        ator,
      ),
    ).resolves.toEqual(processo);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'CRIAR', entidade: 'PROCESSO' }),
    );
  });

  it('lista por cliente, todos e por id', async () => {
    const processo = { id: 'p1', titulo: 'Caso', numero: '1' };
    processosService.listarPorCliente.mockResolvedValue([]);
    processosService.listarTodos.mockResolvedValue([]);
    processosService.buscarPorId.mockResolvedValue(processo);
    await expect(controller.listarPorCliente('c1', ator)).resolves.toEqual([]);
    await expect(controller.listarTodos(ator)).resolves.toEqual([]);
    await expect(controller.buscarPorId('p1', ator)).resolves.toEqual(processo);
  });

  it('devolve PDF da capa', async () => {
    capa.gerar.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4'),
      filename: 'capa-caso.pdf',
    });
    const arquivo = await controller.baixarCapa('p1', ator);
    expect(arquivo).toBeInstanceOf(StreamableFile);
    expect(capa.gerar).toHaveBeenCalledWith('p1', ator);
  });

  it('delega timeline e comentário', async () => {
    timeline.listar.mockResolvedValue([]);
    timeline.comentar.mockResolvedValue({ id: 'cm1' });
    await expect(controller.timelineDoProcesso('p1', ator)).resolves.toEqual(
      [],
    );
    await expect(
      controller.comentarProcesso('p1', { texto: 'ok' }, ator),
    ).resolves.toEqual({ id: 'cm1' });
  });

  it('atualiza e remove com auditoria', async () => {
    const processo = { id: 'p1', titulo: 'Caso', numero: '1' };
    processosService.atualizar.mockResolvedValue(processo);
    processosService.remover.mockResolvedValue(processo);

    await expect(controller.atualizar('p1', {}, ator)).resolves.toEqual(
      processo,
    );
    await expect(controller.remover('p1', ator)).resolves.toEqual(processo);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'EDITAR' }),
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'EXCLUIR' }),
    );
  });
});
