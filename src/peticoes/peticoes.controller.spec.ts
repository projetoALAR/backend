import { Test, TestingModule } from '@nestjs/testing';
import { PeticoesController } from './peticoes.controller';
import { PeticoesService } from './peticoes.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('PeticoesController', () => {
  let controller: PeticoesController;
  const service = {
    gerarRascunho: jest.fn(),
    salvarRascunho: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PeticoesController],
      providers: [
        { provide: PeticoesService, useValue: service },
        {
          provide: AuditoriaService,
          useValue: { registrar: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    controller = module.get(PeticoesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('gerar delega ao service', async () => {
    service.gerarRascunho.mockResolvedValue({ texto: 'rascunho' });
    await expect(
      controller.gerar({ modeloId: 'm1', processoId: 'p1' }),
    ).resolves.toEqual({ texto: 'rascunho' });
    expect(service.gerarRascunho).toHaveBeenCalledWith('m1', 'p1');
  });

  it('salvar delega ao service', async () => {
    service.salvarRascunho.mockResolvedValue({ id: 'd1', nome: 'doc.pdf' });
    const dto = {
      processoId: 'p1',
      nomeArquivo: 'doc.pdf',
      texto: 'texto',
    };
    await expect(controller.salvar(dto, { id: 'u1' })).resolves.toEqual({
      id: 'd1',
      nome: 'doc.pdf',
    });
    expect(service.salvarRascunho).toHaveBeenCalledWith(dto);
  });
});
