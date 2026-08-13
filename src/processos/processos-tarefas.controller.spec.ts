import { Test, TestingModule } from '@nestjs/testing';
import { ProcessosTarefasController } from './processos-tarefas.controller';
import { ProcessosTarefasService } from './processos-tarefas.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Role } from '../auth/roles';

describe('ProcessosTarefasController', () => {
  let controller: ProcessosTarefasController;
  const tarefas = {
    listar: jest.fn(),
    criar: jest.fn(),
    atualizar: jest.fn(),
    remover: jest.fn(),
  };
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const user = { id: 'u1', role: Role.ADVOGADO, nome: 'Ana' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcessosTarefasController],
      providers: [
        { provide: ProcessosTarefasService, useValue: tarefas },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    }).compile();
    controller = module.get(ProcessosTarefasController);
  });

  it('lista e cria com auditoria', async () => {
    tarefas.listar.mockResolvedValue([]);
    const criada = { id: 't1', titulo: 'Protocolar', concluida: false };
    tarefas.criar.mockResolvedValue(criada);
    await expect(controller.listar('p1', user)).resolves.toEqual([]);
    await expect(
      controller.criar('p1', { titulo: 'Protocolar' }, user),
    ).resolves.toEqual(criada);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'CRIAR', entidade: 'TAREFA' }),
    );
  });

  it('atualiza e remove com auditoria', async () => {
    const atualizada = { id: 't1', titulo: 'Protocolar', concluida: true };
    tarefas.atualizar.mockResolvedValue(atualizada);
    tarefas.remover.mockResolvedValue(atualizada);
    await expect(
      controller.atualizar('p1', 't1', { concluida: true }, user),
    ).resolves.toEqual(atualizada);
    await expect(controller.remover('p1', 't1', user)).resolves.toEqual(
      atualizada,
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'EDITAR', entidade: 'TAREFA' }),
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'EXCLUIR', entidade: 'TAREFA' }),
    );
  });
});
