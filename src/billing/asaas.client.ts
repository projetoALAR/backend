import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type AsaasErrorBody = {
  errors?: Array<{ code?: string; description?: string }>;
};

@Injectable()
export class AsaasClient {
  private readonly logger = new Logger(AsaasClient.name);

  constructor(private readonly config: ConfigService) {}

  habilitado(): boolean {
    return Boolean(this.config.get<string>('ASAAS_API_KEY')?.trim());
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('ASAAS_API_URL')?.replace(/\/$/, '') ||
      'https://api-sandbox.asaas.com'
    );
  }

  private apiKey(): string {
    const key = this.config.get<string>('ASAAS_API_KEY')?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'Asaas não configurado. Defina ASAAS_API_KEY no .env (sandbox ou produção).',
      );
    }
    return key;
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        access_token: this.apiKey(),
        'User-Agent': 'AlarWorkspace/1.0',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
    }

    if (!response.ok) {
      const err = json as AsaasErrorBody;
      const detail =
        err?.errors
          ?.map((e) => e.description || e.code)
          .filter(Boolean)
          .join('; ') ||
        text ||
        response.statusText;
      this.logger.warn(
        `Asaas ${method} ${path} → ${response.status}: ${detail}`,
      );
      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException(`Asaas: ${detail}`);
      }
      if (response.status >= 400 && response.status < 500) {
        throw new BadRequestException(`Asaas: ${detail}`);
      }
      throw new ServiceUnavailableException(`Asaas: ${detail}`);
    }

    return json as T;
  }
}
