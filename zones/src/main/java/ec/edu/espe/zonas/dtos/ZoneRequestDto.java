package ec.edu.espe.zonas.dtos;

import ec.edu.espe.zonas.entidades.enums.TypeOfZone;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
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

    @NotBlank(message = "El nombre es obligatorio")
    @Size(min = 2, max = 32, message = "El nombre debe tener entre 2 y 32 caracteres")
    @Pattern(regexp = "^.*\\S.*$", message = "El nombre no puede contener solo espacios")
    @Pattern(regexp = "^[\\p{L}\\s\\-]+$", message = "El nombre solo puede contener letras, espacios y guiones")
    private String name;

    @Size(max = 255, message = "La descripción no puede superar los 255 caracteres")
    @Pattern(regexp = "^$|^.*\\S.*$", message = "La descripción no puede contener solo espacios")
    private String description;

    @Min(value = 1, message = "La capacidad debe ser al menos 1")
    @Max(value = 1000, message = "La capacidad no puede superar 1000")
    private int capacity;

    @Enumerated(EnumType.STRING)
    @NotNull(message = "El tipo de zona es obligatorio")
    private TypeOfZone type;
}
