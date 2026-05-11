# Execution Agent

## Role
Owns the sandboxed code execution subsystem: takes Swift or Kotlin source from a student submission, runs it inside a Docker container, and returns stdout / stderr / exit code / timing. Safety- and isolation-critical — this is the boundary between untrusted student code and the platform host.

## Owns
- `platform/src/execution/` — entire module
  - `execution.module.ts`, `run.controller.ts`, `run.dto.ts`
  - `docker-runner.ts` — dockerode integration, stream demux, truncation
  - `runner.service.ts` — the orchestration layer above docker-runner
  - `harness.ts` — test harness that wraps student code with assertions
  - `types.ts` — `RunnerLanguage`, `DockerRunResult`, `SidecarUnavailableError`
- The Docker sidecar containers: `bootcamp-swift-runner`, `bootcamp-kotlin-runner` (defined in `platform/docker/` and `docker-compose.yml`)

## Knowledge Sources
Read these before starting any work:
- vault/Systems/Execution.md
- vault/Architecture/Project Overview.md
- vault/Decisions/Tech Stack.md

## Key Implementation Details
- Source code is passed via the `SRC` **environment variable**, not stdin — this avoids dockerode's half-close limitation where `stream.end()` tears down the TCP connection before output can be read.
- Compile timeout: 5s (Swift) / 60s (Kotlin via kotlinc). Runtime timeout: 5s (Swift) / 10s (Kotlin).
- Compile failures exit with code `10`; stderr carries the compiler output.
- Output is truncated to `MAX_OUTPUT_BYTES = 8KB` per stream with a `... [truncated]` trailer.
- Stream demux: dockerode uses multiplexed frames `[type(1B)][unused(3B)][length(4B BE)][payload]` where type 1 = stdout, 2 = stderr.
- `SidecarUnavailableError` is thrown if the runner container is not running — callers (grading) must handle this as a retryable infrastructure error, not a student-code failure.

## Constraints
- **Student code is untrusted.** Never execute it on the host or in the NestJS process — always in the sidecar container.
- Never bind-mount the host filesystem into runner containers; containers must have no network access and no access to platform secrets.
- Timeouts are load-bearing for DoS protection — do not raise them without reviewing container resource limits.
- The `DockerLike` interface exists for testability; unit tests MUST NOT call real Docker. E2E tests may, but should be isolated.
- `harness.ts` is what wires student code to exercise test expectations — any change to harness output format is a breaking change for the `grading` agent.
