package ec.edu.espe.zonas.repositories;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import ec.edu.espe.zonas.entidades.Zone;

public interface ZoneRepository extends JpaRepository<Zone, UUID>{
    boolean existsByCode(String code);

    boolean existsByName(String name);
}
