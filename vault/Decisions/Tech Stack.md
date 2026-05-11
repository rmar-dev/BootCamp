# Tech Stack

## Languages & Frameworks
- **TypeScript** — both `platform/` (NestJS) and `curriculum/` (standalone)
- **NestJS 10** — platform backend framework (controllers, modules, DI, guards)
- **Prisma 5** — ORM; schema at `platform/prisma/schema.prisma`
- **Swift + Kotlin** — target languages students are learning; executed in sidecar containers

## Database
- **PostgreSQL** — single DB shared by `platform/` and `curriculum/` publisher
- Versioned content pattern: `(id, version)` composite PKs on Track / Lesson / Exercise

## Auth
- Passport with three strategies: `google-oauth20`, `jwt`, `local`
- bcryptjs for password hashing, jsonwebtoken for JWT signing
- Roles: `student`, `instructor`, `admin` (enum in Prisma)

## Sandbox Execution
- **dockerode** for Docker control from Node
- Two always-on sidecars: `bootcamp-swift-runner`, `bootcamp-kotlin-runner`
- Source code passed via `SRC` env var (not stdin — avoids dockerode half-close bug)
- 8KB output truncation, 5s/10s runtime timeouts

## Infrastructure
- **Docker Compose** — orchestrates Postgres, platform, runner sidecars
- **PowerShell** `dev.ps1` — local dev entry point (Windows-first dev environment)
- No CI/CD configured yet

## Testing
- Jest + supertest for platform
- `DockerLike` interface in execution makes docker-runner unit-testable without real Docker

## Planned
- **Gemma 4** LLM integration — will plug into `platform/src/review/review-provider.interface.ts` as a new provider alongside the existing `mock` and `openai-compat` providers. Goal: smarter, locally-hostable AI code review for student submissions.

## Rationale
_To be filled in as key decisions arise._ Candidates to document: why NestJS over Express/Fastify, why Prisma over TypeORM, why sidecar-per-language over per-request containers, why versioned content rows over immutable event log.
