import { ConfigService } from '@nestjs/config';

const DEV_FALLBACK = 'alar-dev-secret-change-me';

/**
 * Resolve o segredo JWT. Em produção exige `JWT_SECRET`;
 * em desenvolvimento permite fallback explícito.
 */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET')?.trim();
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET é obrigatório em produção. Defina a variável de ambiente antes de iniciar a API.',
    );
  }

  return DEV_FALLBACK;
}
