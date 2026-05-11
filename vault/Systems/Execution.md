# Execution

## Purpose
Run untrusted Swift or Kotlin source code in a sandboxed Docker container and return stdout / stderr / exit code. The host-to-untrusted-code boundary.

## Owns
- `platform/src/execution/` (docker-runner, runner.service, harness, run.controller)
- The `bootcamp-swift-runner` and `bootcamp-kotlin-runner` sidecar containers

## Key Interfaces
- `POST /run` — direct run endpoint (likely instructor-only or debug)
- `RunnerService.run(language, source)` → `DockerRunResult` — internal service consumed by Grading
- `SidecarUnavailableError` — typed error for infra failures (retryable, not a student bug)
- Output contract: stdout, stderr, exitCode, truncation flag

## Dependencies
- dockerode + Docker daemon
- The sidecar containers (built separately in `platform/docker/`)

## Safety Invariants
- No host FS bind mounts into sidecars
- No network access in sidecars
- Source passed via `SRC` env var, never stdin
- 5s/10s timeouts + 8KB output truncation = DoS protection
