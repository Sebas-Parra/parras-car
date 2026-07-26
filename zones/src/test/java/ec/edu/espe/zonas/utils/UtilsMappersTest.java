package ec.edu.espe.zonas.utils;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ec.edu.espe.zonas.dtos.PlaceRequestDto;
import ec.edu.espe.zonas.dtos.PlaceResponseDto;
import ec.edu.espe.zonas.entidades.Place;
import ec.edu.espe.zonas.entidades.Zone;
import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfZone;

class UtilsMappersTest {

    private final UtilsMappers mappers = new UtilsMappers();

    @Test
    void toPlaceResponseDtoMapsAllFieldsIncludingZoneData() {
        UUID zoneId = UUID.randomUUID();
        Zone zone = Zone.builder().id(zoneId).name("Zona Norte").code("ZON-REG-01")
                .capacity(10).type(TypeOfZone.REGULAR).status(1).build();

        UUID placeId = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();
        Place place = Place.builder()
                .id(placeId)
                .code("RE01-01")
                .description("Cerca al ascensor")
                .type(TypeOfPlace.CAR)
                .isActive(true)
                .status(StatusOfPlace.AVAILABLE)
                .zone(zone)
                .createdAt(now)
                .updatedAt(now)
                .build();

        PlaceResponseDto dto = mappers.toPlaceResponseDto(place);

        assertThat(dto.getId()).isEqualTo(placeId);
        assertThat(dto.getCode()).isEqualTo("RE01-01");
        assertThat(dto.getDescription()).isEqualTo("Cerca al ascensor");
        assertThat(dto.getType()).isEqualTo(TypeOfPlace.CAR);
        assertThat(dto.isActive()).isTrue();
        assertThat(dto.getStatus()).isEqualTo(StatusOfPlace.AVAILABLE);
        assertThat(dto.getIdZone()).isEqualTo(zoneId);
        assertThat(dto.getNameZone()).isEqualTo("Zona Norte");
        assertThat(dto.getCreatedAt()).isEqualTo(now);
        assertThat(dto.getUpdatedAt()).isEqualTo(now);
    }

    @Test
    void toEntityPlaceMapsRequestFields() {
        PlaceRequestDto request = new PlaceRequestDto();
        request.setDescription("Techado");
        request.setType(TypeOfPlace.BIKE);
        request.setStatus(StatusOfPlace.RESERVED);

        Place place = mappers.toEntityPlace(request);

        assertThat(place.getDescription()).isEqualTo("Techado");
        assertThat(place.getType()).isEqualTo(TypeOfPlace.BIKE);
        assertThat(place.getStatus()).isEqualTo(StatusOfPlace.RESERVED);
    }

    @Test
    void toEntityPlaceReturnsNullForNullRequest() {
        assertThat(mappers.toEntityPlace(null)).isNull();
    }
}
