package ec.edu.espe.zonas.sse;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

// Push en vivo para el dashboard de monitoreo: cada mutación de un lugar
// (crear/actualizar/eliminar/cambiar estado) se reenvía a todos los clientes
// conectados, para que otras pestañas/sesiones no dependan de refrescar o
// esperar el poll de 30s del frontend.
@Service
public class SseService {
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError((e) -> emitters.remove(emitter));
        return emitter;
    }

    public void emit(Object data) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().data(data));
            } catch (IOException e) {
                emitters.remove(emitter);
            }
        }
    }
}
