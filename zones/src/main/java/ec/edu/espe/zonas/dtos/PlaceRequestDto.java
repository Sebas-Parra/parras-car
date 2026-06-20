package ec.edu.espe.zonas.dtos;

import java.util.UUID;

import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfPlace;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
public class PlaceRequestDto {

    @NotNull(message = "El ID de la zona es obligatorio")
    private UUID idZone;

    @Size(max = 255, message = "La descripción no puede superar los 255 caracteres")
    @Pattern(regexp = "^$|^.*\\S.*$", message = "La descripción no puede contener solo espacios")
    private String description;

    @Enumerated(EnumType.STRING)
    @NotNull(message = "El tipo de lugar es obligatorio")
    private TypeOfPlace type;

    @Enumerated(EnumType.STRING)
    private StatusOfPlace status;
}
