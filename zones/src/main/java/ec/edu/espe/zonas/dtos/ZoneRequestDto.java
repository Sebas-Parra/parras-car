package ec.edu.espe.zonas.dtos;

import ec.edu.espe.zonas.entidades.enums.TypeOfZone;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
public class ZoneRequestDto {

    @NotBlank(message = "Name is required")
    @Size(min = 1, max = 32, message = "Name must be between 1 and 32 characters")
    private String name;

    private String description;

    @Min(value = 1, message = "Capacity must be at least 1")
    @Max(value = 100, message = "Capacity must be less than or equal to 100")
    private int capacity;

    @Enumerated(EnumType.STRING)
    @NotNull(message = "Type of zone is required")
    private TypeOfZone type;
}