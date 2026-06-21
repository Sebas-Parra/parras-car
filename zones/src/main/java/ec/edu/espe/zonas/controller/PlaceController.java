package ec.edu.espe.zonas.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ec.edu.espe.zonas.dtos.PlaceRequestDto;
import ec.edu.espe.zonas.dtos.PlaceResponseDto;
import ec.edu.espe.zonas.dtos.UpdatePlaceStatusDto;
import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.service.PlaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/places")
@Validated
@RequiredArgsConstructor
public class PlaceController {

    private final PlaceService placeService;

    @GetMapping
    public ResponseEntity<List<PlaceResponseDto>> getPlaces(
            @RequestParam(required = false) StatusOfPlace status,
            @RequestParam(required = false) UUID zone) {
        if (status != null && zone != null) {
            return ResponseEntity.ok(placeService.getPlacesByZoneAndStatus(zone, status));
        }
        if (status != null) {
            return ResponseEntity.ok(placeService.getPlacesByStatus(status));
        }
        return ResponseEntity.ok(placeService.getAllPlaces());
    }

    @PostMapping
    public ResponseEntity<PlaceResponseDto> createPlace(@Valid @RequestBody PlaceRequestDto request) {
        return new ResponseEntity<>(placeService.createPlace(request), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<PlaceResponseDto> updatePlace(@PathVariable UUID id,
            @Valid @RequestBody PlaceRequestDto request) {
        return ResponseEntity.ok(placeService.updatePlace(request, id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePlace(@PathVariable UUID id) {
        placeService.deletePlaceById(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<PlaceResponseDto> changeStatus(@PathVariable UUID id,
            @Valid @RequestBody UpdatePlaceStatusDto body) {
        return ResponseEntity.ok(placeService.changeStatus(body.getStatus(), id));
    }
}