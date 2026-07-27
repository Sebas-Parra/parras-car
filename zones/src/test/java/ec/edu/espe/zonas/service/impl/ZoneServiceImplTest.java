package ec.edu.espe.zonas.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dtos.PagedResponseDto;
import ec.edu.espe.zonas.dtos.ZoneRequestDto;
import ec.edu.espe.zonas.dtos.ZoneResponseDto;
import ec.edu.espe.zonas.entidades.Place;
import ec.edu.espe.zonas.entidades.Zone;
import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfZone;
import ec.edu.espe.zonas.repositories.PlaceRepository;
import ec.edu.espe.zonas.repositories.ZoneRepository;
import ec.edu.espe.zonas.security.AuthenticatedUser;

@ExtendWith(MockitoExtension.class)
class ZoneServiceImplTest {

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
        ReflectionTestUtils.setField(zoneService, "zoneRepository", zoneRepository);
        ReflectionTestUtils.setField(zoneService, "placeRepository", placeRepository);
        ReflectionTestUtils.setField(zoneService, "auditPublisher", auditPublisher);

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

    private Zone zone(UUID id, String name, int status, int capacity) {
        return Zone.builder().id(id).name(name).code("ZON-REG-01")
                .capacity(capacity).type(TypeOfZone.REGULAR).status(status).build();
    }

    @Test
    void getAllZonesMapsEveryZoneToADto() {
        Zone z1 = zone(UUID.randomUUID(), "Norte", 1, 10);
        Zone z2 = zone(UUID.randomUUID(), "Sur", 1, 20);
        when(zoneRepository.findAll(PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(z1, z2), PageRequest.of(0, 20), 2));

        PagedResponseDto<ZoneResponseDto> result = zoneService.getAllZones(1, 20);

        assertThat(result.getData()).hasSize(2);
        assertThat(result.getData()).extracting(ZoneResponseDto::getName).containsExactly("Norte", "Sur");
        assertThat(result.getTotal()).isEqualTo(2);
        assertThat(result.getPage()).isEqualTo(1);
        assertThat(result.getPageSize()).isEqualTo(20);
    }

    @Test
    void getZoneByIdReturnsTheMappedDto() {
        UUID id = UUID.randomUUID();
        when(zoneRepository.findById(id)).thenReturn(Optional.of(zone(id, "Norte", 1, 10)));

        ZoneResponseDto dto = zoneService.getZoneById(id);

        assertThat(dto.getId()).isEqualTo(id);
        assertThat(dto.getName()).isEqualTo("Norte");
    }

    @Test
    void getZoneByIdThrowsNotFoundWhenMissing() {
        UUID id = UUID.randomUUID();
        when(zoneRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> zoneService.getZoneById(id))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Zona no encontrada");
    }

