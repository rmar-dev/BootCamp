# Project Pipeline

## Agent System
This project uses a standardized agent pipeline for development.

- **Orchestrator:** `agents/orchestrator.md` — read this first to understand the dispatch system
- **Shared agents:** `agents/shared/` — cross-cutting agents (code-quality, database, frontend, infra, observability, stress-test)
- **Security agents:** `agents/security/` — mandatory security gateway on every commit
- **Domain agents:** `agents/layer/` — project-specific agents (if any)

### Pipeline
Every change follows: **You -> Orchestrator -> Agent(s) -> Your Approval -> Security Gateway -> Commit**

### Security Gate
All code must pass through the Security Gateway before commit:
1. Code Scanner (OWASP, secrets, deps) — can BLOCK
2. Architecture Reviewer (patterns, boundaries) — can BLOCK
3. Audit Logger (writes to vault/Audit/) — always runs

## Knowledge Base
Obsidian vault at `vault/` — structured project knowledge:
- `Architecture/` — project/platform overview
- `Systems/` — one note per major system or module
- `Components/` — deep dives on specific components
- `Decisions/` — tech stack, ADRs, roadmap decisions
- `Research/` — domain research and references
- `Audit/` — security gate audit trail (auto-generated)

## Starting a New Session
1. Read `agents/orchestrator.md` to understand the dispatch system
2. Read the relevant agent definition(s) for the work you're doing
3. Read the corresponding vault notes for domain knowledge
4. Follow the pipeline: build -> approve -> security gate -> commit

## Pipeline Template
This project uses the shared pipeline template from `claude-pipeline-template/`.
- Template version: see `.claude-pipeline-version`
- Last sync: see `.claude-pipeline-lock`
- Shared files (agents/shared/, agents/security/, agents/orchestrator.md, hooks/) are managed by the template
- Project-specific files (agents/layer/, vault content, CLAUDE.project.md) are owned by this project
- Never edit CLAUDE.md directly — edit CLAUDE.project.md instead. CLAUDE.md is regenerated on sync.

---

# BootCamp — Project Overrides

## Context
BootCamp is a hybrid learning platform and Obsidian knowledge vault in one repo. The `platform/` NestJS app delivers a Swift + Kotlin curriculum ending in a "Mini Peacock" capstone: students submit code, it runs in Docker sandboxes, the system scores and AI-reviews it, and instructors review capstone work. The vault side (`daily/`, `zettel/`, `maps/`, `projects/`) is a parallel second-brain for authoring and design.

## Tech Stack
- **Platform backend:** NestJS 10, TypeScript, Prisma 5, PostgreSQL
- **Auth:** Passport (Google OAuth 20, JWT, local), bcryptjs, jsonwebtoken, cookie-parser
- **Sandbox execution:** dockerode driving Swift + Kotlin runner sidecars
- **Validation:** class-validator, class-transformer, zod
- **Testing:** Jest + supertest
- **Curriculum tooling:** separate TS package (`curriculum/`) with its own Prisma, compiles authored markdown → versioned DB rows
- **Infra:** Docker Compose (Postgres + platform + runners); Windows-first dev via `dev.ps1`
- **Planned:** Gemma 4 LLM, integrated as a new provider behind `platform/src/review/review-provider.interface.ts`

## Domain Agents
- `agents/layer/auth.md` — Google OAuth / JWT / local login, role guards, `User` model
- `agents/layer/content.md` — versioned Track/Lesson/Block/Exercise, lesson assembly, `LessonAssignment`, cohorts, enrollment
- `agents/layer/execution.md` — Docker sandbox runners for Swift and Kotlin
- `agents/layer/grading.md` — submission → execution → scoring → AI review → instructor review pipeline
- `agents/layer/gamification.md` — badges, streaks, leaderboards, dashboard (side-effect layer)
- `agents/layer/curriculum-tooling.md` — offline compiler/publisher in `curriculum/`

## Key Constraints
- **Student code is untrusted** — it must only execute inside the Execution agent's Docker sidecars. No host execution, no network access in sandboxes, no bind mounts.
- **Versioned content is immutable** — never mutate a published `Track` / `Lesson` / `Exercise` row. Publish a new `(id, version+1)` instead. `publishedAt IS NULL` = draft = excluded from student-facing queries.
- **Payload validators must stay symmetric** between `curriculum/src/validator.ts` (compile-time) and `platform/src/content/validators/exercise-payload.validator.ts` (runtime).
- **Gamification cannot fail submission** — badge/streak errors must be logged and swallowed, never surfaced as a submission failure.
- **Review provider interface is stable surface** — the upcoming Gemma 4 provider must conform to `review-provider.interface.ts` without breaking `mock.provider.ts` or `openai-compat.provider.ts`.
- **Learners are experienced programmers new to Swift/Kotlin** — skip "what is a variable" framing in any student-facing content or error messages.
- **Windows-first dev environment** — `dev.ps1` is the primary entry point; bash scripts should work via Git Bash but PowerShell is the source of truth.

## Design Specs & Plans
- `docs/superpowers/specs/` — design documents (specs #1 and #2 complete as of 2026-04-23)
- `docs/superpowers/plans/` — implementation plans
- `docs/superpowers/HANDOVER.md` — session handover notes
- Active platform branch: `feat/lesson-runtime` (ready to merge per memory)
