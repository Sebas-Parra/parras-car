package ec.edu.espe.zonas.dtos;

import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdatePlaceStatusDto {

    @NotNull(message = "El estado es obligatorio")
    private StatusOfPlace status;
}
