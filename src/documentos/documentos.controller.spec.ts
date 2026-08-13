import { Test, TestingModule } from '@nestjs/testing';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import { Role } from '../auth/roles';

describe('DocumentosController', () => {
  let controller: DocumentosController;
  const documentosService = {
    fazerUpload: jest.fn(),
    listarPorProcesso: jest.fn(),
    remover: jest.fn(),
  };
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const casoAcesso = { assertPodeVer: jest.fn().mockResolvedValue(undefined) };
  const ator = { id: 'u1', role: Role.ADVOGADO };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentosController],
      providers: [
        { provide: DocumentosService, useValue: documentosService },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: CasoAcessoService, useValue: casoAcesso },
      ],
    }).compile();

    controller = module.get(DocumentosController);
  });

  it('faz upload após checar acesso e registra auditoria', async () => {
    const doc = { id: 'd1', nome: 'a.pdf' };
    documentosService.fazerUpload.mockResolvedValue(doc);
    const arquivo = { originalname: 'a.pdf' } as Express.Multer.File;

    await expect(
      controller.upload(arquivo, { processoId: 'p1' }, ator),
    ).resolves.toEqual(doc);
    expect(casoAcesso.assertPodeVer).toHaveBeenCalledWith(ator, 'p1');
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'CRIAR', entidade: 'DOCUMENTO' }),
    );
  });

  it('lista por processo após checar acesso', async () => {
    documentosService.listarPorProcesso.mockResolvedValue([]);
    await expect(controller.listarPorProcesso('p1', ator)).resolves.toEqual([]);
    expect(casoAcesso.assertPodeVer).toHaveBeenCalledWith(ator, 'p1');
  });

  it('remove e registra auditoria', async () => {
    const doc = { id: 'd1', nome: 'a.pdf' };
    documentosService.remover.mockResolvedValue(doc);
    await expect(controller.remover('d1', ator)).resolves.toEqual(doc);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'EXCLUIR' }),
    );
  });
});
