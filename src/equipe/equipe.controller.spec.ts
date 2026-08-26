import { Test, TestingModule } from '@nestjs/testing';
import { EquipeController } from './equipe.controller';
import { EquipeService } from './equipe.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('EquipeController', () => {
  let controller: EquipeController;
  const equipeService = {
    criar: jest.fn(),
    listarTodos: jest.fn(),
    atualizar: jest.fn(),
    remover: jest.fn(),
    modeloXlsx: jest.fn().mockResolvedValue(Buffer.from('xlsx')),
    previewArquivo: jest.fn(),
    importarArquivo: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EquipeController],
      providers: [
        { provide: EquipeService, useValue: equipeService },
        {
          provide: AuditoriaService,
          useValue: { registrar: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    controller = module.get(EquipeController);
  });

  it('importar arquiva CSV com senhaPadrao', async () => {
    const resultado = {
      total: 1,
      criados: 1,
      duplicados: 0,
      erros: 0,
      resultados: [],
    };
    equipeService.importarArquivo.mockResolvedValue(resultado);
    const arquivo = {
      buffer: Buffer.from('nome;email\nAna;ana@x.com\n'),
      originalname: 'equipe.csv',
      mimetype: 'text/csv',
    } as Express.Multer.File;

    await expect(
      controller.importar(arquivo, { id: 'admin' }, undefined, 'AlarTrocar123'),
    ).resolves.toEqual(resultado);
    expect(equipeService.importarArquivo).toHaveBeenCalledWith(
      arquivo.buffer,
      'equipe.csv',
      'text/csv',
      undefined,
      'AlarTrocar123',
    );
  });

  it('criar delega ao service', async () => {
    equipeService.criar.mockResolvedValue({ id: 'm1' });
    await expect(
      controller.criar(
        {
          nome: 'Ana',
          email: 'ana@alar.com.br',
          cargo: 'Advogada',
          senha: 'senha1234',
        },
        { id: 'admin' },
      ),
    ).resolves.toEqual({ id: 'm1' });
  });

  it('listarTodos retorna membros', async () => {
    equipeService.listarTodos.mockResolvedValue([{ id: 'm1' }]);
    await expect(controller.listarTodos()).resolves.toEqual([{ id: 'm1' }]);
  });

  it('atualizar e remover usam o id', async () => {
    equipeService.atualizar.mockResolvedValue({ id: 'm1', nome: 'Ana' });
    equipeService.remover.mockResolvedValue({ id: 'm1' });
    await expect(
      controller.atualizar('m1', { nome: 'Ana' }, { id: 'admin' }),
    ).resolves.toEqual({
      id: 'm1',
      nome: 'Ana',
    });
    await expect(controller.remover('m1')).resolves.toEqual({ id: 'm1' });
  });
});
