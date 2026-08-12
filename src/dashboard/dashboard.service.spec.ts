import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: {
            cliente: { count: jest.fn() },
            processo: { count: jest.fn(), findMany: jest.fn() },
            compromisso: { count: jest.fn(), findMany: jest.fn() },
            membroEquipe: { count: jest.fn() },
          },
        },
        {
          provide: CasoAcessoService,
          useValue: {
            visibilidadeProcesso: jest.fn().mockReturnValue({}),
            visibilidadeCliente: jest.fn().mockReturnValue({}),
            visibilidadeCompromisso: jest.fn().mockReturnValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
