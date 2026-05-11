import {
  Button, Card, Input, SearchInput, Badge, Chip, ProgressBar, ProgressRing,
  Avatar, Logo, Icon, Heading, Eyebrow, Stack, Row, Divider,
} from '@/components/ui';

function Pane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ marginTop: 12 }}>
      <Eyebrow>{title}</Eyebrow>
      <div style={{ marginTop: 8 }}>{children}</div>
    </Card>
  );
}

export function Primitives() {
  return (
    <section id="primitives" style={{ marginTop: 48 }}>
      <Eyebrow>2. Primitives</Eyebrow>
      <Heading level="h1" style={{ marginTop: 8 }}>Library</Heading>

      <Pane title="Button">
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Button>Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="iridescent">Iridescent</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
          <Button disabled>Disabled</Button>
        </Row>
        <Row style={{ gap: 8, marginTop: 12 }}>
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
          <Button iconOnly aria-label="settings"><Icon name="settings" size={16} /></Button>
        </Row>
      </Pane>

      <Pane title="Input / SearchInput">
        <Stack gap="tight">
          <Input placeholder="Default input" />
          <SearchInput placeholder="Search lessons, paths, badges…" />
        </Stack>
      </Pane>

      <Pane title="Badge">
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Badge>Default</Badge>
          <Badge tone="brand" dot>Brand</Badge>
          <Badge tone="iris" dot>Swift</Badge>
          <Badge tone="amber" dot>Kotlin</Badge>
          <Badge tone="success" dot>Done</Badge>
          <Badge mono>L08</Badge>
        </Row>
      </Pane>

      <Pane title="Chip">
        <Row style={{ gap: 8 }}>
          <Chip>Default</Chip>
          <Chip active>Active</Chip>
        </Row>
      </Pane>

      <Pane title="Card">
        <Row style={{ gap: 12, alignItems: 'stretch' }}>
          <Card style={{ flex: 1 }}>Default card</Card>
          <Card variant="elevated" style={{ flex: 1 }}>Elevated card</Card>
          <Card variant="glow" style={{ flex: 1 }}>Glow card</Card>
        </Row>
      </Pane>

      <Pane title="ProgressBar">
        <Stack gap="tight">
          <ProgressBar value={0} thickness="thin" />
          <ProgressBar value={40} />
          <ProgressBar value={100} thickness="thick" />
        </Stack>
      </Pane>

      <Pane title="ProgressRing">
        <Row style={{ gap: 16 }}>
          <ProgressRing value={0} />
          <ProgressRing value={40} />
          <ProgressRing value={100} />
        </Row>
      </Pane>

      <Pane title="Avatar">
        <Row style={{ gap: 12, alignItems: 'center' }}>
          <Avatar size="sm" initials="JK" />
          <Avatar initials="JK" />
          <Avatar size="lg" initials="JK" />
        </Row>
      </Pane>

      <Pane title="Logo">
        <Row style={{ gap: 16 }}>
          <Logo size="sm" />
          <Logo />
        </Row>
      </Pane>

      <Pane title="Icon set">
        <Row style={{ gap: 16, flexWrap: 'wrap' }}>
          {(['home','tree','play','user','trophy','bookmark','settings','flame','bolt','check','chevR','chevL','star','lock','code','grid','book','target','search','plus','arrowR','refresh'] as const).map((n) => (
            <div key={n} style={{ width: 64, textAlign: 'center' }}>
              <Icon name={n} size={20} />
              <div className="mono" style={{ fontSize: 'var(--t-2xs)', color: 'var(--text-3)' }}>{n}</div>
            </div>
          ))}
        </Row>
      </Pane>

      <Divider />
    </section>
  );
}
