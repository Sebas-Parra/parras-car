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
    @Transactional()
    public PlaceResponseDto createPlace(PlaceRequestDto request) {
        if (placeRepository.existsByCode(request.getCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Place code already exists");
        }

        Zone objZona = zoneRepository.findById(request.getIdZone())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zone not found"));

        long currentPlaces = placeRepository.countByZone(objZona);
        if (currentPlaces >= objZona.getCapacity()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Zone capacity exceeded");
        }

        Place newPlace = mappers.toEntityPlace(request);
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
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found"));

        String newCode = request.getCode();
        if (newCode != null && !newCode.equals(existing.getCode())) {
            if (placeRepository.existsByCode(newCode)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Place code already in use");
            }
            existing.setCode(newCode);
        }

        if (request.getDescription() != null) {
            existing.setDescription(request.getDescription());
        }

        if (request.getType() != null) {
            existing.setType(request.getType());
        }

        if (request.getStatus() != null) {
            existing.setStatus(request.getStatus());
        }

        if (request.getIdZone() != null && (!request.getIdZone().equals(existing.getZone().getId()))) {
            Zone newZone = zoneRepository.findById(request.getIdZone())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zone not found"));
            long currentPlaces = placeRepository.countByZone(newZone);
            if (currentPlaces >= newZone.getCapacity()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Target zone capacity exceeded");
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
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found"));
        placeRepository.delete(place);
    }

    @Override
    @Transactional
    public PlaceResponseDto changeStatus(StatusOfPlace status, UUID id) {
        Place place = placeRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found"));
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
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zone not found"));
        return placeRepository.findByZoneAndStatus(zone, status)
            .stream()
            .map(mappers::toPlaceResponseDto)
            .toList();
    }
}