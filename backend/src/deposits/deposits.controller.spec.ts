import { Test, TestingModule } from '@nestjs/testing';
import { DepositsController } from './deposits.controller';

describe('DepositsController', () => {
  let controller: DepositsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepositsController],
    }).compile();

    controller = module.get<DepositsController>(DepositsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
