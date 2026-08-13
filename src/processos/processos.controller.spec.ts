import { Test, TestingModule } from '@nestjs/testing';
import { ProcessosController } from './processos.controller';
import { ProcessosService } from './processos.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ProcessosTimelineService } from './processos-timeline.service';
import { Role } from '../auth/roles';

describe('ProcessosController', () => {
  let controller: ProcessosController;
  const processosService = {
    criar: jest.fn(),
    listarTodos: jest.fn(),
    listarPorCliente: jest.fn(),
    atualizar: jest.fn(),
    remover: jest.fn(),
  };
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const timeline = {
    listar: jest.fn(),
    comentar: jest.fn(),
  };
  const ator = { id: 'u1', role: Role.ADVOGADO };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcessosController],
      providers: [
        { provide: ProcessosService, useValue: processosService },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: ProcessosTimelineService, useValue: timeline },
      ],
    }).compile();

    controller = module.get(ProcessosController);
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

  it('lista por cliente e todos', async () => {
    processosService.listarPorCliente.mockResolvedValue([]);
    processosService.listarTodos.mockResolvedValue([]);
    await expect(controller.listarPorCliente('c1', ator)).resolves.toEqual([]);
    await expect(controller.listarTodos(ator)).resolves.toEqual([]);
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
