# Project Overview

## What This Project Does
BootCamp is a hybrid learning platform and Obsidian knowledge vault in one repository. The `platform/` NestJS application delivers a Swift and Kotlin curriculum that ends in a "Mini Peacock" capstone — students submit code, it runs in Docker sandboxes, the platform scores it and generates AI code review, and instructors review the capstone submissions. The vault side (`daily/`, `zettel/`, `maps/`, `projects/`) is a parallel second-brain for authoring and design work.

## Tech Stack
**Platform backend** (`platform/`):
- NestJS 10 (TypeScript)
- Prisma 5 + PostgreSQL
- Auth: Passport — Google OAuth 2.0, JWT, local (email/password); bcryptjs, jsonwebtoken, cookie-parser
- Sandbox execution: dockerode → Swift + Kotlin runner sidecars (`bootcamp-swift-runner`, `bootcamp-kotlin-runner`)
- Validation: class-validator, class-transformer, zod
- Testing: Jest + supertest

**Curriculum tooling** (`curriculum/`):
- Separate TypeScript package with its own Prisma
- Compiles authored markdown + payload JSON into versioned content rows

**Infrastructure:**
- Docker Compose (Postgres + platform + runner sidecars)
- PowerShell dev script (`dev.ps1`)

**Planned:**
- Gemma 4 LLM integration for smarter AI code review (will plug into the existing `review-provider.interface.ts`)

## Module Map
- **auth** — Google OAuth / JWT / local login, roles (student / instructor / admin)
- **content** — Versioned curriculum (Track, Lesson, Block, Exercise) + lesson assembly + per-student exercise selection
- **execution** — Sandboxed Swift / Kotlin execution via Docker sidecars
- **grading** — Submission flow, scoring, AI code review, instructor review + message threads
- **gamification** — Badges, streaks, points rollup, leaderboards, student dashboard
- **curriculum-tooling** — Offline compiler that turns authored markdown into published content rows

## Architecture Diagram
_To be filled in._ Rough shape: Nest controllers → services → repositories → Prisma → Postgres. Execution sidecars sit alongside the platform container. Curriculum-tooling runs offline and writes directly to the same DB.
