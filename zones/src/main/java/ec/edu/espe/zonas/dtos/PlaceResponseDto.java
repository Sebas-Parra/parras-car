package ec.edu.espe.zonas.dtos;

import java.time.LocalDateTime;
import java.util.UUID;

import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfPlace;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlaceResponseDto {
    private UUID id;

    private String code;

    private String description;

    private TypeOfPlace type;

    private boolean isActive;

    private StatusOfPlace status;

    private UUID idZone;

    private String nameZone;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
