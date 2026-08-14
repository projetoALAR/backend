import { Test, TestingModule } from '@nestjs/testing';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { ClientesExtracaoService } from './clientes-extracao.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Role } from '../auth/roles';

describe('ClientesController', () => {
  let controller: ClientesController;
  const clientesExtracao = {
    extrairDeArquivo: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientesController],
      providers: [
        {
          provide: ClientesService,
          useValue: {
            criar: jest.fn(),
            listarTodos: jest.fn(),
            buscarPorId: jest.fn(),
            atualizar: jest.fn(),
            remover: jest.fn(),
            exportar: jest.fn(),
            anonimizar: jest.fn(),
          },
        },
        { provide: ClientesExtracaoService, useValue: clientesExtracao },
        {
          provide: AuditoriaService,
          useValue: { registrar: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    controller = module.get<ClientesController>(ClientesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('extrairDados delega ao ClientesExtracaoService com o usuário autenticado', async () => {
    const arquivo = { originalname: 'rg.png' } as Express.Multer.File;
    const ator = {
      id: 'u1',
      role: Role.ADVOGADO,
      nome: 'Ana',
      email: 'a@x.com',
    };
    clientesExtracao.extrairDeArquivo.mockResolvedValue({ nome: 'Fulano' });

    await expect(controller.extrairDados(arquivo, ator)).resolves.toEqual({
      nome: 'Fulano',
    });
    expect(clientesExtracao.extrairDeArquivo).toHaveBeenCalledWith(
      arquivo,
      'u1',
      Role.ADVOGADO,
      ator,
    );
  });
});
