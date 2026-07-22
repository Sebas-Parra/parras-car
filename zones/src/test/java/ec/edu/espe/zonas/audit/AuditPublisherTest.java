package ec.edu.espe.zonas.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

@ExtendWith(MockitoExtension.class)
class AuditPublisherTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    @Test
    void publishesTheEventToTheConfiguredExchangeAndRoutingKey() {
        AuditPublisher publisher = new AuditPublisher(rabbitTemplate, "audit_exchange", "audit_event");
        AuditEvent event = new AuditEvent(
                "ms-zonas", "CREATE", "ZONA", "zone-1",
                Map.of("name", "Zona Norte"), "jdoe", "admin", "203.0.113.5");

        publisher.publish(event);

        ArgumentCaptor<String> exchangeCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> routingKeyCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<AuditEvent> eventCaptor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(rabbitTemplate).convertAndSend(exchangeCaptor.capture(), routingKeyCaptor.capture(), eventCaptor.capture());

        assertThat(exchangeCaptor.getValue()).isEqualTo("audit_exchange");
        assertThat(routingKeyCaptor.getValue()).isEqualTo("audit_event");
        assertThat(eventCaptor.getValue()).isEqualTo(event);
    }

    @Test
    void doesNotThrowWhenRabbitMqIsUnreachable() {
        AuditPublisher publisher = new AuditPublisher(rabbitTemplate, "audit_exchange", "audit_event");
        doThrow(new RuntimeException("boom"))
                .when(rabbitTemplate).convertAndSend(anyString(), anyString(), any(AuditEvent.class));

        assertDoesNotThrow(() -> publisher.publish(
                new AuditEvent("ms-zonas", "CREATE", "ZONA", "zone-1", Map.of(), "jdoe", "admin", "203.0.113.5")));
    }
}
