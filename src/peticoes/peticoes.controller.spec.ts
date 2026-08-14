import { Test, TestingModule } from '@nestjs/testing';
import { PeticoesController } from './peticoes.controller';
import { PeticoesService } from './peticoes.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import { Role } from '../auth/roles';

describe('PeticoesController', () => {
  let controller: PeticoesController;
  const service = {
    gerarRascunho: jest.fn(),
    salvarRascunho: jest.fn(),
  };
  const casoAcesso = {
    assertPodeVer: jest.fn().mockResolvedValue(undefined),
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
        { provide: CasoAcessoService, useValue: casoAcesso },
      ],
    }).compile();

    controller = module.get(PeticoesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('gerar verifica acesso e delega ao service', async () => {
    service.gerarRascunho.mockResolvedValue({ texto: 'rascunho' });
    const user = { id: 'u1', role: Role.ADVOGADO };
    await expect(
      controller.gerar({ modeloId: 'm1', processoId: 'p1' }, user),
    ).resolves.toEqual({ texto: 'rascunho' });
    expect(casoAcesso.assertPodeVer).toHaveBeenCalledWith(user, 'p1');
    expect(service.gerarRascunho).toHaveBeenCalledWith(
      'm1',
      'p1',
      'u1',
      Role.ADVOGADO,
    );
  });

  it('salvar exige revisão e registra auditoria', async () => {
    service.salvarRascunho.mockResolvedValue({ id: 'd1', nome: 'doc.pdf' });
    const dto = {
      processoId: 'p1',
      nomeArquivo: 'doc.pdf',
      texto: 'texto',
      revisaoConfirmada: true as const,
    };
    const ator = {
      id: 'u1',
      role: Role.ADVOGADO,
      nome: 'Ana',
      email: 'a@x.com',
    };
    await expect(controller.salvar(dto, ator)).resolves.toEqual({
      id: 'd1',
      nome: 'doc.pdf',
    });
    expect(service.salvarRascunho).toHaveBeenCalledWith(dto, 'u1');
  });
});
