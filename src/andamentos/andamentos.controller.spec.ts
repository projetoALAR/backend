import { Test, TestingModule } from '@nestjs/testing';
import { AndamentosController } from './andamentos.controller';
import { AndamentosService } from './andamentos.service';
import { CasoAcessoService } from '../casos-acesso/caso-acesso.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Role } from '../auth/roles';

describe('AndamentosController', () => {
  let controller: AndamentosController;
  const andamentosService = {
    listarPorProcesso: jest.fn(),
    criarManual: jest.fn(),
    sincronizarProcesso: jest.fn(),
    removerManual: jest.fn(),
  };
  const casoAcesso = { assertPodeVer: jest.fn().mockResolvedValue(undefined) };
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const user = { id: 'u1', role: Role.ADVOGADO, nome: 'Ana' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AndamentosController],
      providers: [
        { provide: AndamentosService, useValue: andamentosService },
        { provide: CasoAcessoService, useValue: casoAcesso },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    }).compile();
    controller = module.get(AndamentosController);
  });

  it('lista andamentos após checar acesso', async () => {
    andamentosService.listarPorProcesso.mockResolvedValue([]);
    await expect(controller.listarPorProcesso('p1', user)).resolves.toEqual([]);
    expect(casoAcesso.assertPodeVer).toHaveBeenCalledWith(user, 'p1');
  });

  it('cria andamento manual com auditoria', async () => {
    const criado = { id: 'a1', descricao: 'Protocolado' };
    andamentosService.criarManual.mockResolvedValue(criado);
    await expect(
      controller.criarManual('p1', { descricao: 'Protocolado' }, user),
    ).resolves.toEqual(criado);
    expect(andamentosService.criarManual).toHaveBeenCalledWith(
      'p1',
      { descricao: 'Protocolado' },
      'u1',
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'CRIAR', entidade: 'ANDAMENTO' }),
    );
  });

  it('exclui andamento manual com auditoria', async () => {
    const removido = { id: 'a1', descricao: 'Protocolado' };
    andamentosService.removerManual.mockResolvedValue(removido);
    await expect(controller.removerManual('p1', 'a1', user)).resolves.toEqual(
      removido,
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'EXCLUIR', entidade: 'ANDAMENTO' }),
    );
  });
});
