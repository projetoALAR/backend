import { Test, TestingModule } from '@nestjs/testing';
import { ModelosDocumentoController } from './modelos-documento.controller';
import { ModelosDocumentoService } from './modelos-documento.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import { Role } from '../auth/roles';

describe('ModelosDocumentoController', () => {
  let controller: ModelosDocumentoController;
  const service = {
    criar: jest.fn(),
    listarTodos: jest.fn(),
    buscarPorId: jest.fn(),
    atualizar: jest.fn(),
    remover: jest.fn(),
    previsualizar: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelosDocumentoController],
      providers: [
        { provide: ModelosDocumentoService, useValue: service },
        { provide: CasoAcessoService, useValue: { assertPodeVer: jest.fn() } },
      ],
    }).compile();

    controller = module.get(ModelosDocumentoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('criar delega ao service', async () => {
    service.criar.mockResolvedValue({ id: 'm1' });
    const dto = {
      nome: 'Modelo',
      categoria: 'Petição',
      conteudo: 'texto',
    };
    await expect(controller.criar(dto)).resolves.toEqual({ id: 'm1' });
    expect(service.criar).toHaveBeenCalledWith(dto);
  });

  it('listarTodos passa categoria da query', async () => {
    service.listarTodos.mockResolvedValue([]);
    await controller.listarTodos('Contrato');
    expect(service.listarTodos).toHaveBeenCalledWith('Contrato');
  });

  it('preview delega previsualizar', async () => {
    service.previsualizar.mockResolvedValue({ texto: 'ok' });
    await expect(
      controller.preview('m1', 'p1', { id: 'u1', role: Role.ADMIN }),
    ).resolves.toEqual({
      texto: 'ok',
    });
    expect(service.previsualizar).toHaveBeenCalledWith('m1', 'p1');
  });

  it('remover delega ao service', async () => {
    service.remover.mockResolvedValue({ id: 'm1' });
    await controller.remover('m1');
    expect(service.remover).toHaveBeenCalledWith('m1');
  });
});
