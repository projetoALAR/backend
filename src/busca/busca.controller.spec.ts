import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { BuscaController } from './busca.controller';
import { BuscaService } from './busca.service';
import { ROLES_KEY } from '../auth/roles.decorator';
import { Role } from '../auth/roles';

describe('BuscaController', () => {
  let controller: BuscaController;
  const buscaService = {
    buscar: jest.fn(),
  };
  const assistente = { id: 'u1', role: Role.ASSISTENTE };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BuscaController],
      providers: [{ provide: BuscaService, useValue: buscaService }],
    }).compile();
    controller = module.get(BuscaController);
  });

  it('busca delega ao BuscaService com o usuário autenticado (RBAC aplicado no service)', async () => {
    buscaService.buscar.mockResolvedValue({ resultados: [] });
    await expect(
      controller.buscar({ q: 'maria', limit: '10' }, assistente),
    ).resolves.toEqual({ resultados: [] });
    expect(buscaService.buscar).toHaveBeenCalledWith(assistente, 'maria', 10);
  });

  it('usa limite padrão de 20 quando não informado ou inválido', async () => {
    buscaService.buscar.mockResolvedValue({ resultados: [] });

    await controller.buscar({ q: 'ana' }, assistente);
    expect(buscaService.buscar).toHaveBeenCalledWith(assistente, 'ana', 20);

    await controller.buscar({ q: 'ana', limit: 'abc' }, assistente);
    expect(buscaService.buscar).toHaveBeenLastCalledWith(assistente, 'ana', 20);
  });

  it('todos os papéis autenticados podem pesquisar (dados filtrados por role no service)', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- leitura de metadata, não chamada do método
    const handler = BuscaController.prototype.buscar;
    const roles = Reflect.getMetadata(ROLES_KEY, handler) as Role[];
    expect(roles).toEqual(
      expect.arrayContaining([Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE]),
    );
    expect(roles).toHaveLength(3);
  });
});
