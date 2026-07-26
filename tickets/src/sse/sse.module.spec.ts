import { Test, TestingModule } from '@nestjs/testing';
import { SseModule } from './sse.module';
import { SseService } from './sse.services';
import { SseController } from './sse.controller';

describe('SseModule', () => {
  it('wires up SseService and SseController', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [SseModule],
    }).compile();

    expect(module.get(SseService)).toBeInstanceOf(SseService);
    expect(module.get(SseController)).toBeInstanceOf(SseController);
  });
});
