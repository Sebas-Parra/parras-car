package ec.edu.espe.zonas.audit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AuditPublisher {

    private static final Logger logger = LoggerFactory.getLogger(AuditPublisher.class);

    private final RabbitTemplate rabbitTemplate;
    private final String exchange;
    private final String routingKey;

    public AuditPublisher(
            RabbitTemplate rabbitTemplate,
            @Value("${audit.rabbitmq.exchange}") String exchange,
            @Value("${audit.rabbitmq.routing-key}") String routingKey) {
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
        this.routingKey = routingKey;
    }

    public void publish(AuditEvent event) {
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, event);
        } catch (Exception e) {
            logger.error("No se pudo publicar el evento de auditoría: {} {}", event.accion(), event.entidadId(), e);
        }
    }
}
