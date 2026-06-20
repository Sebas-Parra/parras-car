package ec.edu.espe.zonas.service;

import java.util.List;
import java.util.UUID;

import ec.edu.espe.zonas.dtos.ZoneRequestDto;
import ec.edu.espe.zonas.dtos.ZoneResponseDto;

public interface ZoneService {

    List<ZoneResponseDto> getAllZones();

    ZoneResponseDto getZoneById(UUID idZone);

    ZoneResponseDto createZone(ZoneRequestDto request);

    ZoneResponseDto updateZone(UUID idZone, ZoneRequestDto request);

    void changeStatus(UUID idZone);
}
