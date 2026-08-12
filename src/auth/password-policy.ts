import { BadRequestException } from '@nestjs/common';
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const PASSWORD_MIN_LENGTH = 10;

export const PASSWORD_POLICY_MESSAGE =
  'A senha deve ter no mínimo 10 caracteres, com letra maiúscula, minúscula e número.';

const COMUNS = new Set([
  'password123',
  'senha12345',
  'senha1234',
  '1234567890',
  'admin12345',
  'qwerty1234',
  'alar123456',
]);

export type SenhaCheck = { id: string; ok: boolean; label: string };

export function checarSenha(senha: string): SenhaCheck[] {
  const value = senha ?? '';
  return [
    {
      id: 'len',
      ok: value.length >= PASSWORD_MIN_LENGTH,
      label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
    },
    {
      id: 'lower',
      ok: /[a-z]/.test(value),
      label: 'Uma letra minúscula',
    },
    {
      id: 'upper',
      ok: /[A-Z]/.test(value),
      label: 'Uma letra maiúscula',
    },
    {
      id: 'digit',
      ok: /\d/.test(value),
      label: 'Um número',
    },
    {
      id: 'comum',
      ok: !COMUNS.has(value.toLowerCase()),
      label: 'Não ser uma senha óbvia',
    },
  ];
}

export function senhaAtendePolitica(senha: string): boolean {
  return checarSenha(senha).every((c) => c.ok);
}

export function assertSenhaForte(senha: string): void {
  if (!senhaAtendePolitica(senha)) {
    throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
  }
}

@ValidatorConstraint({ name: 'senhaForte', async: false })
export class SenhaForteConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && senhaAtendePolitica(value);
  }

  defaultMessage() {
    return PASSWORD_POLICY_MESSAGE;
  }
}

export function IsSenhaForte(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: SenhaForteConstraint,
    });
  };
}
