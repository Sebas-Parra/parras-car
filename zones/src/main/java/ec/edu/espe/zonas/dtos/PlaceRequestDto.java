package ec.edu.espe.zonas.dtos;

import java.util.UUID;

import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfPlace;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlaceRequestDto {
    @NotNull(message = "Zone ID is required")
    private UUID idZone;

    @NotBlank(message = "Code is required")
    @Size(min = 1, max = 15, message = "Code must be between 1 and 15 characters")
    private String code;

    private String description;

    @Enumerated(EnumType.STRING)
    @NotNull(message = "Type of place is required")
    private TypeOfPlace type;

    @Enumerated(EnumType.STRING)
    private StatusOfPlace status;
}