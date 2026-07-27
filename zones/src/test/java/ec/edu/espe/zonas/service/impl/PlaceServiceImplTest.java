package ec.edu.espe.zonas.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dtos.PlaceRequestDto;
import ec.edu.espe.zonas.dtos.PlaceResponseDto;
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
class PlaceServiceImplTest {

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

    private Zone zone(UUID id, int status, int capacity) {
        return Zone.builder().id(id).name("Zona Norte").code("ZON-REG-42")
                .capacity(capacity).type(TypeOfZone.REGULAR).status(status).build();
    }

    @Test
    void getAllPlacesMapsEveryPlace() {
        Place p1 = new Place();
        Place p2 = new Place();
        when(placeRepository.findAll()).thenReturn(List.of(p1, p2));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(PlaceResponseDto.builder().build());

        List<PlaceResponseDto> result = placeService.getAllPlaces();

        assertThat(result).hasSize(2);
    }

    @Test
    void createPlaceThrowsNotFoundWhenZoneIsMissing() {
        UUID zoneId = UUID.randomUUID();
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.empty());
        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(zoneId);
        request.setType(TypeOfPlace.CAR);

        assertThatThrownBy(() -> placeService.createPlace(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Zona no encontrada");
    }

    @Test
    void createPlaceThrowsConflictWhenZoneIsInactive() {
        UUID zoneId = UUID.randomUUID();
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone(zoneId, 0, 10)));
        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(zoneId);
        request.setType(TypeOfPlace.CAR);

