import { Test, TestingModule } from '@nestjs/testing';
import { EquipeController } from './equipe.controller';
import { EquipeService } from './equipe.service';

describe('EquipeController', () => {
  let controller: EquipeController;
  const equipeService = {
    criar: jest.fn(),
    listarTodos: jest.fn(),
    atualizar: jest.fn(),
    remover: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EquipeController],
      providers: [{ provide: EquipeService, useValue: equipeService }],
    }).compile();
    controller = module.get(EquipeController);
  });

  it('criar delega ao service', async () => {
    equipeService.criar.mockResolvedValue({ id: 'm1' });
    await expect(
      controller.criar({
        nome: 'Ana',
        email: 'ana@alar.com.br',
        cargo: 'Advogada',
        senha: 'senha1234',
      }),
    ).resolves.toEqual({ id: 'm1' });
  });

  it('listarTodos retorna membros', async () => {
    equipeService.listarTodos.mockResolvedValue([{ id: 'm1' }]);
    await expect(controller.listarTodos()).resolves.toEqual([{ id: 'm1' }]);
  });

  it('atualizar e remover usam o id', async () => {
    equipeService.atualizar.mockResolvedValue({ id: 'm1', nome: 'Ana' });
    equipeService.remover.mockResolvedValue({ id: 'm1' });
    await expect(controller.atualizar('m1', { nome: 'Ana' })).resolves.toEqual({
      id: 'm1',
      nome: 'Ana',
    });
    await expect(controller.remover('m1')).resolves.toEqual({ id: 'm1' });
  });
});
