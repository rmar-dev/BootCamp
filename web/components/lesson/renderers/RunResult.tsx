import type { RunResponse } from '@/lib/run';
import { Callout, CodeOutput, Icon, Stack, type CalloutTone, type IconName } from '@/components/ui';

type Variant = {
  title: string;
  tone: CalloutTone;
  icon: IconName;
  showStdout: boolean;
  showStderr: boolean;
};

const VARIANTS: Record<RunResponse['outcome'], Variant> = {
  passed:         { title: 'Tests passed!',                  tone: 'success', icon: 'check', showStdout: true,  showStderr: false },
  failed:         { title: 'Tests failed.',                  tone: 'danger',  icon: 'bolt',  showStdout: true,  showStderr: true  },
  compile_error:  { title: 'Compile error.',                 tone: 'warning', icon: 'bolt',  showStdout: false, showStderr: true  },
  timed_out:      { title: 'Timed out after 10 seconds.',    tone: 'danger',  icon: 'bolt',  showStdout: true,  showStderr: true  },
  internal_error: { title: 'Execution service unavailable.', tone: 'neutral', icon: 'bolt',  showStdout: false, showStderr: true  },
};

export function RunResult({ result }: { result: RunResponse | null }) {
  if (!result) return null;
  const variant = VARIANTS[result.outcome];
  return (
    <Stack gap="tight">
      <Callout tone={variant.tone} title={variant.title} icon={<Icon name={variant.icon} size={14} />} />
      {variant.showStdout && result.stdout && (
        <CodeOutput stream="stdout" label="stdout">{result.stdout}</CodeOutput>
      )}
      {variant.showStderr && result.stderr && (
        <CodeOutput stream="stderr" label="stderr">{result.stderr}</CodeOutput>
      )}
    </Stack>
  );
}
