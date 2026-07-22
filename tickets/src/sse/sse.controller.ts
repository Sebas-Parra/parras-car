import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { SseService } from './sse.services';
import { map, Observable } from 'rxjs';

@Controller('sse')
export class SseController {
    constructor(private readonly sseservice: SseService) { }

    @Sse('espacios')
    streamEspacios(): Observable<MessageEvent> {
        return this.sseservice.getEventStream().pipe(
            map((event) => ({
                data: JSON.stringify(event),
                type: event.type,
            })),
        );
    }
}