package ec.edu.espe.zonas.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

import ec.edu.espe.zonas.dtos.ZoneRequestDto;
import ec.edu.espe.zonas.dtos.ZoneResponseDto;
import ec.edu.espe.zonas.entidades.enums.TypeOfZone;
import ec.edu.espe.zonas.service.ZoneService;

@ExtendWith(MockitoExtension.class)
class ZoneControllerTest {

    @Mock
    private ZoneService zoneService;

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @BeforeEach
    void setUp() {
        ZoneController controller = new ZoneController(zoneService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void getAllZonesReturnsOk() throws Exception {
        when(zoneService.getAllZones()).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/zones"))
                .andExpect(status().isOk());

        verify(zoneService).getAllZones();
    }

    @Test
    void getZoneByIdReturnsOk() throws Exception {
        UUID id = UUID.randomUUID();
        when(zoneService.getZoneById(id)).thenReturn(ZoneResponseDto.builder().id(id).build());

        mockMvc.perform(get("/api/v1/zones/{idZone}", id))
                .andExpect(status().isOk());
    }

    @Test
    void createZoneReturnsCreated() throws Exception {
        ZoneRequestDto request = ZoneRequestDto.builder()
                .name("Zona Norte")
                .capacity(10)
                .type(TypeOfZone.REGULAR)
                .build();
        when(zoneService.createZone(any(ZoneRequestDto.class)))
                .thenReturn(ZoneResponseDto.builder().id(UUID.randomUUID()).build());

        mockMvc.perform(post("/api/v1/zones")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());
    }

    @Test
    void updateZoneReturnsOk() throws Exception {
        UUID id = UUID.randomUUID();
        ZoneRequestDto request = ZoneRequestDto.builder()
                .name("Zona Sur")
                .capacity(5)
                .type(TypeOfZone.VIP)
                .build();
        when(zoneService.updateZone(eq(id), any(ZoneRequestDto.class)))
                .thenReturn(ZoneResponseDto.builder().id(id).build());

        mockMvc.perform(put("/api/v1/zones/{idZone}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
    }

    @Test
    void changeStatusReturnsOk() throws Exception {
        UUID id = UUID.randomUUID();

        mockMvc.perform(put("/api/v1/zones/{idZone}/status", id))
                .andExpect(status().isOk());

        verify(zoneService).changeStatus(id);
    }

    @Test
    void deleteZoneReturnsNoContent() throws Exception {
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/zones/{idZone}", id))
                .andExpect(status().isNoContent());

        verify(zoneService).deleteZone(id);
    }
}
