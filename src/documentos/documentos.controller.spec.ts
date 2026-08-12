import { Test, TestingModule } from '@nestjs/testing';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';

describe('DocumentosController', () => {
  let controller: DocumentosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentosController],
      providers: [
        {
          provide: DocumentosService,
          useValue: {
            fazerUpload: jest.fn(),
            listarPorProcesso: jest.fn(),
            remover: jest.fn(),
          },
        },
        {
          provide: AuditoriaService,
          useValue: { registrar: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: CasoAcessoService,
          useValue: { assertPodeVer: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<DocumentosController>(DocumentosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
