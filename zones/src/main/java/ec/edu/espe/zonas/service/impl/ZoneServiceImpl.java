package ec.edu.espe.zonas.service.impl;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import ec.edu.espe.zonas.audit.AuditEvent;
import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dtos.ZoneRequestDto;
import ec.edu.espe.zonas.dtos.ZoneResponseDto;
import ec.edu.espe.zonas.entidades.Place;
import ec.edu.espe.zonas.entidades.Zone;
import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.repositories.PlaceRepository;
import ec.edu.espe.zonas.repositories.ZoneRepository;
import ec.edu.espe.zonas.security.AuthenticatedUser;
import ec.edu.espe.zonas.security.ClientIp;
import ec.edu.espe.zonas.security.CurrentUser;
import ec.edu.espe.zonas.service.ZoneService;

@Service
public class ZoneServiceImpl implements ZoneService {

    @Autowired
    private ZoneRepository zoneRepository;

    @Autowired
    private PlaceRepository placeRepository;

    @Autowired
    private AuditPublisher auditPublisher;

    @Override
    @Transactional(readOnly = true)
    public List<ZoneResponseDto> getAllZones() {
        return zoneRepository.findAll()
            .stream()
            .map(this::toResponseDto)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ZoneResponseDto getZoneById(UUID idZone) {
        Zone zone = zoneRepository.findById(idZone)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));
        return toResponseDto(zone);
    }

    @Override
    public ZoneResponseDto createZone(ZoneRequestDto request) {
        if (zoneRepository.existsByNameNormalized(request.getName().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una zona con ese nombre");
        }

        Zone objZone = new Zone();
        objZone.setName(request.getName().trim());
        objZone.setCode(codeGenerator(request));
        objZone.setDescription(request.getDescription() != null ? request.getDescription().trim() : null);
        objZone.setCapacity(request.getCapacity());
        objZone.setType(request.getType());
        objZone.setStatus(1);
        objZone.setCreatedAt(LocalDateTime.now());
        objZone.setUpdatedAt(LocalDateTime.now());

        zoneRepository.save(objZone);
        emitEvent("CREATE", objZone, Map.of("name", objZone.getName(), "code", objZone.getCode()));
        return toResponseDto(objZone);
    }

    @Override
    @Transactional
    public ZoneResponseDto updateZone(UUID idZone, ZoneRequestDto request) {
        Zone zone = zoneRepository.findById(idZone)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));

        String trimmedName = request.getName().trim();
        String normalizedNew = trimmedName.replaceAll("\\s+", "").toLowerCase();
        String normalizedCurrent = zone.getName().replaceAll("\\s+", "").toLowerCase();
        if (!normalizedNew.equals(normalizedCurrent) && zoneRepository.existsByNameNormalized(trimmedName)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una zona con ese nombre");
        }

        long existingPlaces = placeRepository.countByZone(zone);
        if (request.getCapacity() < existingPlaces) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "No se puede reducir la capacidad por debajo del número de lugares existentes (" + existingPlaces + ")");
        }

        zone.setName(trimmedName);
        zone.setDescription(request.getDescription() != null ? request.getDescription().trim() : null);
        zone.setCapacity(request.getCapacity());
        zone.setType(request.getType());
        zone.setUpdatedAt(LocalDateTime.now());

        Zone saved = zoneRepository.save(zone);
        emitEvent("UPDATE", saved, Map.of("name", saved.getName(), "capacity", saved.getCapacity()));
        return toResponseDto(saved);
    }

    @Override
    @Transactional
    public void changeStatus(UUID idZone) {
        Zone zone = zoneRepository.findById(idZone)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));

        int newStatus = (zone.getStatus() == 1) ? 0 : 1;

        if (newStatus == 0) {
            boolean hasOccupiedPlaces = placeRepository.existsByZoneAndStatus(zone, StatusOfPlace.OCCUPIED);
            if (hasOccupiedPlaces) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No se puede desactivar la zona: existen lugares ocupados");
            }
            for (Place place : zone.getPlaces()) {
                place.setActive(false);
            }
            placeRepository.saveAll(zone.getPlaces());
        } else {
            for (Place place : zone.getPlaces()) {
                place.setActive(true);
            }
            placeRepository.saveAll(zone.getPlaces());
        }

        zone.setStatus(newStatus);
        zone.setUpdatedAt(LocalDateTime.now());
        zoneRepository.save(zone);
        emitEvent("UPDATE", zone, Map.of("status", newStatus));
    }

    @Override
    @Transactional
    public void deleteZone(UUID idZone) {
        Zone zone = zoneRepository.findById(idZone)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));
        boolean hasOccupiedPlaces = placeRepository.existsByZoneAndStatus(zone, StatusOfPlace.OCCUPIED);
        if (hasOccupiedPlaces) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "No se puede eliminar la zona: existen lugares ocupados");
        }

        zoneRepository.delete(zone);
        emitEvent("DELETE", zone, Map.of("name", zone.getName()));
    }

    private void emitEvent(String accion, Zone zone, Map<String, Object> datosExtra) {
        AuthenticatedUser actor = CurrentUser.get();
        AuditEvent event = new AuditEvent(
                "ms-zonas",
                accion,
                "ZONA",
                zone.getId() != null ? zone.getId().toString() : null,
                datosExtra,
                actor.username(),
                actor.roles().isEmpty() ? "" : actor.roles().get(0),
                ClientIp.get());
        auditPublisher.publish(event);
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
        String typeAbbrev = request.getType().name()
            .substring(0, Math.min(3, request.getType().name().length()))
            .toUpperCase();
        long zoneCount = zoneRepository.count();
        String sequentialNumber = String.format("%02d", zoneCount + 1);
        return "ZON-" + typeAbbrev + "-" + sequentialNumber;
    }
}