    @Test
    void createZoneThrowsConflictWhenNameAlreadyExists() {
        ZoneRequestDto request = ZoneRequestDto.builder()
                .name("Zona Norte").capacity(10).type(TypeOfZone.REGULAR).build();
        when(zoneRepository.existsByNameNormalized("Zona Norte")).thenReturn(true);

        assertThatThrownBy(() -> zoneService.createZone(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Ya existe una zona con ese nombre");

        verify(auditPublisher, never()).publish(any());
    }

    @Test
    void createZoneGeneratesASequentialCode() {
        ZoneRequestDto request = ZoneRequestDto.builder()
                .name("Zona Norte").capacity(10).type(TypeOfZone.VIP).build();
        when(zoneRepository.existsByNameNormalized("Zona Norte")).thenReturn(false);
        when(zoneRepository.count()).thenReturn(4L);
        when(zoneRepository.save(any(Zone.class))).thenAnswer(inv -> inv.getArgument(0));

        ZoneResponseDto dto = zoneService.createZone(request);

        assertThat(dto.getCode()).isEqualTo("ZON-VIP-05");
    }

    @Test
    void updateZoneThrowsNotFoundWhenZoneIsMissing() {
        UUID id = UUID.randomUUID();
        when(zoneRepository.findById(id)).thenReturn(Optional.empty());
        ZoneRequestDto request = ZoneRequestDto.builder().name("X").capacity(1).type(TypeOfZone.REGULAR).build();

        assertThatThrownBy(() -> zoneService.updateZone(id, request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Zona no encontrada");
    }

    @Test
    void updateZoneThrowsConflictWhenNewNameAlreadyUsedByAnotherZone() {
        UUID id = UUID.randomUUID();
        Zone existing = zone(id, "Zona Norte", 1, 10);
        when(zoneRepository.findById(id)).thenReturn(Optional.of(existing));
        when(zoneRepository.existsByNameNormalized("Zona Sur")).thenReturn(true);

        ZoneRequestDto request = ZoneRequestDto.builder().name("Zona Sur").capacity(10).type(TypeOfZone.REGULAR).build();

        assertThatThrownBy(() -> zoneService.updateZone(id, request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Ya existe una zona con ese nombre");
    }

    @Test
    void updateZoneAllowsKeepingTheSameNormalizedName() {
        UUID id = UUID.randomUUID();
        Zone existing = zone(id, "Zona   Norte", 1, 10);
        when(zoneRepository.findById(id)).thenReturn(Optional.of(existing));
        when(placeRepository.countByZone(existing)).thenReturn(0L);
        when(zoneRepository.save(any(Zone.class))).thenAnswer(inv -> inv.getArgument(0));

        ZoneRequestDto request = ZoneRequestDto.builder().name("zona norte").capacity(10).type(TypeOfZone.REGULAR).build();

        ZoneResponseDto dto = zoneService.updateZone(id, request);

        assertThat(dto.getName()).isEqualTo("zona norte");
        verify(zoneRepository, never()).existsByNameNormalized(any());
    }

    @Test
    void updateZoneThrowsConflictWhenReducingCapacityBelowExistingPlaces() {
        UUID id = UUID.randomUUID();
        Zone existing = zone(id, "Zona Norte", 1, 10);
        when(zoneRepository.findById(id)).thenReturn(Optional.of(existing));
        when(placeRepository.countByZone(existing)).thenReturn(5L);

        ZoneRequestDto request = ZoneRequestDto.builder().name("Zona Norte").capacity(3).type(TypeOfZone.REGULAR).build();

        assertThatThrownBy(() -> zoneService.updateZone(id, request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("No se puede reducir la capacidad");
    }

    @Test
    void changeStatusThrowsNotFoundWhenZoneIsMissing() {
        UUID id = UUID.randomUUID();
        when(zoneRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> zoneService.changeStatus(id))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void changeStatusThrowsConflictWhenDeactivatingAZoneWithOccupiedPlaces() {
        UUID id = UUID.randomUUID();
        Zone existing = zone(id, "Zona Norte", 1, 10);
        when(zoneRepository.findById(id)).thenReturn(Optional.of(existing));
        when(placeRepository.existsByZoneAndStatus(existing, StatusOfPlace.OCCUPIED)).thenReturn(true);

        assertThatThrownBy(() -> zoneService.changeStatus(id))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("lugares ocupados");
        verify(zoneRepository, never()).save(any());
    }

    @Test
    void changeStatusDeactivatesTheZoneAndItsPlacesWhenNoneAreOccupied() {
        UUID id = UUID.randomUUID();
        Zone existing = zone(id, "Zona Norte", 1, 10);
        Place p1 = new Place();
        p1.setActive(true);
        existing.setPlaces(List.of(p1));
        when(zoneRepository.findById(id)).thenReturn(Optional.of(existing));
        when(placeRepository.existsByZoneAndStatus(existing, StatusOfPlace.OCCUPIED)).thenReturn(false);
        when(zoneRepository.save(any(Zone.class))).thenAnswer(inv -> inv.getArgument(0));

        zoneService.changeStatus(id);

        assertThat(p1.isActive()).isFalse();
        assertThat(existing.getStatus()).isZero();
        verify(placeRepository).saveAll(anyList());
    }

    @Test
    void changeStatusActivatesTheZoneAndItsPlacesWhenCurrentlyInactive() {
        UUID id = UUID.randomUUID();
        Zone existing = zone(id, "Zona Norte", 0, 10);
        Place p1 = new Place();
        p1.setActive(false);
        existing.setPlaces(List.of(p1));
        when(zoneRepository.findById(id)).thenReturn(Optional.of(existing));
        when(zoneRepository.save(any(Zone.class))).thenAnswer(inv -> inv.getArgument(0));

        zoneService.changeStatus(id);

        assertThat(p1.isActive()).isTrue();
        assertThat(existing.getStatus()).isEqualTo(1);
        verify(placeRepository, times(1)).saveAll(anyList());
    }

    @Test
    void deleteZoneThrowsNotFoundWhenMissing() {
        UUID id = UUID.randomUUID();
        when(zoneRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> zoneService.deleteZone(id))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void deleteZoneThrowsConflictWhenItHasOccupiedPlaces() {
        UUID id = UUID.randomUUID();
        Zone existing = zone(id, "Zona Norte", 1, 10);
        when(zoneRepository.findById(id)).thenReturn(Optional.of(existing));
        when(placeRepository.existsByZoneAndStatus(existing, StatusOfPlace.OCCUPIED)).thenReturn(true);

        assertThatThrownBy(() -> zoneService.deleteZone(id))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("lugares ocupados");
        verify(zoneRepository, never()).delete(any());
    }
}
