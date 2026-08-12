import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto, RegisterDto, ChangePasswordDto } from './auth.dto';

describe('Auth DTOs', () => {
  it('rejeita login sem e-mail válido', async () => {
    const dto = plainToInstance(LoginDto, { email: 'x', senha: '123' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('aceita login válido', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'admin@alar.com.br',
      senha: 'senha-secreta',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('exige senha forte no register', async () => {
    const dto = plainToInstance(RegisterDto, {
      nome: 'Ana',
      email: 'ana@alar.com.br',
      senha: '123',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'senha')).toBe(true);
  });

  it('exige nova senha forte', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      senhaAtual: 'antiga-senha',
      novaSenha: '123',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'novaSenha')).toBe(true);
  });

  it('aceita senha forte no register', async () => {
    const dto = plainToInstance(RegisterDto, {
      nome: 'Ana',
      email: 'ana@alar.com.br',
      senha: 'AlarSenha1x',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
