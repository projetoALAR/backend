import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CATEGORIAS_MODELO,
  CreateModeloDocumentoDto,
} from './modelos-documento.dto';

describe('CreateModeloDocumentoDto', () => {
  it('aceita categoria válida', async () => {
    const dto = plainToInstance(CreateModeloDocumentoDto, {
      nome: 'Petição',
      categoria: CATEGORIAS_MODELO[0],
      conteudo: 'Olá {{cliente.nome}}',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejeita categoria inválida', async () => {
    const dto = plainToInstance(CreateModeloDocumentoDto, {
      nome: 'X',
      categoria: 'Inexistente',
      conteudo: 'texto',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'categoria')).toBe(true);
  });
});
