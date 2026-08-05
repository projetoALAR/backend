import { Test, TestingModule } from '@nestjs/testing';
import { ProcessosController } from './processos.controller';
import { ProcessosService } from './processos.service';

describe('ProcessosController', () => {
  let controller: ProcessosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcessosController],
      providers: [
        {
          provide: ProcessosService,
          useValue: {
            criar: jest.fn(),
            listarTodos: jest.fn(),
            listarPorCliente: jest.fn(),
            atualizar: jest.fn(),
            remover: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProcessosController>(ProcessosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
