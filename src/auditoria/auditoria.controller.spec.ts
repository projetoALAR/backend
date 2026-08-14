import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';
import { ROLES_KEY } from '../auth/roles.decorator';
import { Role } from '../auth/roles';

describe('AuditoriaController', () => {
  let controller: AuditoriaController;
  const auditoria = {
    listar: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditoriaController],
      providers: [{ provide: AuditoriaService, useValue: auditoria }],
    }).compile();
    controller = module.get(AuditoriaController);
  });

  it('listar delega ao AuditoriaService com o filtro da query', async () => {
    const filtro = { entidade: 'PROCESSO', page: 1, limit: 20 };
    const pagina = { items: [], total: 0, page: 1, limit: 20 };
    auditoria.listar.mockResolvedValue(pagina);

    await expect(controller.listar(filtro)).resolves.toEqual(pagina);
    expect(auditoria.listar).toHaveBeenCalledWith(filtro);
  });

  it('só ADMIN pode acessar o log de auditoria (dado sensível)', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- leitura de metadata, não chamada do método
    const handler = AuditoriaController.prototype.listar;
    const roles = Reflect.getMetadata(ROLES_KEY, handler) as Role[];
    expect(roles).toEqual([Role.ADMIN]);
  });
});
