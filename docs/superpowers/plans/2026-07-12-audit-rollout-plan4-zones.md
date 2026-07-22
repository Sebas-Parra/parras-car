# Plan 4: zones audit publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `zones` Spring Boot microservice publish audit events to the centralized `ms-audit` service for zone and place CRUD.

**Architecture:** `zones` gets a Spring AMQP `RabbitTemplate` (auto-configured via `spring-boot-starter-amqp`) wrapped in a small `AuditPublisher` service that converts an `AuditEvent` record to JSON and publishes it — failures are caught and logged, never thrown, so a `ms-audit`/RabbitMQ outage never breaks a `zones` request. Unlike the Node/Python services (which thread the acting user through controller → service as an explicit parameter), Spring Security already stores the authenticated principal in a request-scoped `SecurityContextHolder`, so `zones` reads it directly inside the service layer with no controller changes needed — but first `JwtFilter` must be fixed to actually put `username` into that principal, since today it only extracts the user id (`sub`) and roles, never the username the JWT payload also carries.

**Tech Stack:** Spring Boot 4.0 (`spring-boot-starter-webmvc`, `-data-jpa`, `-security`, `-amqp`), JJWT, JUnit 5, Mockito.

## Global Constraints

- `servicio` is exactly `'ms-zonas'`, matching `ms-audit`'s allow-list (`SERVICIOS_VALIDOS` in `ms-audit/src/audit/dto/create-audit-event.dto.ts`).
- `entidad` is `'ZONA'` for zone operations and `'PLACE'` for place operations — both already in `ms-audit`'s `ENTIDADES_VALIDAS` allow-list.
- `accion` is one of `CREATE|UPDATE|DELETE|LOGIN|LOGOUT|SELECT`. This plan uses `CREATE`, `UPDATE` (edits and status changes), `DELETE`.
- `usuario`/`rol` are mandatory on every event `ms-audit` accepts, and must come from the authenticated JWT principal (never from request body). `rol` uses the first role, matching the same `roles[0]` tradeoff already accepted in `vehicles`/`tickets`/`users`.
- A `ms-audit`/RabbitMQ outage must never fail a `zones` request — every publish call is wrapped so exceptions are caught and logged, not raised.
- Verify with `mvn test` after each task (uses Mockito-mocked repositories/beans — no live Postgres/RabbitMQ required for unit tests; `@SpringBootTest`-style full-context tests are out of scope for this plan since this project has no test database configured).

---

### Task 1: Add the Spring AMQP audit publisher to `zones`

**Files:**
- Create: `zones/src/main/java/ec/edu/espe/zonas/audit/AuditEvent.java`
- Create: `zones/src/main/java/ec/edu/espe/zonas/audit/AuditPublisher.java`
- Create: `zones/src/main/java/ec/edu/espe/zonas/config/RabbitConfig.java`
- Test: `zones/src/test/java/ec/edu/espe/zonas/audit/AuditPublisherTest.java`
- Modify: `zones/pom.xml`
- Modify: `zones/src/main/resources/application.yaml`

**Interfaces:**
- Produces: `AuditEvent` record (`servicio, accion, entidad, entidadId, datos, usuario, rol`) and `AuditPublisher.publish(AuditEvent event): void`, both in package `ec.edu.espe.zonas.audit` — Tasks 3-4 call `AuditPublisher.publish(...)`.

- [ ] **Step 1: Add `spring-boot-starter-amqp` to `zones/pom.xml`**

In the `<dependencies>` block, add (right after `spring-boot-starter-security`):

```xml
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-amqp</artifactId>
		</dependency>
```

- [ ] **Step 2: Add RabbitMQ config to `application.yaml`**

Append to `zones/src/main/resources/application.yaml`:

```yaml

spring:
  rabbitmq:
    host: ${RABBITMQ_HOST:localhost}
    port: ${RABBITMQ_PORT:5672}
    username: ${RABBITMQ_USER:guest}
    password: ${RABBITMQ_PASSWORD:guest}

audit:
  rabbitmq:
    exchange: ${RABBITMQ_EXCHANGE:audit_exchange}
    routing-key: ${RABBITMQ_ROUTING_KEY:audit_event}
```

