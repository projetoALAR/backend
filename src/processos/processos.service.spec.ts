import { Test, TestingModule } from '@nestjs/testing';
import { ProcessosService } from './processos.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';

describe('ProcessosService', () => {
  let service: ProcessosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessosService,
        { provide: PrismaService, useValue: { processo: {} } },
        {
          provide: NotificacoesService,
          useValue: { notificarTodosUsuarios: jest.fn() },
        },
        {
          provide: CasoAcessoService,
          useValue: {
            visibilidadeProcesso: jest.fn().mockReturnValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<ProcessosService>(ProcessosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
