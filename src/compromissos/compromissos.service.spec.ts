import { Test, TestingModule } from '@nestjs/testing';
import { CompromissosService } from './compromissos.service';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';

describe('CompromissosService', () => {
  let service: CompromissosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompromissosService,
        { provide: PrismaService, useValue: { compromisso: {} } },
        {
          provide: NotificacoesService,
          useValue: { notificarTodosUsuarios: jest.fn() },
        },
        {
          provide: CasoAcessoService,
          useValue: {
            visibilidadeCompromisso: jest.fn().mockReturnValue({}),
            assertPodeVer: jest.fn(),
            precisaFiltrar: jest.fn().mockReturnValue(false),
          },
        },
      ],
    }).compile();

    service = module.get<CompromissosService>(CompromissosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
