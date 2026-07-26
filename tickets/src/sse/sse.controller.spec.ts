import { Subject } from 'rxjs';
import { SseController } from './sse.controller';
import { SseEvent, SseService } from './sse.services';

describe('SseController', () => {
  it('maps events from the SseService stream into SSE MessageEvents', (done) => {
    const subject = new Subject<SseEvent>();
    const sseService = {
      getEventStream: () => subject.asObservable(),
    } as unknown as SseService;
    const controller = new SseController(sseService);

    const sub = controller.streamEspacios().subscribe((message) => {
      expect(message).toEqual({
        type: 'espacio-actualizado',
        data: JSON.stringify({ type: 'espacio-actualizado', data: { id: 1 } }),
      });
      sub.unsubscribe();
      done();
    });

    subject.next({ type: 'espacio-actualizado', data: { id: 1 } });
  });
});
