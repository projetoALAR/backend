import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConsultaProcessualController } from './consulta-processual.controller';
import { AndamentosService } from './andamentos.service';
import { ROLES_KEY } from '../auth/roles.decorator';
import { Role } from '../auth/roles';

describe('ConsultaProcessualController', () => {
  let controller: ConsultaProcessualController;
  const andamentosService = {
    consultarPublico: jest.fn(),
  };
  const user = { id: 'u1', role: Role.ASSISTENTE };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsultaProcessualController],
      providers: [{ provide: AndamentosService, useValue: andamentosService }],
    }).compile();
    controller = module.get(ConsultaProcessualController);
  });

  it('consultar delega ao AndamentosService com número e usuário autenticado', async () => {
    const resposta = { ok: true, numero: '1000123-45.2024.8.26.0100' };
    andamentosService.consultarPublico.mockResolvedValue(resposta);

    await expect(
      controller.consultar({ numero: '1000123-45.2024.8.26.0100' }, user),
    ).resolves.toEqual(resposta);
    expect(andamentosService.consultarPublico).toHaveBeenCalledWith(
      '1000123-45.2024.8.26.0100',
      user,
    );
  });

  it('qualquer papel autenticado pode consultar (visibilidade do caso filtrada no service)', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- leitura de metadata, não chamada do método
    const handler = ConsultaProcessualController.prototype.consultar;
    const roles = Reflect.getMetadata(ROLES_KEY, handler) as Role[];
    expect(roles).toEqual(
      expect.arrayContaining([Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE]),
    );
    expect(roles).toHaveLength(3);
  });
});
