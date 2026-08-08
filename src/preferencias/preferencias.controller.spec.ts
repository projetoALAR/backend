import { Test, TestingModule } from '@nestjs/testing';
import { PreferenciasController } from './preferencias.controller';
import { PreferenciasService } from './preferencias.service';

describe('PreferenciasController', () => {
  let controller: PreferenciasController;
  const preferenciasService = {
    obter: jest.fn(),
    atualizar: jest.fn(),
    atualizarFoto: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreferenciasController],
      providers: [
        { provide: PreferenciasService, useValue: preferenciasService },
      ],
    }).compile();
    controller = module.get(PreferenciasController);
  });

  it('obter usa o usuário autenticado', async () => {
    preferenciasService.obter.mockResolvedValue({ tema: 'light' });
    await expect(controller.obter({ id: 'u1' })).resolves.toEqual({
      tema: 'light',
    });
    expect(preferenciasService.obter).toHaveBeenCalledWith('u1');
  });

  it('atualizar encaminha body e userId', async () => {
    preferenciasService.atualizar.mockResolvedValue({ nome: 'Ana' });
    await expect(
      controller.atualizar({ nome: 'Ana' }, { id: 'u1' }),
    ).resolves.toEqual({ nome: 'Ana' });
    expect(preferenciasService.atualizar).toHaveBeenCalledWith(
      { nome: 'Ana' },
      'u1',
    );
  });

  it('atualizarFoto encaminha arquivo', async () => {
    const file = { originalname: 'a.png' } as Express.Multer.File;
    preferenciasService.atualizarFoto.mockResolvedValue({ fotoUrl: 'x' });
    await expect(controller.atualizarFoto(file, { id: 'u1' })).resolves.toEqual(
      { fotoUrl: 'x' },
    );
    expect(preferenciasService.atualizarFoto).toHaveBeenCalledWith(file, 'u1');
  });
});
