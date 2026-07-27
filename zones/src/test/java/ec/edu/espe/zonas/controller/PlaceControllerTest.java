package ec.edu.espe.zonas.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.fasterxml.jackson.databind.ObjectMapper;

import ec.edu.espe.zonas.dtos.PlaceRequestDto;
import ec.edu.espe.zonas.dtos.PlaceResponseDto;
import ec.edu.espe.zonas.dtos.UpdatePlaceStatusDto;
import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfPlace;
import ec.edu.espe.zonas.service.PlaceService;
import ec.edu.espe.zonas.sse.SseService;

@ExtendWith(MockitoExtension.class)
class PlaceControllerTest {

    @Mock
    private PlaceService placeService;

    @Mock
    private SseService sseService;

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @BeforeEach
    void setUp() {
        PlaceController controller = new PlaceController(placeService, sseService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void getPlacesWithoutFiltersReturnsAllPlaces() throws Exception {
        when(placeService.getAllPlaces()).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/places"))
                .andExpect(status().isOk());

        verify(placeService).getAllPlaces();
    }

    @Test
    void getPlacesWithStatusOnlyReturnsFilteredByStatus() throws Exception {
        when(placeService.getPlacesByStatus(StatusOfPlace.AVAILABLE)).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/places").param("status", "AVAILABLE"))
                .andExpect(status().isOk());

        verify(placeService).getPlacesByStatus(StatusOfPlace.AVAILABLE);
    }

    @Test
    void getPlacesWithZoneAndStatusReturnsFilteredByBoth() throws Exception {
        UUID zoneId = UUID.randomUUID();
        when(placeService.getPlacesByZoneAndStatus(zoneId, StatusOfPlace.OCCUPIED)).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/places")
                        .param("status", "OCCUPIED")
                        .param("zone", zoneId.toString()))
                .andExpect(status().isOk());

        verify(placeService).getPlacesByZoneAndStatus(zoneId, StatusOfPlace.OCCUPIED);
    }

    @Test
    void createPlaceReturnsCreated() throws Exception {
        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(UUID.randomUUID());
        request.setType(TypeOfPlace.CAR);

        PlaceResponseDto response = PlaceResponseDto.builder().id(UUID.randomUUID()).build();
        when(placeService.createPlace(any(PlaceRequestDto.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/places")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());
    }

    @Test
    void updatePlaceReturnsOk() throws Exception {
        UUID id = UUID.randomUUID();
        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(UUID.randomUUID());
        request.setType(TypeOfPlace.CAR);

        PlaceResponseDto response = PlaceResponseDto.builder().id(id).build();
        when(placeService.updatePlace(any(PlaceRequestDto.class), eq(id))).thenReturn(response);

        mockMvc.perform(put("/api/v1/places/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
    }

    @Test
    void deletePlaceReturnsNoContent() throws Exception {
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/places/{id}", id))
                .andExpect(status().isNoContent());

        verify(placeService).deletePlaceById(id);
    }

    @Test
    void changeStatusReturnsOk() throws Exception {
        UUID id = UUID.randomUUID();
        UpdatePlaceStatusDto body = new UpdatePlaceStatusDto(StatusOfPlace.OCCUPIED);
        PlaceResponseDto response = PlaceResponseDto.builder().id(id).status(StatusOfPlace.OCCUPIED).build();
        when(placeService.changeStatus(StatusOfPlace.OCCUPIED, id)).thenReturn(response);

        mockMvc.perform(patch("/api/v1/places/{id}/status", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }
}
