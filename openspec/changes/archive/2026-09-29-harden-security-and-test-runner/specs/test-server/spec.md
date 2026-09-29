# Spec Delta: test-server

## MODIFIED Requirements

### Requirement: HTTP like example-server
`main.ts` SHALL mirror the example-server layout (express, CORS, `/health`, stateless `POST /mcp`, `HOST` default `127.0.0.1`) on port 3200. This is a deliberate copy: both packages stay free of shared dependencies.

#### Scenario: Health
- **WHEN** `GET /health` is requested
- **THEN** the answer is `{ ok: true }`

#### Scenario: Loopback by default
- **WHEN** `main.ts` starts without `HOST`
- **THEN** it listens on `127.0.0.1`
