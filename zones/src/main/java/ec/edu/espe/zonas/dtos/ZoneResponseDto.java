package ec.edu.espe.zonas.dtos;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import ec.edu.espe.zonas.entidades.Place;
import ec.edu.espe.zonas.entidades.enums.TypeOfZone;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ZoneResponseDto {

    private UUID id;

    private String name;

    private String code;

    private String description;

    private int status;     // 1 for active, 0 for inactive

    private TypeOfZone type;

    private int capacity;

    private List<Place> places;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
