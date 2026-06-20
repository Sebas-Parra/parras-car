package ec.edu.espe.zonas.service.impl;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import ec.edu.espe.zonas.dtos.ZoneRequestDto;
import ec.edu.espe.zonas.dtos.ZoneResponseDto;
import ec.edu.espe.zonas.entidades.Place;
import ec.edu.espe.zonas.entidades.Zone;
import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.repositories.PlaceRepository;
import ec.edu.espe.zonas.repositories.ZoneRepository;
import ec.edu.espe.zonas.service.ZoneService;

@Service
public class ZoneServiceImpl implements ZoneService {

    @Autowired
    private ZoneRepository zoneRepository;

    @Autowired
    private PlaceRepository placeRepository;

    @Override
    @Transactional()
    public List<ZoneResponseDto> getAllZones() {
        return zoneRepository.findAll()
            .stream()
            .map(this::toResponseDto)
            .collect(Collectors.toList());
    }

    @Override
    public ZoneResponseDto createZone(ZoneRequestDto request) {

        if(zoneRepository.existsByName(request.getName())){
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This name already exist" );
        }

        Zone objZone = new Zone();

        objZone.setName(request.getName());
        objZone.setCode(codeGenerator(request));
        objZone.setDescription(request.getDescription());
        objZone.setCapacity(request.getCapacity());
        objZone.setType(request.getType());
        objZone.setStatus(1);
        objZone.setCreatedAt(LocalDateTime.now());
        objZone.setUpdatedAt(LocalDateTime.now());

        zoneRepository.save(objZone);
        return toResponseDto(objZone);
    }

    @Override
    @Transactional
    public ZoneResponseDto updateZone(UUID idZone, ZoneRequestDto request) {
        Zone zone = zoneRepository.findById(idZone)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zone not found"));

        if (!zone.getName().equals(request.getName()) && zoneRepository.existsByName(request.getName())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This name already exists");
        }

        long existingPlaces = placeRepository.countByZone(zone);
        if (request.getCapacity() < existingPlaces) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Cannot set capacity below existing places count (" + existingPlaces + ")");
        }

        zone.setName(request.getName());
        zone.setDescription(request.getDescription());
        zone.setCapacity(request.getCapacity());
        zone.setType(request.getType());
        zone.setUpdatedAt(LocalDateTime.now());

        Zone saved = zoneRepository.save(zone);
        return toResponseDto(saved);
    }

    @Override
    @Transactional
    public void changeStatus(UUID idZone) {
        Zone zone = zoneRepository.findById(idZone)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zone not found"));

        int newStatus = (zone.getStatus() == 1) ? 0 : 1;

        if (newStatus == 0) {
            boolean hasOccupiedPlaces = placeRepository.existsByZoneAndStatus(zone, StatusOfPlace.OCCUPIED);
            if (hasOccupiedPlaces) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot deactivate zone: there are occupied places");
            }

            for (Place place : zone.getPlaces()) {
                place.setActive(false);
            }
            placeRepository.saveAll(zone.getPlaces());
        } else if (newStatus == 1) {
            for (Place place : zone.getPlaces()) {
                place.setActive(true);
            }
            placeRepository.saveAll(zone.getPlaces());
        }

        zone.setStatus(newStatus);
        zone.setUpdatedAt(LocalDateTime.now());
        zoneRepository.save(zone);
    }

    private ZoneResponseDto toResponseDto(Zone zone) {
        return ZoneResponseDto.builder()
                .id(zone.getId())
                .name(zone.getName())
                .code(zone.getCode())
                .description(zone.getDescription())
                .capacity(zone.getCapacity())
                .type(zone.getType())
                .places(zone.getPlaces())
                .status(zone.getStatus())
                .createdAt(zone.getCreatedAt())
                .updatedAt(zone.getUpdatedAt())
                .build();
    }

    private String codeGenerator(ZoneRequestDto request) {
        String typeAbbrev = request.getType().name().substring(0, Math.min(3, request.getType().name().length())).toUpperCase();
        long zoneCount = zoneRepository.count();
        String sequentialNumber = String.format("%02d", zoneCount + 1);
        String code = "ZON-" + typeAbbrev + "-" + sequentialNumber;
        return code;
    }
}