        assertThatThrownBy(() -> placeService.createPlace(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("zona inactiva");
    }

    @Test
    void createPlaceThrowsConflictWhenZoneIsAtCapacity() {
        UUID zoneId = UUID.randomUUID();
        Zone zone = zone(zoneId, 1, 2);
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(placeRepository.countByZone(zone)).thenReturn(2L);
        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(zoneId);
        request.setType(TypeOfPlace.CAR);

        assertThatThrownBy(() -> placeService.createPlace(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("capacidad máxima");
    }

    @Test
    void createPlaceRetriesTheCodeWhenItAlreadyExists() {
        UUID zoneId = UUID.randomUUID();
        Zone zone = zone(zoneId, 1, 10);
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(placeRepository.countByZone(zone)).thenReturn(0L);
        when(placeRepository.existsByCode(anyString()))
                .thenReturn(true)
                .thenReturn(false);

        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(zoneId);
        request.setType(TypeOfPlace.CAR);

        Place mapped = new Place();
        mapped.setId(UUID.randomUUID());
        when(mappers.toEntityPlace(request)).thenReturn(mapped);
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(PlaceResponseDto.builder().build());

        placeService.createPlace(request);

        verify(placeRepository, org.mockito.Mockito.times(2)).existsByCode(anyString());
        assertThat(mapped.getCode()).isEqualTo("RE42-02");
    }

    @Test
    void updatePlaceThrowsNotFoundWhenMissing() {
        UUID id = UUID.randomUUID();
        when(placeRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> placeService.updatePlace(new PlaceRequestDto(), id))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Lugar no encontrado");
    }

    @Test
    void updatePlaceTrimsBlankDescriptionToNull() {
        UUID id = UUID.randomUUID();
        Zone zone = zone(UUID.randomUUID(), 1, 10);
        Place existing = Place.builder().id(id).code("A1-01").status(StatusOfPlace.AVAILABLE).zone(zone).build();
        when(placeRepository.findById(id)).thenReturn(Optional.of(existing));
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(PlaceResponseDto.builder().build());

        PlaceRequestDto request = new PlaceRequestDto();
        request.setDescription("   ");

        placeService.updatePlace(request, id);

        assertThat(existing.getDescription()).isNull();
    }

    @Test
    void updatePlaceUpdatesTypeAndStatusWhenProvided() {
        UUID id = UUID.randomUUID();
        Zone zone = zone(UUID.randomUUID(), 1, 10);
        Place existing = Place.builder().id(id).code("A1-01").status(StatusOfPlace.AVAILABLE).zone(zone).build();
        when(placeRepository.findById(id)).thenReturn(Optional.of(existing));
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(PlaceResponseDto.builder().build());

        PlaceRequestDto request = new PlaceRequestDto();
        request.setType(TypeOfPlace.BUS);
        request.setStatus(StatusOfPlace.MAINTENANCE);

        placeService.updatePlace(request, id);

        assertThat(existing.getType()).isEqualTo(TypeOfPlace.BUS);
        assertThat(existing.getStatus()).isEqualTo(StatusOfPlace.MAINTENANCE);
    }

    @Test
    void updatePlaceThrowsNotFoundWhenTargetZoneIsMissing() {
        UUID id = UUID.randomUUID();
        UUID currentZoneId = UUID.randomUUID();
        UUID newZoneId = UUID.randomUUID();
        Zone currentZone = zone(currentZoneId, 1, 10);
        Place existing = Place.builder().id(id).code("A1-01").status(StatusOfPlace.AVAILABLE).zone(currentZone).build();
        when(placeRepository.findById(id)).thenReturn(Optional.of(existing));
        when(zoneRepository.findById(newZoneId)).thenReturn(Optional.empty());

        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(newZoneId);

        assertThatThrownBy(() -> placeService.updatePlace(request, id))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Zona no encontrada");
    }

    @Test
    void updatePlaceThrowsConflictWhenTargetZoneIsInactive() {
        UUID id = UUID.randomUUID();
        UUID currentZoneId = UUID.randomUUID();
        UUID newZoneId = UUID.randomUUID();
        Zone currentZone = zone(currentZoneId, 1, 10);
        Zone newZone = zone(newZoneId, 0, 10);
        Place existing = Place.builder().id(id).code("A1-01").status(StatusOfPlace.AVAILABLE).zone(currentZone).build();
        when(placeRepository.findById(id)).thenReturn(Optional.of(existing));
        when(zoneRepository.findById(newZoneId)).thenReturn(Optional.of(newZone));

        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(newZoneId);

        assertThatThrownBy(() -> placeService.updatePlace(request, id))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("zona inactiva");
    }

    @Test
    void updatePlaceThrowsConflictWhenTargetZoneIsFull() {
        UUID id = UUID.randomUUID();
        UUID currentZoneId = UUID.randomUUID();
        UUID newZoneId = UUID.randomUUID();
        Zone currentZone = zone(currentZoneId, 1, 10);
        Zone newZone = zone(newZoneId, 1, 1);
        Place existing = Place.builder().id(id).code("A1-01").status(StatusOfPlace.AVAILABLE).zone(currentZone).build();
        when(placeRepository.findById(id)).thenReturn(Optional.of(existing));
        when(zoneRepository.findById(newZoneId)).thenReturn(Optional.of(newZone));
        when(placeRepository.countByZone(newZone)).thenReturn(1L);

        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(newZoneId);

        assertThatThrownBy(() -> placeService.updatePlace(request, id))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("capacidad máxima");
    }

    @Test
    void updatePlaceMovesToNewZoneWhenItHasCapacity() {
        UUID id = UUID.randomUUID();
        UUID currentZoneId = UUID.randomUUID();
        UUID newZoneId = UUID.randomUUID();
        Zone currentZone = zone(currentZoneId, 1, 10);
        Zone newZone = zone(newZoneId, 1, 10);
        Place existing = Place.builder().id(id).code("A1-01").status(StatusOfPlace.AVAILABLE).zone(currentZone).build();
        when(placeRepository.findById(id)).thenReturn(Optional.of(existing));
        when(zoneRepository.findById(newZoneId)).thenReturn(Optional.of(newZone));
        when(placeRepository.countByZone(newZone)).thenReturn(0L);
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(PlaceResponseDto.builder().build());

        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(newZoneId);

        placeService.updatePlace(request, id);

        assertThat(existing.getZone()).isEqualTo(newZone);
    }

    @Test
    void deletePlaceByIdThrowsNotFoundWhenMissing() {
        UUID id = UUID.randomUUID();
        when(placeRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> placeService.deletePlaceById(id))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Lugar no encontrado");
    }

    @Test
    void deletePlaceByIdThrowsConflictWhenOccupied() {
        UUID id = UUID.randomUUID();
        Place place = new Place();
        place.setId(id);
        place.setStatus(StatusOfPlace.OCCUPIED);
        when(placeRepository.findById(id)).thenReturn(Optional.of(place));

        assertThatThrownBy(() -> placeService.deletePlaceById(id))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("ocupado");
        verify(placeRepository, never()).delete(any());
    }

    @Test
    void changeStatusUpdatesThePlaceStatus() {
        UUID id = UUID.randomUUID();
        Place place = new Place();
        place.setId(id);
        place.setStatus(StatusOfPlace.AVAILABLE);
        when(placeRepository.findById(id)).thenReturn(Optional.of(place));
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(PlaceResponseDto.builder().build());

        placeService.changeStatus(StatusOfPlace.OCCUPIED, id);

        assertThat(place.getStatus()).isEqualTo(StatusOfPlace.OCCUPIED);
    }

    @Test
    void changeStatusThrowsNotFoundWhenMissing() {
        UUID id = UUID.randomUUID();
        when(placeRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> placeService.changeStatus(StatusOfPlace.OCCUPIED, id))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void getPlacesByStatusMapsMatchingPlaces() {
        when(placeRepository.findByStatus(StatusOfPlace.AVAILABLE)).thenReturn(List.of(new Place()));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(PlaceResponseDto.builder().build());

        List<PlaceResponseDto> result = placeService.getPlacesByStatus(StatusOfPlace.AVAILABLE);

        assertThat(result).hasSize(1);
    }

    @Test
    void getPlacesByZoneAndStatusThrowsNotFoundWhenZoneMissing() {
        UUID zoneId = UUID.randomUUID();
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> placeService.getPlacesByZoneAndStatus(zoneId, StatusOfPlace.AVAILABLE))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Zona no encontrada");
    }

    @Test
    void getPlacesByZoneAndStatusMapsMatchingPlaces() {
        UUID zoneId = UUID.randomUUID();
        Zone zone = zone(zoneId, 1, 10);
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(placeRepository.findByZoneAndStatus(zone, StatusOfPlace.AVAILABLE)).thenReturn(List.of(new Place()));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(PlaceResponseDto.builder().build());

        List<PlaceResponseDto> result = placeService.getPlacesByZoneAndStatus(zoneId, StatusOfPlace.AVAILABLE);

        assertThat(result).hasSize(1);
    }
}