(Note: `spring.rabbitmq.*` is a second top-level `spring:` key — YAML merges top-level maps with the same key across a file only if they're literally the same mapping node; since `application.yaml` already has a `spring:` block at the top of the file, you must merge `rabbitmq:` into the **existing** `spring:` block rather than adding a second `spring:` key. Read the current file first and add `rabbitmq:` as a sibling of `application:`/`autoconfigure:`/`jackson:`/`datasource:`/`jpa:` inside the one existing `spring:` map. The new `audit:` block is a new top-level key and can be appended anywhere at the top level, e.g. after the existing `springdoc:` block.)

- [ ] **Step 3: Write the failing test**

Create `zones/src/test/java/ec/edu/espe/zonas/audit/AuditPublisherTest.java`:

```java
package ec.edu.espe.zonas.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

@ExtendWith(MockitoExtension.class)
class AuditPublisherTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    @Test
    void publishesTheEventToTheConfiguredExchangeAndRoutingKey() {
        AuditPublisher publisher = new AuditPublisher(rabbitTemplate, "audit_exchange", "audit_event");
        AuditEvent event = new AuditEvent(
                "ms-zonas", "CREATE", "ZONA", "zone-1",
                Map.of("name", "Zona Norte"), "jdoe", "admin");

        publisher.publish(event);

        ArgumentCaptor<String> exchangeCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> routingKeyCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<AuditEvent> eventCaptor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(rabbitTemplate).convertAndSend(exchangeCaptor.capture(), routingKeyCaptor.capture(), eventCaptor.capture());

        assertThat(exchangeCaptor.getValue()).isEqualTo("audit_exchange");
        assertThat(routingKeyCaptor.getValue()).isEqualTo("audit_event");
        assertThat(eventCaptor.getValue()).isEqualTo(event);
    }

    @Test
    void doesNotThrowWhenRabbitMqIsUnreachable() {
        AuditPublisher publisher = new AuditPublisher(rabbitTemplate, "audit_exchange", "audit_event");
        doThrow(new RuntimeException("boom"))
                .when(rabbitTemplate).convertAndSend(anyString(), anyString(), any(AuditEvent.class));

        assertDoesNotThrow(() -> publisher.publish(
                new AuditEvent("ms-zonas", "CREATE", "ZONA", "zone-1", Map.of(), "jdoe", "admin")));
    }
}
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd zones && mvn -q test -Dtest=AuditPublisherTest`
Expected: FAIL — compile error, `AuditEvent`/`AuditPublisher` don't exist yet.

- [ ] **Step 5: Create `AuditEvent.java`**

```java
package ec.edu.espe.zonas.audit;

import java.util.Map;

public record AuditEvent(
        String servicio,
        String accion,
        String entidad,
        String entidadId,
        Map<String, Object> datos,
        String usuario,
        String rol) {
}
```

- [ ] **Step 6: Create `AuditPublisher.java`**

```java
package ec.edu.espe.zonas.audit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AuditPublisher {

    private static final Logger logger = LoggerFactory.getLogger(AuditPublisher.class);

    private final RabbitTemplate rabbitTemplate;
    private final String exchange;
    private final String routingKey;

    public AuditPublisher(
            RabbitTemplate rabbitTemplate,
            @Value("${audit.rabbitmq.exchange}") String exchange,
            @Value("${audit.rabbitmq.routing-key}") String routingKey) {
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
        this.routingKey = routingKey;
    }

    public void publish(AuditEvent event) {
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, event);
        } catch (Exception e) {
            logger.error("No se pudo publicar el evento de auditoría: {} {}", event.accion(), event.entidadId(), e);
        }
    }
}
```

- [ ] **Step 7: Create `RabbitConfig.java`**

```java
package ec.edu.espe.zonas.config;

import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    @Value("${audit.rabbitmq.exchange}")
    private String exchange;

    @Bean
    public TopicExchange auditExchange() {
        return new TopicExchange(exchange, true, false);
    }

    @Bean
    public Jackson2JsonMessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, Jackson2JsonMessageConverter converter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(converter);
        return template;
    }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd zones && mvn -q test -Dtest=AuditPublisherTest`
Expected: PASS (2/2)

- [ ] **Step 9: Commit**

```bash
git add zones/pom.xml zones/src/main/resources/application.yaml zones/src/main/java/ec/edu/espe/zonas/audit zones/src/main/java/ec/edu/espe/zonas/config/RabbitConfig.java zones/src/test/java/ec/edu/espe/zonas/audit
git commit -m "feat(zones): add Spring AMQP audit event publisher"
```

---

### Task 2: Fix `JwtFilter` to expose the authenticated username, not just user id and roles

**Files:**
- Create: `zones/src/main/java/ec/edu/espe/zonas/security/AuthenticatedUser.java`
- Create: `zones/src/main/java/ec/edu/espe/zonas/security/CurrentUser.java`
- Modify: `zones/src/main/java/ec/edu/espe/zonas/security/JwtFilter.java`
- Test: `zones/src/test/java/ec/edu/espe/zonas/security/JwtFilterTest.java`

**Interfaces:**
- Produces: `AuthenticatedUser` record (`userId, username, roles: List<String>`), and `CurrentUser.get(): AuthenticatedUser` (static helper reading `SecurityContextHolder`) — Tasks 3-4 call `CurrentUser.get()` inside the service layer to build audit events.

`JwtFilter` today builds its `Authentication` with `claims.getSubject()` (the user id) as the principal and never reads the JWT's `username` claim at all — so nothing in `zones` can currently know the acting user's username, only their id and roles. This is the same class of gap Plan 1 found and fixed in `vehicles` (its `AuditEvent` interface was missing `rol`) — here it's the JWT filter itself that's incomplete.

- [ ] **Step 1: Write the failing test**

Create `zones/src/test/java/ec/edu/espe/zonas/security/JwtFilterTest.java`. This tests the filter directly, without booting Spring, using a real JWT signed with a known test secret (mirroring how `JwtFilter.initKey()` derives its key from `jwt.secret`):

```java
package ec.edu.espe.zonas.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

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

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

class JwtFilterTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-32bytes";

    private JwtFilter jwtFilter;

    @BeforeEach
    void setUp() {
        jwtFilter = new JwtFilter();
        ReflectionTestUtils.setField(jwtFilter, "jwtSecret", SECRET);
        ReflectionTestUtils.invokeMethod(jwtFilter, "initKey");
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void putsUsernameUserIdAndRolesIntoTheAuthenticatedPrincipal() throws Exception {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
                .subject("user-123")
                .claim("username", "jdoe")
                .claim("roles", List.of("admin"))
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd zones && mvn -q test -Dtest=JwtFilterTest`
Expected: FAIL — `AuthenticatedUser` doesn't exist yet, and even once it's created as a bare record, the test fails because `JwtFilter` still sets the plain user-id `String` as principal, not an `AuthenticatedUser`.

- [ ] **Step 3: Create `AuthenticatedUser.java`**

```java
package ec.edu.espe.zonas.security;

import java.util.List;

public record AuthenticatedUser(String userId, String username, List<String> roles) {
}
```

- [ ] **Step 4: Create `CurrentUser.java`**

```java
package ec.edu.espe.zonas.security;

import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {

    private CurrentUser() {
    }

    public static AuthenticatedUser get() {
        return (AuthenticatedUser) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
```

- [ ] **Step 5: Update `JwtFilter.java`**

```java
package ec.edu.espe.zonas.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

import jakarta.annotation.PostConstruct;
import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
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

    @Value("${jwt.secret}")
    private String jwtSecret;

    private SecretKey secretKey;

    @PostConstruct
    void initKey() {
        secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
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

                List<?> rawRoles = claims.get("roles", List.class);
                List<String> roleNames = rawRoles != null
                        ? rawRoles.stream().map(Object::toString).collect(Collectors.toList())
                        : Collections.emptyList();
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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd zones && mvn -q test -Dtest=JwtFilterTest`
Expected: PASS

- [ ] **Step 7: Run the full test suite**

Run: `cd zones && mvn -q test -Dtest='AuditPublisherTest,JwtFilterTest'`
Expected: PASS (`ZonasApplicationTests#contextLoads` is excluded here and in every later task's suite run — it requires a live Postgres connection this environment doesn't have, and fails for that pre-existing reason independent of this plan).

- [ ] **Step 8: Commit**

```bash
git add zones/src/main/java/ec/edu/espe/zonas/security zones/src/test/java/ec/edu/espe/zonas/security
git commit -m "fix(zones): expose username in the JWT-authenticated principal"
```

---

### Task 3: Emit audit events on zone CRUD

**Files:**
- Modify: `zones/src/main/java/ec/edu/espe/zonas/service/impl/ZoneServiceImpl.java`
- Test: `zones/src/test/java/ec/edu/espe/zonas/service/impl/ZoneServiceImplAuditTest.java`

**Interfaces:**
- Consumes: `AuditEvent`, `AuditPublisher` (Task 1); `AuthenticatedUser`, `CurrentUser` (Task 2).

- [ ] **Step 1: Write the failing test**

Create `zones/src/test/java/ec/edu/espe/zonas/service/impl/ZoneServiceImplAuditTest.java`:

```java
package ec.edu.espe.zonas.service.impl;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import ec.edu.espe.zonas.audit.AuditEvent;
import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dtos.ZoneRequestDto;
import ec.edu.espe.zonas.entidades.Zone;
import ec.edu.espe.zonas.entidades.enums.TypeOfZone;
import ec.edu.espe.zonas.repositories.PlaceRepository;
import ec.edu.espe.zonas.repositories.ZoneRepository;
import ec.edu.espe.zonas.security.AuthenticatedUser;

@ExtendWith(MockitoExtension.class)
class ZoneServiceImplAuditTest {

    @Mock
    private ZoneRepository zoneRepository;
    @Mock
    private PlaceRepository placeRepository;
    @Mock
    private AuditPublisher auditPublisher;

    private ZoneServiceImpl zoneService;

    @BeforeEach
    void setUp() {
        zoneService = new ZoneServiceImpl();
        org.springframework.test.util.ReflectionTestUtils.setField(zoneService, "zoneRepository", zoneRepository);
        org.springframework.test.util.ReflectionTestUtils.setField(zoneService, "placeRepository", placeRepository);
        org.springframework.test.util.ReflectionTestUtils.setField(zoneService, "auditPublisher", auditPublisher);

        AuthenticatedUser actor = new AuthenticatedUser("user-1", "jdoe", List.of("admin"));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(actor, null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createZonePublishesACreateEvent() {
        ZoneRequestDto request = new ZoneRequestDto();
        request.setName("Zona Norte");
        request.setCapacity(10);
        request.setType(TypeOfZone.REGULAR);
        when(zoneRepository.existsByNameNormalized("Zona Norte")).thenReturn(false);
        when(zoneRepository.count()).thenReturn(0L);
        when(zoneRepository.save(any(Zone.class))).thenAnswer(inv -> inv.getArgument(0));

        zoneService.createZone(request);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        AuditEvent event = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(event.servicio()).isEqualTo("ms-zonas");
        org.assertj.core.api.Assertions.assertThat(event.accion()).isEqualTo("CREATE");
        org.assertj.core.api.Assertions.assertThat(event.entidad()).isEqualTo("ZONA");
        org.assertj.core.api.Assertions.assertThat(event.usuario()).isEqualTo("jdoe");
        org.assertj.core.api.Assertions.assertThat(event.rol()).isEqualTo("admin");
    }

    @Test
    void deleteZonePublishesADeleteEvent() {
        UUID id = UUID.randomUUID();
        Zone zone = Zone.builder().id(id).name("Zona Sur").code("ZON-REG-01")
                .capacity(5).type(TypeOfZone.REGULAR).status(1).build();
        when(zoneRepository.findById(id)).thenReturn(Optional.of(zone));
        when(placeRepository.existsByZoneAndStatus(any(), any())).thenReturn(false);

        zoneService.deleteZone(id);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        AuditEvent event = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(event.accion()).isEqualTo("DELETE");
        org.assertj.core.api.Assertions.assertThat(event.entidadId()).isEqualTo(id.toString());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd zones && mvn -q test -Dtest=ZoneServiceImplAuditTest`
Expected: FAIL — `ZoneServiceImpl` has no `auditPublisher` field yet, and `createZone`/`deleteZone` never call it.

- [ ] **Step 3: Update `ZoneServiceImpl.java`**

Add the `auditPublisher` field and a private `emitEvent` helper, and call it at the end of `createZone`, `updateZone`, `changeStatus`, and `deleteZone`:

```java
package ec.edu.espe.zonas.service.impl;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import ec.edu.espe.zonas.audit.AuditEvent;
import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dtos.ZoneRequestDto;
import ec.edu.espe.zonas.dtos.ZoneResponseDto;
import ec.edu.espe.zonas.entidades.Place;
import ec.edu.espe.zonas.entidades.Zone;
import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.repositories.PlaceRepository;
import ec.edu.espe.zonas.repositories.ZoneRepository;
import ec.edu.espe.zonas.security.AuthenticatedUser;
import ec.edu.espe.zonas.security.CurrentUser;
import ec.edu.espe.zonas.service.ZoneService;

@Service
public class ZoneServiceImpl implements ZoneService {

    @Autowired
    private ZoneRepository zoneRepository;

    @Autowired
    private PlaceRepository placeRepository;

    @Autowired
    private AuditPublisher auditPublisher;

    @Override
    @Transactional(readOnly = true)
    public List<ZoneResponseDto> getAllZones() {
        return zoneRepository.findAll()
            .stream()
            .map(this::toResponseDto)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ZoneResponseDto getZoneById(UUID idZone) {
        Zone zone = zoneRepository.findById(idZone)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));
        return toResponseDto(zone);
    }

    @Override
    public ZoneResponseDto createZone(ZoneRequestDto request) {
        if (zoneRepository.existsByNameNormalized(request.getName().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una zona con ese nombre");
        }

        Zone objZone = new Zone();
        objZone.setName(request.getName().trim());
        objZone.setCode(codeGenerator(request));
        objZone.setDescription(request.getDescription() != null ? request.getDescription().trim() : null);
        objZone.setCapacity(request.getCapacity());
        objZone.setType(request.getType());
        objZone.setStatus(1);
        objZone.setCreatedAt(LocalDateTime.now());
        objZone.setUpdatedAt(LocalDateTime.now());

        zoneRepository.save(objZone);
        emitEvent("CREATE", objZone, Map.of("name", objZone.getName(), "code", objZone.getCode()));
        return toResponseDto(objZone);
    }

    @Override
    @Transactional
    public ZoneResponseDto updateZone(UUID idZone, ZoneRequestDto request) {
        Zone zone = zoneRepository.findById(idZone)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));

        String trimmedName = request.getName().trim();
        String normalizedNew = trimmedName.replaceAll("\\s+", "").toLowerCase();
        String normalizedCurrent = zone.getName().replaceAll("\\s+", "").toLowerCase();
        if (!normalizedNew.equals(normalizedCurrent) && zoneRepository.existsByNameNormalized(trimmedName)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una zona con ese nombre");
        }

        long existingPlaces = placeRepository.countByZone(zone);
        if (request.getCapacity() < existingPlaces) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "No se puede reducir la capacidad por debajo del número de lugares existentes (" + existingPlaces + ")");
        }

        zone.setName(trimmedName);
        zone.setDescription(request.getDescription() != null ? request.getDescription().trim() : null);
        zone.setCapacity(request.getCapacity());
        zone.setType(request.getType());
        zone.setUpdatedAt(LocalDateTime.now());

        Zone saved = zoneRepository.save(zone);
        emitEvent("UPDATE", saved, Map.of("name", saved.getName(), "capacity", saved.getCapacity()));
        return toResponseDto(saved);
    }

    @Override
    @Transactional
    public void changeStatus(UUID idZone) {
        Zone zone = zoneRepository.findById(idZone)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));

        int newStatus = (zone.getStatus() == 1) ? 0 : 1;

        if (newStatus == 0) {
            boolean hasOccupiedPlaces = placeRepository.existsByZoneAndStatus(zone, StatusOfPlace.OCCUPIED);
            if (hasOccupiedPlaces) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No se puede desactivar la zona: existen lugares ocupados");
            }
            for (Place place : zone.getPlaces()) {
                place.setActive(false);
            }
            placeRepository.saveAll(zone.getPlaces());
        } else {
            for (Place place : zone.getPlaces()) {
                place.setActive(true);
            }
            placeRepository.saveAll(zone.getPlaces());
        }

        zone.setStatus(newStatus);
        zone.setUpdatedAt(LocalDateTime.now());
        zoneRepository.save(zone);
        emitEvent("UPDATE", zone, Map.of("status", newStatus));
    }

    @Override
    @Transactional
    public void deleteZone(UUID idZone) {
        Zone zone = zoneRepository.findById(idZone)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));
        boolean hasOccupiedPlaces = placeRepository.existsByZoneAndStatus(zone, StatusOfPlace.OCCUPIED);
        if (hasOccupiedPlaces) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "No se puede eliminar la zona: existen lugares ocupados");
        }

        zoneRepository.delete(zone);
        emitEvent("DELETE", zone, Map.of("name", zone.getName()));
    }

    private void emitEvent(String accion, Zone zone, Map<String, Object> datosExtra) {
        AuthenticatedUser actor = CurrentUser.get();
        AuditEvent event = new AuditEvent(
                "ms-zonas",
                accion,
                "ZONA",
                zone.getId().toString(),
                datosExtra,
                actor.username(),
                actor.roles().isEmpty() ? "" : actor.roles().get(0));
        auditPublisher.publish(event);
    }

    private ZoneResponseDto toResponseDto(Zone zone) {
        return ZoneResponseDto.builder()
                .id(zone.getId())
                .name(zone.getName())
                .code(zone.getCode())
                .description(zone.getDescription())
                .capacity(zone.getCapacity())
                .type(zone.getType())
                .places(zone.getPlaces())
                .status(zone.getStatus())
                .createdAt(zone.getCreatedAt())
                .updatedAt(zone.getUpdatedAt())
                .build();
    }

    private String codeGenerator(ZoneRequestDto request) {
        String typeAbbrev = request.getType().name()
            .substring(0, Math.min(3, request.getType().name().length()))
            .toUpperCase();
        long zoneCount = zoneRepository.count();
        String sequentialNumber = String.format("%02d", zoneCount + 1);
        return "ZON-" + typeAbbrev + "-" + sequentialNumber;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd zones && mvn -q test -Dtest=ZoneServiceImplAuditTest`
Expected: PASS (2/2)

- [ ] **Step 5: Run the full relevant test suite**

Run: `cd zones && mvn -q test -Dtest='AuditPublisherTest,JwtFilterTest,ZoneServiceImplAuditTest'`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add zones/src/main/java/ec/edu/espe/zonas/service/impl/ZoneServiceImpl.java zones/src/test/java/ec/edu/espe/zonas/service/impl/ZoneServiceImplAuditTest.java
git commit -m "feat(zones): publish CREATE/UPDATE/DELETE audit events on zone CRUD"
```

---

### Task 4: Emit audit events on place CRUD

**Files:**
- Modify: `zones/src/main/java/ec/edu/espe/zonas/service/impl/PlaceServiceImpl.java`
- Test: `zones/src/test/java/ec/edu/espe/zonas/service/impl/PlaceServiceImplAuditTest.java`

**Interfaces:**
- Consumes: `AuditEvent`, `AuditPublisher` (Task 1); `AuthenticatedUser`, `CurrentUser` (Task 2).

- [ ] **Step 1: Write the failing test**

Create `zones/src/test/java/ec/edu/espe/zonas/service/impl/PlaceServiceImplAuditTest.java`:

```java
package ec.edu.espe.zonas.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import ec.edu.espe.zonas.audit.AuditEvent;
import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dtos.PlaceRequestDto;
import ec.edu.espe.zonas.entidades.Place;
import ec.edu.espe.zonas.entidades.Zone;
import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfZone;
import ec.edu.espe.zonas.repositories.PlaceRepository;
import ec.edu.espe.zonas.repositories.ZoneRepository;
import ec.edu.espe.zonas.security.AuthenticatedUser;
import ec.edu.espe.zonas.utils.UtilsMappers;

@ExtendWith(MockitoExtension.class)
class PlaceServiceImplAuditTest {

    @Mock
    private PlaceRepository placeRepository;
    @Mock
    private ZoneRepository zoneRepository;
    @Mock
    private UtilsMappers mappers;
    @Mock
    private AuditPublisher auditPublisher;

    private PlaceServiceImpl placeService;

    @BeforeEach
    void setUp() {
        placeService = new PlaceServiceImpl(placeRepository, zoneRepository, mappers, auditPublisher);

        AuthenticatedUser actor = new AuthenticatedUser("user-1", "jdoe", List.of("admin"));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(actor, null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createPlacePublishesACreateEvent() {
        UUID zoneId = UUID.randomUUID();
        Zone zone = Zone.builder().id(zoneId).name("Zona Norte").code("ZON-REG-01")
                .capacity(10).type(TypeOfZone.REGULAR).status(1).build();
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(placeRepository.countByZone(zone)).thenReturn(0L);
        when(placeRepository.existsByCode(org.mockito.ArgumentMatchers.anyString())).thenReturn(false);

        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(zoneId);
        request.setType(TypeOfPlace.CAR);

        Place mappedPlace = new Place();
        when(mappers.toEntityPlace(request)).thenReturn(mappedPlace);
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(null);

        placeService.createPlace(request);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        AuditEvent event = captor.getValue();
        assertThat(event.servicio()).isEqualTo("ms-zonas");
        assertThat(event.accion()).isEqualTo("CREATE");
        assertThat(event.entidad()).isEqualTo("PLACE");
        assertThat(event.usuario()).isEqualTo("jdoe");
        assertThat(event.rol()).isEqualTo("admin");
    }

    @Test
    void deletePlaceByIdPublishesADeleteEvent() {
        UUID id = UUID.randomUUID();
        Place place = new Place();
        place.setId(id);
        place.setStatus(StatusOfPlace.AVAILABLE);
        when(placeRepository.findById(id)).thenReturn(Optional.of(place));

        placeService.deletePlaceById(id);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        assertThat(captor.getValue().accion()).isEqualTo("DELETE");
        assertThat(captor.getValue().entidadId()).isEqualTo(id.toString());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd zones && mvn -q test -Dtest=PlaceServiceImplAuditTest`
Expected: FAIL — `PlaceServiceImpl`'s constructor doesn't accept an `AuditPublisher` yet, and no method calls it.

- [ ] **Step 3: Update `PlaceServiceImpl.java`**

```java
package ec.edu.espe.zonas.service.impl;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import ec.edu.espe.zonas.audit.AuditEvent;
import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dtos.PlaceRequestDto;
import ec.edu.espe.zonas.dtos.PlaceResponseDto;
import ec.edu.espe.zonas.entidades.Place;
import ec.edu.espe.zonas.entidades.Zone;
import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.repositories.PlaceRepository;
import ec.edu.espe.zonas.repositories.ZoneRepository;
import ec.edu.espe.zonas.security.AuthenticatedUser;
import ec.edu.espe.zonas.security.CurrentUser;
import ec.edu.espe.zonas.service.PlaceService;
import ec.edu.espe.zonas.utils.UtilsMappers;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PlaceServiceImpl implements PlaceService {
    private final PlaceRepository placeRepository;
    private final ZoneRepository zoneRepository;
    private final UtilsMappers mappers;
    private final AuditPublisher auditPublisher;

    @Override
    @Transactional(readOnly = true)
    public List<PlaceResponseDto> getAllPlaces() {
        return placeRepository.findAll()
            .stream()
            .map(mappers::toPlaceResponseDto)
            .toList();
    }

    @Override
    @Transactional
    public PlaceResponseDto createPlace(PlaceRequestDto request) {
        Zone objZona = zoneRepository.findById(request.getIdZone())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));

        if (objZona.getStatus() == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "No se puede crear un lugar en una zona inactiva");
        }

        long currentPlaces = placeRepository.countByZone(objZona);
        if (currentPlaces >= objZona.getCapacity()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "La zona ha alcanzado su capacidad máxima (" + objZona.getCapacity() + ")");
        }

        long seq = currentPlaces + 1;
        String generatedCode = generatePlaceCode(objZona, seq);
        while (placeRepository.existsByCode(generatedCode)) {
            seq++;
            generatedCode = generatePlaceCode(objZona, seq);
        }

        Place newPlace = mappers.toEntityPlace(request);
        newPlace.setCode(generatedCode);
        newPlace.setZone(objZona);
        newPlace.setStatus(StatusOfPlace.AVAILABLE);
        newPlace.setActive(true);
        newPlace.setCreatedAt(LocalDateTime.now());
        newPlace.setUpdatedAt(LocalDateTime.now());

        Place savedPlace = placeRepository.save(newPlace);
        emitEvent("CREATE", savedPlace, Map.of("code", savedPlace.getCode()));
        return mappers.toPlaceResponseDto(savedPlace);
    }

    @Override
    @Transactional
    public PlaceResponseDto updatePlace(PlaceRequestDto request, UUID id) {
        Place existing = placeRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lugar no encontrado"));

        if (request.getDescription() != null) {
            existing.setDescription(request.getDescription().trim().isEmpty() ? null : request.getDescription().trim());
        }

        if (request.getType() != null) {
            existing.setType(request.getType());
        }

        if (request.getStatus() != null) {
            existing.setStatus(request.getStatus());
        }

        if (request.getIdZone() != null && !request.getIdZone().equals(existing.getZone().getId())) {
            Zone newZone = zoneRepository.findById(request.getIdZone())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));
            if (newZone.getStatus() == 0) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No se puede mover un lugar a una zona inactiva");
            }
            long currentPlaces = placeRepository.countByZone(newZone);
            if (currentPlaces >= newZone.getCapacity()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La zona destino ha alcanzado su capacidad máxima (" + newZone.getCapacity() + ")");
            }
            existing.setZone(newZone);
        }

        existing.setUpdatedAt(LocalDateTime.now());
        Place saved = placeRepository.save(existing);
        emitEvent("UPDATE", saved, Map.of("code", saved.getCode()));
        return mappers.toPlaceResponseDto(saved);
    }

    @Override
    @Transactional
    public void deletePlaceById(UUID id) {
        Place place = placeRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lugar no encontrado"));
        if (place.getStatus() == StatusOfPlace.OCCUPIED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "No se puede eliminar un lugar que está ocupado");
        }

        placeRepository.delete(place);
        emitEvent("DELETE", place, Map.of("code", place.getCode()));
    }

    @Override
    @Transactional
    public PlaceResponseDto changeStatus(StatusOfPlace status, UUID id) {
        Place place = placeRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lugar no encontrado"));
        place.setStatus(status);
        place.setUpdatedAt(LocalDateTime.now());
        Place saved = placeRepository.save(place);
        emitEvent("UPDATE", saved, Map.of("status", status.name()));
        return mappers.toPlaceResponseDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PlaceResponseDto> getPlacesByStatus(StatusOfPlace status) {
        return placeRepository.findByStatus(status)
            .stream()
            .map(mappers::toPlaceResponseDto)
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PlaceResponseDto> getPlacesByZoneAndStatus(UUID idZone, StatusOfPlace status) {
        Zone zone = zoneRepository.findById(idZone)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));
        return placeRepository.findByZoneAndStatus(zone, status)
            .stream()
            .map(mappers::toPlaceResponseDto)
            .toList();
    }

    private void emitEvent(String accion, Place place, Map<String, Object> datosExtra) {
        AuthenticatedUser actor = CurrentUser.get();
        AuditEvent event = new AuditEvent(
                "ms-zonas",
                accion,
                "PLACE",
                place.getId().toString(),
                datosExtra,
                actor.username(),
                actor.roles().isEmpty() ? "" : actor.roles().get(0));
        auditPublisher.publish(event);
    }

    private String generatePlaceCode(Zone zone, long seq) {
        String typePrefix = zone.getType().name()
            .substring(0, Math.min(2, zone.getType().name().length()))
            .toUpperCase();
        String zoneSeq = zone.getCode().substring(zone.getCode().length() - 2);
        return typePrefix + zoneSeq + "-" + String.format("%02d", seq);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd zones && mvn -q test -Dtest=PlaceServiceImplAuditTest`
Expected: PASS (2/2)

- [ ] **Step 5: Run the full relevant test suite**

Run: `cd zones && mvn -q test -Dtest='AuditPublisherTest,JwtFilterTest,ZoneServiceImplAuditTest,PlaceServiceImplAuditTest'`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add zones/src/main/java/ec/edu/espe/zonas/service/impl/PlaceServiceImpl.java zones/src/test/java/ec/edu/espe/zonas/service/impl/PlaceServiceImplAuditTest.java
git commit -m "feat(zones): publish CREATE/UPDATE/DELETE audit events on place CRUD"
```

---

### Task 5: Wire `zones` to `rabbitmq` in the root `docker-compose.yml` and verify end-to-end

**Files:**
- Modify: `docker-compose.yml` (repo root)

**Interfaces:**
- Produces: `zones` reachable and able to publish to `rabbitmq:5672` in the compose network.

- [ ] **Step 1: Add RabbitMQ envs and the `rabbitmq` dependency to the `zones` service block**

In `docker-compose.yml`'s `zones` service, change:

```yaml
    environment:
      DB_HOST: zones-db
      DB_PORT: 5432
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME_ZONES}
      SERVER_PORT: 8080
      JWT_SECRET: ${JWT_SECRET}
```

to:

```yaml
    environment:
      DB_HOST: zones-db
      DB_PORT: 5432
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME_ZONES}
      SERVER_PORT: 8080
      JWT_SECRET: ${JWT_SECRET}
      RABBITMQ_HOST: ${RABBITMQ_HOST}
      RABBITMQ_PORT: ${RABBITMQ_PORT}
      RABBITMQ_USER: ${RABBITMQ_USER}
      RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
      RABBITMQ_EXCHANGE: ${RABBITMQ_EXCHANGE}
      RABBITMQ_ROUTING_KEY: ${RABBITMQ_ROUTING_KEY}
```

And change `zones`'s `depends_on` from:

```yaml
    depends_on:
      zones-db:
        condition: service_healthy
```

to:

```yaml
    depends_on:
      zones-db:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
```

- [ ] **Step 2: Bring up the stack and verify the publisher connects**

Run: `docker compose up -d --build rabbitmq zones-db zones`
Expected: all three containers report `Up`/`Up (healthy)` via `docker compose ps`.

- [ ] **Step 3: Verify Spring AMQP connected without errors**

Run: `docker compose logs zones --tail 80`
Expected: no `AmqpConnectException`/`ConnectException` lines; Spring Boot's startup log reaches `Started ZonasApplication`. (Spring AMQP connects lazily on first publish by default, so the absence of connection errors at boot — rather than an explicit "connected" log line like the Node/Python services print — is the correct signal here.)

- [ ] **Step 4: Tear down**

Run: `docker compose down`

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(zones): wire RabbitMQ audit publisher into the compose stack"
```

---

## Self-Review Notes

- **Spec coverage:** the design spec's "zones (Spring Boot): agregar spring-boot-starter-amqp... publicando en los métodos de ZoneServiceImpl/PlaceServiceImpl" is covered by Tasks 1, 3, 4; "agregar envs RABBITMQ_* al bloque de zones" is covered by Task 5.
- **Deviation worth flagging:** the design spec assumed `zones` just needed the AMQP starter wired in; investigating the actual code found `JwtFilter` never captured the JWT's `username` claim at all (only user id and roles) — the same class of gap Plan 1 found in `vehicles`. Task 2 fixes this first, since Tasks 3-4 depend on `CurrentUser.get().username()` actually being populated.
- **No controller changes needed:** unlike the NestJS/FastAPI plans, Spring's `SecurityContextHolder` is already populated per-request by `JwtFilter` before any controller method runs, so the service layer reads the acting user directly via `CurrentUser.get()` — no `ZoneController`/`PlaceController` changes were needed to thread an actor through.
- **`ZonasApplicationTests#contextLoads` stays broken, unrelated to this plan:** it requires a live Postgres connection this environment doesn't have (confirmed by running `mvn test` before starting this plan — the *only* pre-existing failure). All new tests in this plan use Mockito and never boot a Spring context, so they don't depend on a database and aren't affected by this pre-existing gap.
- **Type consistency:** `AuditEvent` (Task 1) fields match what `ZoneServiceImpl`/`PlaceServiceImpl` (Tasks 3-4) construct; `AuthenticatedUser` (Task 2) fields (`userId, username, roles`) match what `CurrentUser.get()` returns and what the two service tasks read (`.username()`, `.roles()`).
