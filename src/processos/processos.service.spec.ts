import { Test, TestingModule } from '@nestjs/testing';
import { ProcessosService } from './processos.service';

describe('ProcessosService', () => {
  let service: ProcessosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProcessosService],
    }).compile();

    service = module.get<ProcessosService>(ProcessosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
