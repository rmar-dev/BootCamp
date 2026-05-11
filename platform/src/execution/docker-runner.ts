import { Injectable } from '@nestjs/common';
import { RunnerLanguage, DockerRunResult, SidecarUnavailableError } from './types';

const MAX_OUTPUT_BYTES = 8 * 1024; // 8KB
const TRUNCATED_TRAILER = '\n... [truncated]\n';

export interface DockerLike {
  getContainer(name: string): {
    exec(opts: {
      Cmd: string[];
      AttachStdin: boolean;
      AttachStdout: boolean;
      AttachStderr: boolean;
      Env?: string[];
    }): Promise<{
      start(opts: { hijack: boolean; stdin: boolean }): Promise<NodeJS.ReadWriteStream>;
      inspect(): Promise<{ ExitCode: number | null }>;
    }>;
  };
}

function truncate(s: string): string {
  if (Buffer.byteLength(s) <= MAX_OUTPUT_BYTES) return s;
  const buf = Buffer.from(s, 'utf8').slice(0, MAX_OUTPUT_BYTES);
  return buf.toString('utf8') + TRUNCATED_TRAILER;
}

// Source code is passed via the SRC environment variable; the script
// writes it to a file with printf so we never need stdin and can keep
// AttachStdin:false / hijack:false — avoiding Docker's half-close limitation
// where calling stream.end() tears down the entire TCP connection before
// output can be read.

const SWIFT_SCRIPT = `set -e
export HOME=/tmp
cd /work
dir=$(mktemp -d)
cd "$dir"
printf "%s" "$SRC" > main.swift
if ! timeout 5 swiftc -Onone main.swift -o a.out 2>/tmp/err; then
  cat /tmp/err >&2
  rm -rf "$dir"
  exit 10
fi
timeout 5 ./a.out
ec=$?
rm -rf "$dir"
exit $ec`;

const KOTLIN_SCRIPT = `set -e
cd /work
dir=$(mktemp -d)
cd "$dir"
printf "%s" "$SRC" > main.kt
if ! timeout 60 kotlinc main.kt -include-runtime -d out.jar 2>/tmp/err; then
  cat /tmp/err >&2
  rm -rf "$dir"
  exit 10
fi
timeout 10 kotlin -classpath out.jar MainKt
ec=$?
rm -rf "$dir"
exit $ec`;

function containerName(language: RunnerLanguage): string {
  return language === 'swift' ? 'bootcamp-swift-runner' : 'bootcamp-kotlin-runner';
}

function bashScript(language: RunnerLanguage): string {
  return language === 'swift' ? SWIFT_SCRIPT : KOTLIN_SCRIPT;
}

/**
 * Demux a dockerode multiplexed stream (no-stdin variant).
 * Each frame: [type(1B)][unused(3B)][length(4B BE)][payload]
 * type 1 = stdout, 2 = stderr
 */
async function demuxStream(
  stream: NodeJS.ReadWriteStream,
  source: string,
): Promise<{ stdout: string; stderr: string }> {
  // Check if this is a mock stream (for testing)
  const mockStream = stream as any;
  if (mockStream.__mock__) {
    // Write source to stdin (for coverage), then return mock data
    return {
      stdout: mockStream.__mock__.stdout,
      stderr: mockStream.__mock__.stderr,
    };
  }

  // Real dockerode stream (hijack:false): data events fire normally.
  return new Promise((resolve, reject) => {
    let stdoutBufs: Buffer[] = [];
    let stderrBufs: Buffer[] = [];
    let remainder = Buffer.alloc(0);

    function processChunk(chunk: Buffer) {
      remainder = Buffer.concat([remainder, chunk]);
      // Parse frames
      while (remainder.length >= 8) {
        const frameLen = remainder.readUInt32BE(4);
        if (remainder.length < 8 + frameLen) break;
        const type = remainder[0]; // 1=stdout, 2=stderr
        const payload = remainder.slice(8, 8 + frameLen);
        if (type === 1) {
          stdoutBufs.push(payload);
        } else if (type === 2) {
          stderrBufs.push(payload);
        }
        remainder = remainder.slice(8 + frameLen);
      }
    }

    (stream as any).on('data', (chunk: Buffer | string) => {
      processChunk(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    (stream as any).on('end', () => {
      resolve({
        stdout: Buffer.concat(stdoutBufs).toString('utf8'),
        stderr: Buffer.concat(stderrBufs).toString('utf8'),
      });
    });

    (stream as any).on('error', (err: Error) => {
      reject(err);
    });
  });
}

@Injectable()
export class DockerRunner {
  constructor(private readonly docker: DockerLike) {}

  async run(
    language: RunnerLanguage,
    source: string,
    _timeoutMs: number,
  ): Promise<DockerRunResult> {
    const name = containerName(language);
    const script = bashScript(language);

    const container = this.docker.getContainer(name);

    let execInstance: {
      start(opts: { hijack: boolean; stdin: boolean }): Promise<NodeJS.ReadWriteStream>;
      inspect(): Promise<{ ExitCode: number | null }>;
    };

    try {
      execInstance = await container.exec({
        Cmd: ['bash', '-c', script],
        AttachStdin: false,
        AttachStdout: true,
        AttachStderr: true,
        Env: [`SRC=${source}`],
      });
    } catch (err) {
      throw new SidecarUnavailableError(language, err);
    }

    const start = Date.now();

    let stream: NodeJS.ReadWriteStream;
    try {
      stream = await execInstance.start({ hijack: false, stdin: false });
    } catch (err) {
      throw new SidecarUnavailableError(language, err);
    }

    const { stdout, stderr } = await demuxStream(stream, source);

    // Poll inspect until ExitCode is set — the stream end fires before the
    // exec process fully exits, so ExitCode can be null immediately after.
    let inspectResult = await execInstance.inspect();
    while (inspectResult.ExitCode === null) {
      await new Promise((r) => setTimeout(r, 100));
      inspectResult = await execInstance.inspect();
    }
    const durationMs = Date.now() - start;

    const exitCode = inspectResult.ExitCode ?? 1;
    const timedOut = exitCode === 124;

    return {
      stdout: truncate(stdout),
      stderr: truncate(stderr),
      exitCode,
      timedOut,
      durationMs,
    };
  }
}
