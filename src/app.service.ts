import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      name: 'Alar API',
      version: '1.0.0',
      docs: 'GET /health · API versionada em /v1',
    };
  }
}
