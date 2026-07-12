# Audit event IP capture — design

## Context

The centralized audit rollout (5 plans, already implemented and reviewed on
`feature/audit-rollout`) publishes `AuditEvent`s from `vehicles`, `tickets`,
`users`, `zones`, and `assignments` to `ms-audit`. `ms-audit`'s
`CreateAuditEventDto` already has an optional `ip` field
(`@IsIP('4')`), but no producer populates it — every event's `ip` is
`undefined`/`null` today. This was flagged in conversation as a real,
addressable gap (unlike `mac`, which is not practically obtainable in a
client-server HTTP architecture and stays out of scope).

## Goal

Every audit event published by the five producer services carries the
originating client's IP address.

## Requirement: respect `X-Forwarded-For`

Since services are tested by calling each microservice's port directly
(bypassing the `kong` gateway, per every E2E verification done in the
rollout so far), the raw socket address seen by each service is normally
already the real caller's IP. But if this system is ever run behind `kong`
(or any reverse proxy) in earnest, the socket address would be the proxy's
container IP, not the real client — so IP capture must prefer
`X-Forwarded-For` when present, and only fall back to the raw connection
address when it's absent. `kong` forwards `X-Forwarded-For` by default; no
`kong.yml` changes are needed for this.

## IP extraction rule (identical across all 5 services)

1. If the `X-Forwarded-For` header is present, take its first
   comma-separated value (the original client, per HTTP convention) and
   trim whitespace.
2. Otherwise, use the raw connection/socket remote address.
3. If the resulting value is in IPv4-mapped-IPv6 notation
   (`::ffff:x.x.x.x`, which Node/Express commonly produces for IPv4
   loopback/LAN callers), strip the `::ffff:` prefix so the plain IPv4
   address remains.
4. Do not attempt to validate or reformat beyond step 3. A genuine IPv6
   address will fail `ms-audit`'s existing `@IsIP('4')` validation and the
   event will be dead-lettered — this is `ms-audit`'s existing Plan 1
   validation behavior and is explicitly out of scope to change here; it's
   an edge case that won't occur for direct IPv4 callers (Postman, curl,
   browsers on this network) which is how this system is actually used.

## Per-service integration points

### `vehicles` / `tickets` (NestJS)

Both already extract `@Req()` in every mutating controller method (from the
earlier rollout plans, to build `actingUser`). Add IP extraction there
(a small shared function, one copy per service — consistent with how
`event-published.service.ts` is already duplicated per service rather than
shared as a package) and pass it to the service alongside the acting user.
The `AuditEvent` interface in both services' `event-published.service.ts`
already declares `ip?: string` — no interface change needed, just start
populating it.

### `users` / `assignments` (FastAPI)

Neither currently injects FastAPI's `Request` object into the mutating
routes (`auth.py`'s login/logout, `persons.py`/`users.py`'s CRUD routes,
`assignments.py`'s create/delete/transfer) — only `current_user`/`token`
dependencies exist today. Add `request: Request` as a route dependency
where audit events are emitted, extract the IP, and thread it into the
service call alongside `current_user`. `publish_audit_event()` in both
services' `audit_publisher.py` gains a new `ip: str | None = None`
parameter, included in the published JSON body as `"ip"`.

### `zones` (Spring Boot)

Mirrors the existing `CurrentUser.get()` pattern (reads the current
request's authenticated principal from `SecurityContextHolder` without any
controller changes) with a new `ClientIp.get()`: reads the current
`HttpServletRequest` via Spring's `RequestContextHolder`
(`ServletRequestAttributes`), applies the same `X-Forwarded-For` /
`getRemoteAddr()` extraction rule. No controller changes needed — `zones`
is the only service in this rollout where audit emission already happens
entirely inside the service layer. The `AuditEvent` record in
`ec.edu.espe.zonas.audit` gains a new `ip` field.

## Testing approach

Same TDD pattern already used throughout the rollout: mock/build a fake
request object (or a real signed request where the framework makes that
easiest, as `JwtFilterTest` already does for `zones`) with an
`X-Forwarded-For` header, and one without it (falling back to a bare
remote address), assert the extracted/published `ip` matches expectations
in both cases. Each service's task also does one live verification: bring
the service up via `docker compose`, `curl` it with an explicit
`X-Forwarded-For: 203.0.113.5` header, and confirm that IP shows up on the
persisted event (`GET /api/v1/audit` on `ms-audit`, or its logs).

## Out of scope

- `mac` capture (not practically obtainable — MAC addresses don't survive a
  router hop; already discussed and rejected in conversation).
- Loosening `ms-audit`'s `@IsIP('4')` validation to also accept IPv6 — a
  cross-plan change to `ms-audit` itself, not warranted by this feature's
  actual usage pattern (IPv4 callers).
- `kong.yml` changes — `kong` already forwards `X-Forwarded-For` by
  default.
- `assignments`' local business-audit trail (`app/db/listeners.py`,
  `assignment_audit.py`, `audit_service.py`) — untouched, same constraint
  as Plan 5.

## Plan

One implementation plan, 5 tasks (one per producer service), each
self-contained: code + unit tests + a live `docker compose` verification
with an explicit `X-Forwarded-For` header. No `docker-compose.yml` changes
needed (no new env vars).
