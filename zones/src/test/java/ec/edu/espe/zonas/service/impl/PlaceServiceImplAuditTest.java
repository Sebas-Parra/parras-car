package ec.edu.espe.zonas.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
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
import ec.edu.espe.zonas.dtos.PlaceRequestDto;
import ec.edu.espe.zonas.entidades.Place;
import ec.edu.espe.zonas.entidades.Zone;
import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfZone;
import ec.edu.espe.zonas.repositories.PlaceRepository;
import ec.edu.espe.zonas.repositories.ZoneRepository;
import ec.edu.espe.zonas.security.AuthenticatedUser;
import ec.edu.espe.zonas.sse.SseService;
import ec.edu.espe.zonas.utils.UtilsMappers;

@ExtendWith(MockitoExtension.class)
class PlaceServiceImplAuditTest {

    @Mock
    private PlaceRepository placeRepository;
    @Mock
    private ZoneRepository zoneRepository;
    @Mock
    private UtilsMappers mappers;
    @Mock
    private AuditPublisher auditPublisher;
    @Mock
    private SseService sseService;

    private PlaceServiceImpl placeService;

    @BeforeEach
    void setUp() {
        placeService = new PlaceServiceImpl(placeRepository, zoneRepository, mappers, auditPublisher, sseService);

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
    void createPlacePublishesACreateEvent() {
        UUID zoneId = UUID.randomUUID();
        Zone zone = Zone.builder().id(zoneId).name("Zona Norte").code("ZON-REG-01")
                .capacity(10).type(TypeOfZone.REGULAR).status(1).build();
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(placeRepository.countByZone(zone)).thenReturn(0L);
        when(placeRepository.existsByCode(org.mockito.ArgumentMatchers.anyString())).thenReturn(false);

        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(zoneId);
        request.setType(TypeOfPlace.CAR);

        Place mappedPlace = new Place();
        mappedPlace.setId(UUID.randomUUID());
        when(mappers.toEntityPlace(request)).thenReturn(mappedPlace);
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(null);

        placeService.createPlace(request);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        AuditEvent event = captor.getValue();
        assertThat(event.servicio()).isEqualTo("ms-zonas");
        assertThat(event.accion()).isEqualTo("CREATE");
        assertThat(event.entidad()).isEqualTo("PLACE");
        assertThat(event.usuario()).isEqualTo("jdoe");
        assertThat(event.rol()).isEqualTo("admin");
    }

    @Test
    void createPlacePublishesTheClientIp() {
        UUID zoneId = UUID.randomUUID();
        Zone zone = Zone.builder().id(zoneId).name("Zona Norte").code("ZON-REG-01")
                .capacity(10).type(TypeOfZone.REGULAR).status(1).build();
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(placeRepository.countByZone(zone)).thenReturn(0L);
        when(placeRepository.existsByCode(org.mockito.ArgumentMatchers.anyString())).thenReturn(false);

        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(zoneId);
        request.setType(TypeOfPlace.CAR);

        Place mappedPlace = new Place();
        mappedPlace.setId(UUID.randomUUID());
        when(mappers.toEntityPlace(request)).thenReturn(mappedPlace);
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(null);

        placeService.createPlace(request);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        assertThat(captor.getValue().ip()).isEqualTo("203.0.113.5");
    }

    @Test
    void createPlaceTrimsSurroundingWhitespaceFromDescription() {
        UUID zoneId = UUID.randomUUID();
        Zone zone = Zone.builder().id(zoneId).name("Zona Norte").code("ZON-REG-01")
                .capacity(10).type(TypeOfZone.REGULAR).status(1).build();
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(placeRepository.countByZone(zone)).thenReturn(0L);
        when(placeRepository.existsByCode(org.mockito.ArgumentMatchers.anyString())).thenReturn(false);

        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(zoneId);
        request.setType(TypeOfPlace.CAR);
        request.setDescription("  con espacios  ");

        Place mappedPlace = new Place();
        mappedPlace.setId(UUID.randomUUID());
        mappedPlace.setDescription("  con espacios  ");
        when(mappers.toEntityPlace(request)).thenReturn(mappedPlace);
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(null);

        placeService.createPlace(request);

        ArgumentCaptor<Place> captor = ArgumentCaptor.forClass(Place.class);
        verify(placeRepository).save(captor.capture());
        assertThat(captor.getValue().getDescription()).isEqualTo("con espacios");
    }

    @Test
    void deletePlaceByIdPublishesADeleteEvent() {
        UUID id = UUID.randomUUID();
        Place place = new Place();
        place.setId(id);
        place.setCode("A1-01");
        place.setStatus(StatusOfPlace.AVAILABLE);
        when(placeRepository.findById(id)).thenReturn(Optional.of(place));

        placeService.deletePlaceById(id);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        assertThat(captor.getValue().accion()).isEqualTo("DELETE");
        assertThat(captor.getValue().entidadId()).isEqualTo(id.toString());
    }
}
