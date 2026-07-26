package ec.edu.espe.zonas.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import jakarta.annotation.PostConstruct;
import javax.crypto.SecretKey;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.filter.OncePerRequestFilter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtFilter.class);

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${users.service.url}")
    private String usersServiceUrl;

    // Not final so tests can substitute a mock via reflection without changing runtime wiring.
    private RestTemplate restTemplate = new RestTemplate();

    private SecretKey secretKey;

    @PostConstruct
    void initKey() {
        secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    // Roles NO están en el JWT (por seguridad); se obtienen del servicio de usuarios.
    @SuppressWarnings("unchecked")
    private List<String> fetchUserRoles(String userId) {
        try {
            Map<String, Object> response = restTemplate.getForObject(
                    usersServiceUrl + "/users/" + userId + "/roles", Map.class);
            Object roles = response != null ? response.get("roles") : null;
            if (roles instanceof List<?> rawRoles) {
                return rawRoles.stream().map(Object::toString).collect(Collectors.toList());
            }
        } catch (RestClientException e) {
            log.warn("No se pudieron obtener los roles del usuario {}: {}", userId, e.getMessage());
        }
        return Collections.emptyList();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                Claims claims = Jwts.parser()
                        .verifyWith(secretKey)
                        .build()
                        .parseSignedClaims(token)
                        .getPayload();

                List<String> roleNames = fetchUserRoles(claims.getSubject());
                List<GrantedAuthority> authorities = roleNames.stream()
                        .map(r -> new SimpleGrantedAuthority("ROLE_" + r.toUpperCase()))
                        .collect(Collectors.toList());

                AuthenticatedUser principal = new AuthenticatedUser(
                        claims.getSubject(),
                        claims.get("username", String.class),
                        roleNames);

                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(principal, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(auth);

            } catch (JwtException e) {
                SecurityContextHolder.clearContext();
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"error\":\"Token inválido o expirado.\"}");
                return;
            }
        }

        chain.doFilter(request, response);
    }
}
