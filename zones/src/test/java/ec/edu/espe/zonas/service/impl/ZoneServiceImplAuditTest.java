package ec.edu.espe.zonas.service.impl;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import ec.edu.espe.zonas.audit.AuditEvent;
import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dtos.ZoneRequestDto;
import ec.edu.espe.zonas.entidades.Zone;
import ec.edu.espe.zonas.entidades.enums.TypeOfZone;
import ec.edu.espe.zonas.repositories.PlaceRepository;
import ec.edu.espe.zonas.repositories.ZoneRepository;
import ec.edu.espe.zonas.security.AuthenticatedUser;

@ExtendWith(MockitoExtension.class)
class ZoneServiceImplAuditTest {

    @Mock
    private ZoneRepository zoneRepository;
    @Mock
    private PlaceRepository placeRepository;
    @Mock
    private AuditPublisher auditPublisher;

    private ZoneServiceImpl zoneService;

    @BeforeEach
    void setUp() {
        zoneService = new ZoneServiceImpl();
        org.springframework.test.util.ReflectionTestUtils.setField(zoneService, "zoneRepository", zoneRepository);
        org.springframework.test.util.ReflectionTestUtils.setField(zoneService, "placeRepository", placeRepository);
        org.springframework.test.util.ReflectionTestUtils.setField(zoneService, "auditPublisher", auditPublisher);

        AuthenticatedUser actor = new AuthenticatedUser("user-1", "jdoe", List.of("admin"));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(actor, null, List.of()));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.5");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void createZonePublishesACreateEvent() {
        ZoneRequestDto request = new ZoneRequestDto();
        request.setName("Zona Norte");
        request.setCapacity(10);
        request.setType(TypeOfZone.REGULAR);
        when(zoneRepository.existsByNameNormalized("Zona Norte")).thenReturn(false);
        when(zoneRepository.count()).thenReturn(0L);
        when(zoneRepository.save(any(Zone.class))).thenAnswer(inv -> inv.getArgument(0));

        zoneService.createZone(request);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        AuditEvent event = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(event.servicio()).isEqualTo("ms-zonas");
        org.assertj.core.api.Assertions.assertThat(event.accion()).isEqualTo("CREATE");
        org.assertj.core.api.Assertions.assertThat(event.entidad()).isEqualTo("ZONA");
        org.assertj.core.api.Assertions.assertThat(event.usuario()).isEqualTo("jdoe");
        org.assertj.core.api.Assertions.assertThat(event.rol()).isEqualTo("admin");
    }

    @Test
    void createZonePublishesTheClientIp() {
        ZoneRequestDto request = new ZoneRequestDto();
        request.setName("Zona Este");
        request.setCapacity(5);
        request.setType(TypeOfZone.REGULAR);
        when(zoneRepository.existsByNameNormalized("Zona Este")).thenReturn(false);
        when(zoneRepository.count()).thenReturn(0L);
        when(zoneRepository.save(any(Zone.class))).thenAnswer(inv -> inv.getArgument(0));

        zoneService.createZone(request);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getValue().ip()).isEqualTo("203.0.113.5");
    }

    @Test
    void deleteZonePublishesADeleteEvent() {
        UUID id = UUID.randomUUID();
        Zone zone = Zone.builder().id(id).name("Zona Sur").code("ZON-REG-01")
                .capacity(5).type(TypeOfZone.REGULAR).status(1).build();
        when(zoneRepository.findById(id)).thenReturn(Optional.of(zone));
        when(placeRepository.existsByZoneAndStatus(any(), any())).thenReturn(false);

        zoneService.deleteZone(id);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        AuditEvent event = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(event.accion()).isEqualTo("DELETE");
        org.assertj.core.api.Assertions.assertThat(event.entidadId()).isEqualTo(id.toString());
    }
}
