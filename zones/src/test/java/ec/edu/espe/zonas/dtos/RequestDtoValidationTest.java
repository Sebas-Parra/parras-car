package ec.edu.espe.zonas.dtos;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.Test;

import ec.edu.espe.zonas.entidades.enums.TypeOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfZone;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

class RequestDtoValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private ZoneRequestDto zoneWithDescription(String description) {
        return ZoneRequestDto.builder()
                .name("Zona Norte")
                .description(description)
                .capacity(10)
                .type(TypeOfZone.REGULAR)
                .build();
    }

    private PlaceRequestDto placeWithDescription(String description) {
        return PlaceRequestDto.builder()
                .idZone(java.util.UUID.randomUUID())
                .description(description)
                .type(TypeOfPlace.CAR)
                .build();
    }

    @Test
    void zoneDescriptionRejectsScriptTags() {
        Set<ConstraintViolation<ZoneRequestDto>> violations = validator.validate(zoneWithDescription("<script>alert(1)</script>"));
        assertThat(violations).isNotEmpty();
    }

    @Test
    void zoneDescriptionRejectsSqlInjectionLookingInput() {
        Set<ConstraintViolation<ZoneRequestDto>> violations = validator.validate(zoneWithDescription("'; DROP TABLE zones; --"));
        assertThat(violations).isNotEmpty();
    }

    @Test
    void zoneDescriptionAcceptsAllowedPunctuation() {
        Set<ConstraintViolation<ZoneRequestDto>> violations =
                validator.validate(zoneWithDescription("Zona norte, edificio A - piso 2 (bloque #3)"));
        assertThat(violations).isEmpty();
    }

    @Test
    void zoneDescriptionAcceptsEmpty() {
        Set<ConstraintViolation<ZoneRequestDto>> violations = validator.validate(zoneWithDescription(""));
        assertThat(violations).isEmpty();
    }

    @Test
    void placeDescriptionRejectsScriptTags() {
        Set<ConstraintViolation<PlaceRequestDto>> violations = validator.validate(placeWithDescription("<img src=x onerror=alert(1)>"));
        assertThat(violations).isNotEmpty();
    }

    @Test
    void placeDescriptionRejectsSqlInjectionLookingInput() {
        Set<ConstraintViolation<PlaceRequestDto>> violations = validator.validate(placeWithDescription("1' OR '1'='1"));
        assertThat(violations).isNotEmpty();
    }

    @Test
    void placeDescriptionAcceptsAllowedPunctuation() {
        Set<ConstraintViolation<PlaceRequestDto>> violations = validator.validate(placeWithDescription("Cerca de la entrada #2"));
        assertThat(violations).isEmpty();
    }
}
