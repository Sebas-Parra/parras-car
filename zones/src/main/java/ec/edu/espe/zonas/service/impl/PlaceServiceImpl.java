package ec.edu.espe.zonas.service.impl;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import ec.edu.espe.zonas.dtos.PlaceRequestDto;
import ec.edu.espe.zonas.dtos.PlaceResponseDto;
import ec.edu.espe.zonas.entidades.Place;
import ec.edu.espe.zonas.entidades.Zone;
import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.repositories.PlaceRepository;
import ec.edu.espe.zonas.repositories.ZoneRepository;
import ec.edu.espe.zonas.service.PlaceService;
import ec.edu.espe.zonas.utils.UtilsMappers;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PlaceServiceImpl implements PlaceService {
    private final PlaceRepository placeRepository;
    private final ZoneRepository zoneRepository;
    private final UtilsMappers mappers;

    @Override
    @Transactional(readOnly = true)
    public List<PlaceResponseDto> getAllPlaces() {
        return placeRepository.findAll()
            .stream()
            .map(mappers::toPlaceResponseDto)
            .toList();
    }

    @Override
    @Transactional
    public PlaceResponseDto createPlace(PlaceRequestDto request) {
        Zone objZona = zoneRepository.findById(request.getIdZone())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));

        long currentPlaces = placeRepository.countByZone(objZona);
        if (currentPlaces >= objZona.getCapacity()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "La zona ha alcanzado su capacidad máxima (" + objZona.getCapacity() + ")");
        }

        String generatedCode = generatePlaceCode(objZona, currentPlaces);

        Place newPlace = mappers.toEntityPlace(request);
        newPlace.setCode(generatedCode);
        newPlace.setZone(objZona);
        newPlace.setStatus(StatusOfPlace.AVAILABLE);
        newPlace.setActive(true);
        newPlace.setCreatedAt(LocalDateTime.now());
        newPlace.setUpdatedAt(LocalDateTime.now());

        Place savedPlace = placeRepository.save(newPlace);
        return mappers.toPlaceResponseDto(savedPlace);
    }

    @Override
    @Transactional
    public PlaceResponseDto updatePlace(PlaceRequestDto request, UUID id) {
        Place existing = placeRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lugar no encontrado"));

        if (request.getDescription() != null) {
            existing.setDescription(request.getDescription().trim().isEmpty() ? null : request.getDescription().trim());
        }

        if (request.getType() != null) {
            existing.setType(request.getType());
        }

        if (request.getStatus() != null) {
            existing.setStatus(request.getStatus());
        }

        if (request.getIdZone() != null && !request.getIdZone().equals(existing.getZone().getId())) {
            Zone newZone = zoneRepository.findById(request.getIdZone())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));
            long currentPlaces = placeRepository.countByZone(newZone);
            if (currentPlaces >= newZone.getCapacity()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La zona destino ha alcanzado su capacidad máxima (" + newZone.getCapacity() + ")");
            }
            existing.setZone(newZone);
        }

        existing.setUpdatedAt(LocalDateTime.now());
        Place saved = placeRepository.save(existing);
        return mappers.toPlaceResponseDto(saved);
    }

    @Override
    @Transactional
    public void deletePlaceById(UUID id) {
        Place place = placeRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lugar no encontrado"));
        if (place.getStatus() == StatusOfPlace.OCCUPIED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "No se puede eliminar un lugar que está ocupado");
        }
        placeRepository.delete(place);
    }

    @Override
    @Transactional
    public PlaceResponseDto changeStatus(StatusOfPlace status, UUID id) {
        Place place = placeRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lugar no encontrado"));
        place.setStatus(status);
        place.setUpdatedAt(LocalDateTime.now());
        Place saved = placeRepository.save(place);
        return mappers.toPlaceResponseDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PlaceResponseDto> getPlacesByStatus(StatusOfPlace status) {
        return placeRepository.findByStatus(status)
            .stream()
            .map(mappers::toPlaceResponseDto)
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PlaceResponseDto> getPlacesByZoneAndStatus(UUID idZone, StatusOfPlace status) {
        Zone zone = zoneRepository.findById(idZone)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));
        return placeRepository.findByZoneAndStatus(zone, status)
            .stream()
            .map(mappers::toPlaceResponseDto)
            .toList();
    }

    private String generatePlaceCode(Zone zone, long currentPlaces) {
        String typePrefix = zone.getType().name()
            .substring(0, Math.min(2, zone.getType().name().length()))
            .toUpperCase();
        String zoneSeq = zone.getCode().substring(zone.getCode().length() - 2);
        return typePrefix + zoneSeq + "-" + String.format("%02d", currentPlaces + 1);
    }
}
