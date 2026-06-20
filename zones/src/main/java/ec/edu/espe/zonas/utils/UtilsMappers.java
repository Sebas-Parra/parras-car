package ec.edu.espe.zonas.utils;

import org.springframework.stereotype.Component;

import ec.edu.espe.zonas.dtos.PlaceRequestDto;
import ec.edu.espe.zonas.dtos.PlaceResponseDto;
import ec.edu.espe.zonas.entidades.Place;

@Component
public class UtilsMappers {
    public PlaceResponseDto toPlaceResponseDto(Place place) {
        return PlaceResponseDto.builder()
                .id(place.getId())
                .code(place.getCode())
                .description(place.getDescription())
                .type(place.getType())
                .isActive(place.isActive())
                .status(place.getStatus())
                .idZone(place.getZone().getId())
                .nameZone(place.getZone().getName())
                .createdAt(place.getCreatedAt())
                .updatedAt(place.getUpdatedAt())
                .build();
    }

    public Place toEntityPlace(PlaceRequestDto placeRequestDto) {
        if (placeRequestDto == null) {
            return null;
        }
        return Place.builder()
                .code(placeRequestDto.getCode())
                .description(placeRequestDto.getDescription())
                .type(placeRequestDto.getType())
                .status(placeRequestDto.getStatus())
                .build();
    }
}
