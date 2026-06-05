import { DockerRunner, DockerLike } from '../../src/execution/docker-runner';
import { SidecarUnavailableError } from '../../src/execution/types';
import { Readable, Duplex } from 'stream';

/**
 * Build a mock stream that emits the given stdout/stderr content
 * without using the dockerode multiplex framing. We bypass demux
 * in tests by having the DockerRunner detect a __mock__ property.
 */
function makeMockStream(stdout: string, stderr: string): Duplex & { __mock__: { stdout: string; stderr: string } } {
  const stream = new Duplex({
    read() {},
    write(_chunk: any, _enc: any, cb: () => void) { cb(); },
  }) as Duplex & { __mock__: { stdout: string; stderr: string } };
  stream.__mock__ = { stdout, stderr };
  return stream;
}

function makeDockerMock(opts: {
  containerName?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  throwOnExec?: boolean;
}): DockerLike & { capturedContainer?: string } {
  const mock: DockerLike & { capturedContainer?: string } = {
    capturedContainer: undefined,
    getContainer(name: string) {
      mock.capturedContainer = name;
      return {
        async exec(_execOpts: any) {
          if (opts.throwOnExec) {
            throw new Error('container not found');
          }
          const mockStream = makeMockStream(opts.stdout ?? '', opts.stderr ?? '');
          return {
            async start(_startOpts: any) {
              return mockStream as unknown as NodeJS.ReadWriteStream;
            },
            async inspect() {
              return { ExitCode: opts.exitCode ?? 0 };
            },
          };
        },
      };
    },
  };
  return mock;
}

describe('DockerRunner', () => {
  it('runs swift code and returns exit 0 with stdout', async () => {
    const mock = makeDockerMock({ stdout: 'hello world\n', exitCode: 0 });
    const runner = new DockerRunner(mock);
    const result = await runner.run('swift', 'func greet() { print("hello world") }', 5000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello world\n');
    expect(result.timedOut).toBe(false);
  });

  it('maps compile-error exit 10 with stderr', async () => {
    const mock = makeDockerMock({ stderr: 'error: expected declaration\n', exitCode: 10 });
    const runner = new DockerRunner(mock);
    const result = await runner.run('swift', 'bad code!!!', 5000);
    expect(result.exitCode).toBe(10);
    expect(result.stderr).toBe('error: expected declaration\n');
  });

  it('sets timedOut=true on exit 124', async () => {
    const mock = makeDockerMock({ exitCode: 124 });
    const runner = new DockerRunner(mock);
    const result = await runner.run('swift', 'while true {}', 5000);
    expect(result.exitCode).toBe(124);
    expect(result.timedOut).toBe(true);
  });

  it('throws SidecarUnavailableError when container.exec throws', async () => {
    const mock = makeDockerMock({ throwOnExec: true });
    const runner = new DockerRunner(mock);
    await expect(runner.run('swift', 'anything', 5000)).rejects.toBeInstanceOf(SidecarUnavailableError);
  });

  it('truncates stdout beyond 8KB with trailer message', async () => {
    const bigOutput = 'x'.repeat(9000);
    const mock = makeDockerMock({ stdout: bigOutput, exitCode: 0 });
    const runner = new DockerRunner(mock);
    const result = await runner.run('swift', 'code', 5000);
    expect(result.stdout.length).toBeLessThanOrEqual(8192 + 200); // 8KB + trailer
    expect(result.stdout).toContain('[truncated]');
  });

  it('targets the kotlin sidecar when language is kotlin', async () => {
    const mock = makeDockerMock({ stdout: '', exitCode: 0 });
    const runner = new DockerRunner(mock);
    await runner.run('kotlin', 'fun main() { println("hi") }', 5000);
    expect(mock.capturedContainer).toBe('bootcamp-kotlin-runner');
  });

  describe('container name resolution', () => {
    const original = {
      swift: process.env.SWIFT_RUNNER_CONTAINER,
      kotlin: process.env.KOTLIN_RUNNER_CONTAINER,
    };
    afterEach(() => {
      if (original.swift === undefined) delete process.env.SWIFT_RUNNER_CONTAINER;
      else process.env.SWIFT_RUNNER_CONTAINER = original.swift;
      if (original.kotlin === undefined) delete process.env.KOTLIN_RUNNER_CONTAINER;
      else process.env.KOTLIN_RUNNER_CONTAINER = original.kotlin;
    });

    it('honors SWIFT_RUNNER_CONTAINER override (e.g. prod -prod suffix)', async () => {
      process.env.SWIFT_RUNNER_CONTAINER = 'bootcamp-swift-runner-prod';
      const mock = makeDockerMock({ stdout: '', exitCode: 0 });
      await new DockerRunner(mock).run('swift', 'code', 5000);
      expect(mock.capturedContainer).toBe('bootcamp-swift-runner-prod');
    });

    it('honors KOTLIN_RUNNER_CONTAINER override (e.g. prod -prod suffix)', async () => {
      process.env.KOTLIN_RUNNER_CONTAINER = 'bootcamp-kotlin-runner-prod';
      const mock = makeDockerMock({ stdout: '', exitCode: 0 });
      await new DockerRunner(mock).run('kotlin', 'code', 5000);
      expect(mock.capturedContainer).toBe('bootcamp-kotlin-runner-prod');
    });

    it('falls back to the dev default when the env var is unset', async () => {
      delete process.env.SWIFT_RUNNER_CONTAINER;
      const mock = makeDockerMock({ stdout: '', exitCode: 0 });
      await new DockerRunner(mock).run('swift', 'code', 5000);
      expect(mock.capturedContainer).toBe('bootcamp-swift-runner');
    });
  });
});
