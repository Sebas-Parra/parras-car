import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface SseEvent {
    type: string;
    data: any;
}

@Injectable()
export class SseService {
    private readonly logger = new Logger(SseService.name);
    private eventSubject = new Subject<SseEvent>();

    emitEvent(type: string, data: any) {
        this.logger.log(`Emitiendo evento SSE: ${type}`);
        this.eventSubject.next({ type, data });
    }

    getEventStream() {
        return this.eventSubject.asObservable();
    }
}