package ec.edu.espe.zonas.service;

import java.util.List;
import java.util.UUID;

import ec.edu.espe.zonas.dtos.PlaceRequestDto;
import ec.edu.espe.zonas.dtos.PlaceResponseDto;
import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;

public interface PlaceService {
    List<PlaceResponseDto> getAllPlaces();
    
    PlaceResponseDto createPlace(PlaceRequestDto request);
    
    PlaceResponseDto updatePlace(PlaceRequestDto request, UUID id);
    
    void deletePlaceById(UUID id);

    PlaceResponseDto changeStatus(StatusOfPlace status, UUID id);
  
    List<PlaceResponseDto> getPlacesByStatus(StatusOfPlace status);

    List<PlaceResponseDto> getPlacesByZoneAndStatus(UUID idZone, StatusOfPlace status);
}