package ec.edu.espe.zonas.repositories;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import ec.edu.espe.zonas.entidades.Zone;

public interface ZoneRepository extends JpaRepository<Zone, UUID>{
    boolean existsByCode(String code);

    boolean existsByName(String name);

    // Busca por nombre ignorando mayúsculas/minúsculas y espacios intermedios
    @Query("SELECT COUNT(z) > 0 FROM Zone z WHERE LOWER(REPLACE(z.name, ' ', '')) = LOWER(REPLACE(:normalized, ' ', ''))")
    boolean existsByNameNormalized(@Param("normalized") String normalized);
}
