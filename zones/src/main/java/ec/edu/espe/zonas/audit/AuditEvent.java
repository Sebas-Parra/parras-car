package ec.edu.espe.zonas.audit;

import java.util.Map;

public record AuditEvent(
        String servicio,
        String accion,
        String entidad,
        String entidadId,
        Map<String, Object> datos,
        String usuario,
        String rol,
        String ip) {
}
