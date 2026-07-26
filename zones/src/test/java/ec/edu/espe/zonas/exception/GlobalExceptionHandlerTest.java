package ec.edu.espe.zonas.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;

import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handleValidationErrorsReturnsBadRequestWithFieldErrors() {
        MethodArgumentNotValidException ex = mock(MethodArgumentNotValidException.class);
        BindingResult bindingResult = mock(BindingResult.class);
        when(ex.getBindingResult()).thenReturn(bindingResult);
        FieldError fieldError = new FieldError("request", "name", "El nombre es obligatorio");
        when(bindingResult.getFieldErrors()).thenReturn(List.of(fieldError));

        ResponseEntity<Map<String, Object>> response = handler.handleValidationErrors(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("status", 400);
        assertThat(response.getBody()).containsEntry("error", "Datos inválidos");
        @SuppressWarnings("unchecked")
        List<Map<String, String>> messages = (List<Map<String, String>>) response.getBody().get("messages");
        assertThat(messages).hasSize(1);
        assertThat(messages.get(0)).containsEntry("field", "name");
        assertThat(messages.get(0)).containsEntry("message", "El nombre es obligatorio");
    }

    @Test
    void handleNotReadableWithEnumCauseListsAcceptedValues() {
        JsonParser parser = mock(JsonParser.class);
        InvalidFormatException ife = new InvalidFormatException(parser, "bad value", "BOGUS", StatusOfPlace.class);
        HttpMessageNotReadableException ex = new HttpMessageNotReadableException("not readable", ife, null);

        ResponseEntity<Map<String, Object>> response = handler.handleNotReadable(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        String error = (String) response.getBody().get("error");
        assertThat(error).contains("BOGUS");
        assertThat(error).contains("AVAILABLE");
    }

    @Test
    void handleNotReadableWithoutEnumCauseReturnsGenericMessage() {
        HttpMessageNotReadableException ex = new HttpMessageNotReadableException("not readable", null);

        ResponseEntity<Map<String, Object>> response = handler.handleNotReadable(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("error"))
                .isEqualTo("El cuerpo de la solicitud no es válido o no se puede leer");
    }

    @Test
    void handleTypeMismatchWithEnumTypeListsAcceptedValues() {
        MethodParameter parameter = mock(MethodParameter.class);
        MethodArgumentTypeMismatchException ex = new MethodArgumentTypeMismatchException(
                "BOGUS", StatusOfPlace.class, "status", parameter, new IllegalArgumentException("bad"));

        ResponseEntity<Map<String, Object>> response = handler.handleTypeMismatch(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        String error = (String) response.getBody().get("error");
        assertThat(error).contains("status");
        assertThat(error).contains("BOGUS");
        assertThat(error).contains("MAINTENANCE");
    }

    @Test
    void handleTypeMismatchWithNonEnumTypeOmitsAcceptedValues() {
        MethodParameter parameter = mock(MethodParameter.class);
        MethodArgumentTypeMismatchException ex = new MethodArgumentTypeMismatchException(
                "abc", Integer.class, "zone", parameter, new IllegalArgumentException("bad"));

        ResponseEntity<Map<String, Object>> response = handler.handleTypeMismatch(ex);

        String error = (String) response.getBody().get("error");
        assertThat(error).doesNotContain("Valores aceptados");
    }

    @Test
    void handleResponseStatusUsesTheReasonWhenPresent() {
        ResponseStatusException ex = new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una zona");

        ResponseEntity<Map<String, Object>> response = handler.handleResponseStatus(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("error")).isEqualTo("Ya existe una zona");
    }

    @Test
    void handleResponseStatusUsesADefaultMessageWhenReasonIsAbsent() {
        ResponseStatusException ex = new ResponseStatusException(HttpStatus.NOT_FOUND);

        ResponseEntity<Map<String, Object>> response = handler.handleResponseStatus(ex);

        assertThat(response.getBody().get("error")).isEqualTo("Ocurrió un error al procesar la solicitud");
    }

    @Test
    void handleGenericReturnsInternalServerError() {
        ResponseEntity<Map<String, Object>> response = handler.handleGeneric(new RuntimeException("boom"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().get("error"))
                .isEqualTo("Ha ocurrido un error inesperado. Por favor intente nuevamente más tarde");
    }
}
