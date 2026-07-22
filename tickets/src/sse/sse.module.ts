import { Module, Sse } from '@nestjs/common';
import { SseService } from './sse.services';
import { SseController } from './sse.controller';

@Module({
    providers: [SseService],
    controllers: [SseController],
    exports: [SseService],
})
export class SseModule { }