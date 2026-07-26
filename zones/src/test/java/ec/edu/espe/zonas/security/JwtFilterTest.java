package ec.edu.espe.zonas.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.io.PrintWriter;
import java.io.StringWriter;
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
import org.springframework.web.client.RestClientException;
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
        restTemplate = mock(RestTemplate.class);
        ReflectionTestUtils.setField(jwtFilter, "jwtSecret", SECRET);
        ReflectionTestUtils.setField(jwtFilter, "usersServiceUrl", "http://users-service");
        ReflectionTestUtils.setField(jwtFilter, "restTemplate", restTemplate);
        ReflectionTestUtils.invokeMethod(jwtFilter, "initKey");
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private String buildToken(String userId, String username) {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject(userId)
                .claim("username", username)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(key)
                .compact();
    }

    @Test
    void putsUsernameUserIdAndRolesIntoTheAuthenticatedPrincipal() throws Exception {
        String token = buildToken("user-123", "jdoe");

        when(restTemplate.getForObject("http://users-service/users/user-123/roles", Map.class))
                .thenReturn(Map.of("roles", List.of("admin")));

        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);

        jwtFilter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        AuthenticatedUser principal =
                (AuthenticatedUser) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assertThat(principal.userId()).isEqualTo("user-123");
        assertThat(principal.username()).isEqualTo("jdoe");
        assertThat(principal.roles()).containsExactly("admin");
        assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
                .extracting(Object::toString)
                .containsExactly("ROLE_ADMIN");
    }

    @Test
    void continuesTheChainWithoutAuthenticationWhenNoAuthorizationHeaderIsPresent() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getHeader("Authorization")).thenReturn(null);

        jwtFilter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(restTemplate);
    }

    @Test
    void continuesTheChainWithoutAuthenticationWhenHeaderIsNotBearer() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getHeader("Authorization")).thenReturn("Basic abc123");

        jwtFilter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void returnsUnauthorizedForAnInvalidToken() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getHeader("Authorization")).thenReturn("Bearer not-a-real-token");

        StringWriter writer = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(writer));

        jwtFilter.doFilterInternal(request, response, chain);

        verify(chain, never()).doFilter(request, response);
        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        assertThat(writer.toString()).contains("Token inválido o expirado");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void resolvesEmptyRolesWhenTheUsersServiceIsUnreachable() throws Exception {
        String token = buildToken("user-456", "asmith");

        when(restTemplate.getForObject(anyString(), org.mockito.ArgumentMatchers.eq(Map.class)))
                .thenThrow(new RestClientException("connection refused"));

        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);

        jwtFilter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        AuthenticatedUser principal =
                (AuthenticatedUser) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assertThat(principal.roles()).isEmpty();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities()).isEmpty();
    }

    @Test
    void resolvesEmptyRolesWhenTheResponseHasNoRolesList() throws Exception {
        String token = buildToken("user-789", "bwayne");

        when(restTemplate.getForObject("http://users-service/users/user-789/roles", Map.class))
                .thenReturn(Map.of("other", "value"));

        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);

        jwtFilter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        AuthenticatedUser principal =
                (AuthenticatedUser) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assertThat(principal.roles()).isEmpty();
    }
}
