package ec.edu.espe.zonas.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ec.edu.espe.zonas.dtos.ZoneRequestDto;
import ec.edu.espe.zonas.dtos.ZoneResponseDto;
import ec.edu.espe.zonas.service.ZoneService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PutMapping;


@RestController
@RequestMapping("/api/v1/zones")
@Validated
@RequiredArgsConstructor
public class ZoneController {
    
    private final ZoneService zoneService;

    @GetMapping
    public ResponseEntity<List<ZoneResponseDto>> getAllZones() {
        return ResponseEntity.ok(zoneService.getAllZones()); //200
    }

    @PostMapping
    public ResponseEntity<ZoneResponseDto> createZone(@Valid @RequestBody ZoneRequestDto request) {
        return new ResponseEntity<>(zoneService.createZone(request), HttpStatus.CREATED); //201
    }

    @PutMapping("/{idZone}")
    public ResponseEntity<ZoneResponseDto> updateZone(@PathVariable UUID idZone,
            @Valid @RequestBody ZoneRequestDto request) {
        return ResponseEntity.ok(zoneService.updateZone(idZone, request));
    }

    @PutMapping("/{idZone}/status")
    public ResponseEntity<Void> changeStatus(@PathVariable UUID idZone) {
        zoneService.changeStatus(idZone);
        return ResponseEntity.ok().build();
    }
}
