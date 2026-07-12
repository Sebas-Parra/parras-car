package ec.edu.espe.zonas.security;

import java.util.List;

public record AuthenticatedUser(String userId, String username, List<String> roles) {
}
