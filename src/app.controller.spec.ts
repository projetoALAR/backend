import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API info', () => {
      expect(appController.getHello()).toEqual(
        expect.objectContaining({ name: 'Alar API' }),
      );
    });
  });

  describe('health', () => {
    it('should report ok when database is up', async () => {
      await expect(appController.health()).resolves.toEqual(
        expect.objectContaining({ status: 'ok', database: 'up' }),
      );
    });

    it('should throw 503 when database is down', async () => {
      const prisma = {
        $queryRaw: jest.fn().mockRejectedValue(new Error('down')),
      };
      const module: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [AppService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      const ctrl = module.get<AppController>(AppController);
      await expect(ctrl.health()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('debugSentry', () => {
    it('should 404 when test endpoint is disabled', () => {
      const prev = process.env.SENTRY_ENABLE_TEST_ENDPOINT;
      process.env.SENTRY_ENABLE_TEST_ENDPOINT = 'false';
      expect(() => appController.debugSentry()).toThrow();
      process.env.SENTRY_ENABLE_TEST_ENDPOINT = prev;
    });
  });
});
