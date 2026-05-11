'use client';
import { useState } from 'react';
import {
  SkillNode, Hearts, DnDSlot, DnDToken, CodeBlock, CodeFrame, KPI,
  SegmentedControl, Card, Eyebrow, Heading, Row, Stack, Icon,
} from '@/components/ui';

export function Composites() {
  const [track, setTrack] = useState<'swift' | 'kotlin'>('swift');
  const tint = track;

  return (
    <section id="composites" style={{ marginTop: 48 }}>
      <Eyebrow>3. Composite primitives</Eyebrow>
      <Heading level="h1" style={{ marginTop: 8 }}>Lesson primitives</Heading>

      <Card style={{ marginTop: 12 }}>
        <Eyebrow>SkillNode</Eyebrow>
        <Row style={{ gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {(['completed','current','available','locked'] as const).map((s) => (
            <Stack gap="tight" key={s} style={{ alignItems: 'center' }}>
              <SkillNode state={s} tint={tint}>
                {s === 'completed' && <Icon name="check" size={24} />}
                {s === 'current' && <Icon name="play" size={20} />}
                {s === 'available' && <Icon name="play" size={20} />}
                {s === 'locked' && <Icon name="lock" size={20} />}
              </SkillNode>
              <span className="mono" style={{ fontSize: 'var(--t-2xs)', color: 'var(--text-3)' }}>{s}</span>
            </Stack>
          ))}
        </Row>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Eyebrow>Hearts</Eyebrow>
        <Row style={{ gap: 16, marginTop: 12 }}>
          <Hearts count={5} />
          <Hearts count={3} />
          <Hearts count={0} />
        </Row>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Eyebrow>DnD slot + token</Eyebrow>
        <Row style={{ gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <DnDSlot>drop</DnDSlot>
          <DnDSlot filled tint="swift">@State</DnDSlot>
          <DnDSlot filled tint="kotlin">remember</DnDSlot>
          <DnDToken>var</DnDToken>
          <DnDToken used>let</DnDToken>
        </Row>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Eyebrow>CodeBlock + CodeFrame</Eyebrow>
        <CodeFrame tabs={[{ label: track === 'swift' ? 'main.swift' : 'Main.kt', active: true }]}>
          <CodeBlock>
            {track === 'swift'
              ? 'func greet(_ name: String) -> String {\n  return "Hello, \\(name)!"\n}'
              : 'fun greet(name: String): String {\n  return "Hello, $name!"\n}'}
          </CodeBlock>
        </CodeFrame>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Eyebrow>KPI</Eyebrow>
        <Row style={{ gap: 32, marginTop: 12 }}>
          <KPI label="Streak" value="12" delta="+1 today" />
          <KPI label="Daily XP" value="18 / 20" peacock />
        </Row>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Eyebrow>SegmentedControl</Eyebrow>
        <div style={{ marginTop: 12 }}>
          <SegmentedControl
            value={track}
            onChange={setTrack}
            options={[
              { value: 'swift', label: 'Swift', activeClassName: 'swift' },
              { value: 'kotlin', label: 'Kotlin', activeClassName: 'kotlin' },
            ]}
          />
        </div>
      </Card>
    </section>
  );
}
