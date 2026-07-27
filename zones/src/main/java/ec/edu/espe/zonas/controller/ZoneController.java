package ec.edu.espe.zonas.controller;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ec.edu.espe.zonas.dtos.PagedResponseDto;
import ec.edu.espe.zonas.dtos.ZoneRequestDto;
import ec.edu.espe.zonas.dtos.ZoneResponseDto;
import ec.edu.espe.zonas.service.ZoneService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/zones")
@Validated
@RequiredArgsConstructor
public class ZoneController {

    private final ZoneService zoneService;

    // Catálogo acotado por la cantidad real de zonas del lote (no crece sin
    // límite), así que el tope es más alto para no romper los buscadores
    // tipo-combobox de otras páginas que necesitan ver todo.
    private static final int MAX_PAGE_SIZE = 500;

    @GetMapping
    public ResponseEntity<PagedResponseDto<ZoneResponseDto>> getAllZones(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "100") int pageSize) {
        int safePage = Math.max(1, page);
        int safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
        return ResponseEntity.ok(zoneService.getAllZones(safePage, safePageSize));
    }

    @GetMapping("/{idZone}")
    public ResponseEntity<ZoneResponseDto> getZoneById(@PathVariable UUID idZone) {
        return ResponseEntity.ok(zoneService.getZoneById(idZone));
    }

    @PostMapping
    public ResponseEntity<ZoneResponseDto> createZone(@Valid @RequestBody ZoneRequestDto request) {
        return new ResponseEntity<>(zoneService.createZone(request), HttpStatus.CREATED);
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

    @DeleteMapping("/{idZone}")
    public ResponseEntity<Void> deleteZone(@PathVariable UUID idZone) {
        zoneService.deleteZone(idZone);
        return ResponseEntity.noContent().build();
    }
}
