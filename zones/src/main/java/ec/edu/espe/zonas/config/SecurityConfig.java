package ec.edu.espe.zonas.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import ec.edu.espe.zonas.security.JwtFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((req, res, e) -> {
                    res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    res.setContentType("application/json;charset=UTF-8");
                    res.getWriter().write("{\"error\":\"No autenticado. Se requiere token de acceso.\"}");
                })
                .accessDeniedHandler((req, res, e) -> {
                    res.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    res.setContentType("application/json;charset=UTF-8");
                    res.getWriter().write("{\"error\":\"Acceso denegado. No tienes permisos para esta acción.\"}");
                })
            )
            .authorizeHttpRequests(auth -> auth
                // Swagger — sin auth
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                // GET: cualquier usuario autenticado (cliente, recaudador, admin, root)
                .requestMatchers(HttpMethod.GET, "/api/v1/**").authenticated()
                // POST / PUT: admin + root (crear y actualizar zonas/espacios)
                .requestMatchers(HttpMethod.POST, "/api/v1/**").hasAnyRole("ADMIN", "ROOT")
                .requestMatchers(HttpMethod.PUT, "/api/v1/**").hasAnyRole("ADMIN", "ROOT")
                // PATCH: admin + root + recaudador (cambio de estado de espacio al emitir/pagar/anular tickets)
                .requestMatchers(HttpMethod.PATCH, "/api/v1/**").hasAnyRole("ADMIN", "ROOT", "RECAUDADOR")
                // DELETE: solo root (eliminación física)
                .requestMatchers(HttpMethod.DELETE, "/api/v1/**").hasRole("ROOT")
                .anyRequest().denyAll()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
