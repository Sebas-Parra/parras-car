package ec.edu.espe.zonas.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Map;

import javax.crypto.SecretKey;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

class JwtFilterTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-32bytes";

    private JwtFilter jwtFilter;
    private RestTemplate restTemplate;

    @BeforeEach
    void setUp() {
        jwtFilter = new JwtFilter();
        ReflectionTestUtils.setField(jwtFilter, "jwtSecret", SECRET);
        ReflectionTestUtils.setField(jwtFilter, "usersServiceUrl", "http://users-test");
        ReflectionTestUtils.invokeMethod(jwtFilter, "initKey");

        restTemplate = mock(RestTemplate.class);
        ReflectionTestUtils.setField(jwtFilter, "restTemplate", restTemplate);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void putsUsernameUserIdAndRolesIntoTheAuthenticatedPrincipal() throws Exception {
        // Roles ya NO viajan en el JWT (ver fix(auth)) — el filtro las obtiene
        // consultando al servicio de usuarios.
        when(restTemplate.getForObject(anyString(), org.mockito.ArgumentMatchers.eq(Map.class)))
                .thenReturn(Map.of("roles", List.of("admin")));

        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
                .subject("user-123")
                .claim("username", "jdoe")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(key)
                .compact();

        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        org.mockito.Mockito.when(request.getHeader("Authorization")).thenReturn("Bearer " + token);

        jwtFilter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        AuthenticatedUser principal =
                (AuthenticatedUser) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assertThat(principal.userId()).isEqualTo("user-123");
        assertThat(principal.username()).isEqualTo("jdoe");
        assertThat(principal.roles()).containsExactly("admin");
    }
}
