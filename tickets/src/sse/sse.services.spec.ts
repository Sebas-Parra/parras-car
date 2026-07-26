import { SseService } from './sse.services';

describe('SseService', () => {
  let service: SseService;

  beforeEach(() => {
    service = new SseService();
  });

  it('emits events on the event stream', (done) => {
    const sub = service.getEventStream().subscribe((event) => {
      expect(event).toEqual({ type: 'espacio-actualizado', data: { id: 1 } });
      sub.unsubscribe();
      done();
    });

    service.emitEvent('espacio-actualizado', { id: 1 });
  });
});
