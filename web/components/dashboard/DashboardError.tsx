import { Card } from '@/components/ui/Card';
import { Heading } from '@/components/ui/Heading';

type Props = { message: string; onRetry: () => void };

export function DashboardError({ message, onRetry }: Props) {
  return (
    <Card>
      <Heading level="h3">Couldn&apos;t load dashboard</Heading>
      <p className="muted" style={{ marginTop: 8 }}>{message}</p>
      <button type="button" onClick={onRetry} className="btn btn-primary" style={{ marginTop: 16 }}>
        Retry
      </button>
    </Card>
  );
}
