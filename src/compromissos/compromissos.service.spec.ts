import { Test, TestingModule } from '@nestjs/testing';
import { CompromissosService } from './compromissos.service';

describe('CompromissosService', () => {
  let service: CompromissosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompromissosService],
    }).compile();

    service = module.get<CompromissosService>(CompromissosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
