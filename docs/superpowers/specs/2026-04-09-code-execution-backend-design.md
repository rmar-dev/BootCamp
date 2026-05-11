# Spec #3 — Code Execution Backend

**Date:** 2026-04-09
**Status:** Design approved, awaiting implementation plan
**Depends on:** Spec #1 (content & curriculum model — `master`), Spec #2 (lesson runtime — `feat/lesson-runtime` branch)
**Successor specs:** #5 (submission persistence + grading flow)

## Goal

Unlock the disabled Run button on `code` and `fix_bug` exercises. When a student clicks Run, their code is compiled and executed against the exercise's hidden test code inside a language-specific Docker sidecar, and the result is displayed in the web UI. Both Swift and Kotlin ship together.

No attempt persistence. No points. No grading pipeline. Just: click Run, get a pass/fail result with stdout/stderr.

## Non-goals

- Persisting attempts, updating `ExerciseResult`, awarding points (spec #5)
- Structured per-test results ("test 3 of 5 failed") — spec #9 when authoring tooling can reliably produce structured harnesses
- Security hardening for public internet exposure: seccomp profiles, per-submission ephemeral containers, user namespaces, egress policies beyond `network_mode: none` (follow-up security pass — explicitly not blocking controlled bootcamp cohorts)
- Job queue / horizontal scaling (tens-of-students scale doesn't need it)
- Websocket progress streaming (sync HTTP under 5s is enough)
- In-browser WASM execution — SwiftWasm and Kotlin/JS were considered and rejected (SwiftWasm is a ~50MB bundle, both toolchains have incomplete stdlib coverage, and the server-side approach is simpler)

## Architecture

### New backend module

```
platform/
  docker-compose.yml                    (modified — 2 new sidecars)
  src/
    execution/                          (NEW)
      execution.module.ts
      run.controller.ts                 (POST /api/run)
      runner.service.ts                 (orchestration + queue)
      docker-runner.ts                  (thin dockerode wrapper)
      harness.ts                        (pure string builder)
      types.ts                          (RunRequest, RunResponse, RunOutcome, errors)
```

`ExecutionModule` imports `ContentModule` so `RunnerService` can resolve `(exerciseId, exerciseVersion)` via the existing `LessonAssemblerService` or `ExerciseRepository`.

### Sidecar containers

Two long-running containers added to `platform/docker-compose.yml`, both idle-until-exec'd:

```yaml
swift-runner:
  image: swift:5.10
  container_name: bootcamp-swift-runner
  command: tail -f /dev/null
  read_only: true
  network_mode: none
  tmpfs:
    - /tmp
    - /work
  mem_limit: 256m
  cpus: 1.0

kotlin-runner:
  image: zenika/kotlin:1.9.25-jdk17
  container_name: bootcamp-kotlin-runner
  command: tail -f /dev/null
  read_only: true
  network_mode: none
  tmpfs:
    - /tmp
    - /work
  mem_limit: 256m
  cpus: 1.0
```

The sidecars are plain compiler images with their root filesystem read-only and `/tmp` + `/work` mounted as in-memory tmpfs. No network access. No access to the host filesystem or any other container. The host Nest process talks to them via `docker exec`.

### Host → sidecar protocol

`DockerRunner` shells out to `docker exec -i <container>` with the student source piped on stdin and the work happens inside a tempdir on the sidecar's tmpfs. The full exec command for Swift:

```bash
bash -c '
set -e
cd /work
dir=$(mktemp -d)
cd "$dir"
cat > main.swift
if ! timeout 5 swiftc -O none main.swift -o a.out 2>&1; then
  rm -rf "$dir"
  exit 10
fi
timeout 5 ./a.out
ec=$?
rm -rf "$dir"
exit $ec
'
```

Exit code conventions (same for both languages):

| Code | Meaning |
|---|---|
| `0` | Passed — tests ran and exited cleanly |
| `10` | Compile error — compiler reported diagnostics to stderr |
| `124` | Timeout — GNU `timeout` killed the process |
| anything else | Runtime failure — test assertion threw or program crashed |

Kotlin uses the same shape with `kotlinc main.kt -include-runtime -d out.jar && kotlin out.jar`. Kotlin's 1.5s-ish cold compile is why the per-phase budget is 5s, not 2s.

### Wire contract

```ts
// POST /api/run
type RunRequest = {
  exerciseId: string;
  exerciseVersion: number;
  code: string;              // student's current editor contents
};

type RunOutcome =
  | 'passed'
  | 'failed'
  | 'compile_error'
  | 'timed_out'
  | 'internal_error';

type RunResponse = {
  outcome: RunOutcome;
  passed: boolean;           // convenience — true iff outcome === 'passed'
  stdout: string;            // truncated at 8 KB
  stderr: string;            // truncated at 8 KB; compile errors appear here
  durationMs: number;
  timedOut: boolean;
};
```

HTTP status codes:

- **200** — any `RunOutcome`, including `internal_error`. The client always parses the body.
- **404** — the exercise doesn't exist or isn't published (delegates to `ExerciseRepository.findByVersion` + `publishedAt` check).
- **400** — `exerciseVersion` isn't an integer, `code` missing, etc.
- **500** — the Nest process itself crashed (not a normal RunOutcome case).

### Concurrency guard

`RunnerService` holds an in-process `Semaphore(4)`. Requests beyond 4 concurrent wait in memory. A request that waits more than 10 seconds in the queue is rejected with `outcome: 'internal_error'` and `stderr: "execution queue saturated, retry in a moment."` No persistence, no Redis, no external queue.

### Error taxonomy

`DockerRunner` throws typed errors:

- `SidecarUnavailable` — the container isn't running or `docker exec` returned a Docker-level error
- `CompileFailed` — exit code 10
- `ExecTimedOut` — exit code 124
- `ExecFailed` — non-zero exit that isn't 10 or 124

`RunnerService` maps these to `RunOutcome`:

| Thrown | Outcome |
|---|---|
| Clean exit 0 | `passed` |
| `CompileFailed` | `compile_error` |
| `ExecTimedOut` | `timed_out` |
| `ExecFailed` | `failed` |
| `SidecarUnavailable` or unknown | `internal_error` |

`RunController` always returns HTTP 200 with the mapped body (except the 404/400/500 cases above).

### Output truncation

`stdout` and `stderr` are each truncated to 8 KB. If truncation happened, the last 40 bytes are replaced with `\n... (truncated, N more bytes)`. Prevents a student infinite-print loop from ballooning the response.

## Harness format

Given an exercise's `testCode` (plain assertion code from the spec #1 payload) and the student's `code`, `harness.ts` assembles a single source file:

**Swift:**

```swift
// student code
<studentCode>

// --- tests below ---
<testCode>
```

A failed `assert(...)` in Swift raises at runtime → non-zero exit → `outcome: 'failed'`. A compile error → swiftc exit 10 → `outcome: 'compile_error'`.

**Kotlin:**

```kotlin
// student code
<studentCode>

// --- tests below ---
fun main() {
  <testCode>
}
```

Kotlin's `check(...)` / `require(...)` throw on failure → non-zero exit → `outcome: 'failed'`. `testCode` is expected to use those; the existing seed exercise scheme will be extended when we add a Kotlin seed.

**No changes to the spec #1 exercise payload schema.** The existing `code` and `fix_bug` payloads already have `starterCode` / `brokenCode`, `testCode`, `testEntryPoint`, and `language: 'swift' | 'kotlin'`. Spec #3 only adds a consumer.

### Seed updates

The existing Swift seed exercises (`SEED_EX_CODE_ID`, `SEED_EX_FIXBUG_ID`) already have valid `testCode` — they should work unchanged. A new Kotlin `code` exercise will be added to the seed so Kotlin has at least one demoable exercise:

```ts
{
  type: 'code',
  language: 'kotlin',
  starterCode: 'fun greet(): String {\n  // your code here\n  return ""\n}\n',
  testCode: 'check(greet() == "hello") { "expected \\"hello\\", got \\"${greet()}\\"" }',
  testEntryPoint: 'greet',
}
```

## Web UI changes

### Live renderers

`web/components/lesson/renderers/CodeExercise.tsx` and `FixBugExercise.tsx` stop being editor-only. Behavior:

- The Run button is no longer disabled. It reads "Run tests" and uses the existing `PrimaryButton` component.
- Clicking Run sets local state `running: true` (button shows spinner + "Running…" label), calls `runExercise(exerciseId, version, code)` from a new `web/lib/run.ts`, and stores the response in local state.
- On response, renders a new `RunResult` component below the Monaco editor.
- Errors from the fetch (network down, server 500) surface as `outcome: 'internal_error'` in the `RunResult` UI — never an uncaught exception.

### New components

- **`web/lib/run.ts`** — the client. Single exported function:
  ```ts
  export async function runExercise(
    exerciseId: string,
    exerciseVersion: number,
    code: string,
  ): Promise<RunResponse>
  ```
  Hits `${NEXT_PUBLIC_API_BASE}/api/run`, catches fetch errors, returns a synthetic `internal_error` response on any failure. Never throws.
- **`web/components/lesson/renderers/RunResult.tsx`** — the display. Takes `{ result: RunResponse }`. Renders one of five panel variants (`passed`, `failed`, `compile_error`, `timed_out`, `internal_error`). Each variant has a banner with icon/color, the exit reason, and a dark monospace block showing stdout/stderr. Dark-mode variants included.

### `CheckResult` stays

The existing `CheckResult` component in `_shared.tsx` is for the three client-side-checkable types (`multiple_choice`, `fill_blank`, `predict_output`). It stays exactly as is. `RunResult` is a separate component with different semantics.

### No persistence

Refreshing the page loses the last run's result. Persistence is spec #5's job.

## Testing

All development follows TDD: write failing test → run → implement minimum → run → commit. Same cadence specs #1 and #2 used.

| Layer | Tool | Coverage |
|---|---|---|
| `harness.build` (pure) | Jest | Swift and Kotlin source shape, `testCode` inlined correctly, marker comment present, no extra whitespace/indentation drift |
| `RunnerService` (mocked `DockerRunner`) | Jest | Happy path → `passed`; compile error → `compile_error`; timeout → `timed_out`; generic fail → `failed`; sidecar down → `internal_error`; unknown exercise → 404 (via NotFoundException); semaphore limits 4 concurrent, 5th waits; queue wait > 10s → `internal_error` |
| `RunController` HTTP | Jest + supertest | POST happy path returns 200 with correct body; 404 for missing exercise; 400 for missing/invalid fields; every `RunOutcome` returns 200 |
| Real-compiler e2e | Jest | One test per language, **skipped by default** (`describe.skip` or env gate `RUN_EXECUTION_E2E=1`). Compiles and runs a hello-world happy-path plus a deliberate syntax-error → `compile_error`. Requires both sidecars healthy. |
| `runExercise` client | Vitest | Mocked `fetch`; covers 200 + each outcome branch; network error → synthetic `internal_error` response |
| `RunResult` component | Vitest + RTL | One test per variant: correct banner text, correct color class, correct monospace output blocks, dark-mode classes present |
| `CodeExercise` / `FixBugExercise` | Vitest + RTL | Click Run → loading state shows; mocked `runExercise` resolves → `RunResult` renders; button re-enables after response; second click triggers another run and replaces previous result |
| Playwright E2E | Playwright | One new smoke: open seed lesson, navigate to the Swift code exercise (`?ex=5`), replace starterCode with the known-good solution, click Run, assert green "Tests passed!" appears. Requires both sidecars, Nest, Next all running — matches the existing Playwright gate. |

## Success criteria

1. Clicking Run on a `code` or `fix_bug` exercise compiles and runs the student's code in the appropriate sidecar and returns a result within the total budget (5s compile + 5s run = 10s worst case). A typical correct submission returns in <2 seconds.
2. A correct Swift solution to the seed `greet` exercise returns `outcome: 'passed'`.
3. A correct Kotlin solution to the new Kotlin seed exercise returns `outcome: 'passed'`.
4. A simple compile error (`let x =`) returns `outcome: 'compile_error'` with swiftc's actual diagnostic in `stderr`.
5. An infinite loop (`while true {}`) returns `outcome: 'timed_out'` after ~5 seconds.
6. Four concurrent Run clicks all succeed; a fifth one queues briefly but completes. A burst of 100 clicks eventually drains without any crashing the Nest process.
7. With the Swift sidecar stopped (`docker compose stop swift-runner`), clicking Run on a Swift exercise returns `outcome: 'internal_error'` with a clear stderr message.
8. All Jest and Vitest suites pass in default mode. The real-compiler e2e test passes when explicitly run against live sidecars. Playwright smoke passes against a full live stack.

## Architectural decisions worth knowing

1. **Server-side `swiftc` / `kotlinc`, not in-browser WASM.** SwiftWasm is a ~50MB lazy-load, incomplete stdlib coverage, and too much complexity for a bootcamp audience that will push on edge cases. A 200-line `DockerRunner` shelling out to the real compilers is simpler to build and honest about what it does.
2. **Docker sidecars, not host install.** Keeps dev-on-Windows working identically to prod-on-Linux. The sidecars are plain upstream compiler images with no network, `read_only` root, and tmpfs for `/tmp` and `/work`. No custom Dockerfile, no image maintenance burden.
3. **`docker exec` on long-running sidecars, not ephemeral containers per run.** Saves ~500ms per submission (container startup). For tens of concurrent students, idle sidecars cost basically nothing.
4. **OS-level sandboxing only (timeout + memory cap + no network + read-only FS).** Documented as "safe for controlled cohorts, not for public exposure." Hardening is a follow-up security pass if the platform ever goes public. Spec #3 is not a security spec.
5. **Always-200 response shape.** Every RunOutcome returns HTTP 200 with a structured body. Simplifies the client (one parse path for all outcomes) and matches how the eventual attempts endpoint (spec #5) will behave.
6. **8 KB output truncation.** Student code can print a lot; a 10-line "Hello World" should never be the cause of a 10 MB HTTP response.
7. **In-process semaphore, no Redis/queue infra.** Fits the scale. Spec #5 and spec #6 may introduce attempt persistence and streaks, but neither requires a cross-process queue yet.
8. **Spec #3 does not persist attempts.** Clean separation from spec #5. A student's "working" solution is ephemeral — refreshing the page loses it. Matches how spec #2 skipped persistence for the check UI.
