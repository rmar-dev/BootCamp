import { Heading, Eyebrow, Stack, Row } from '@/components/ui';

const PEACOCK = ['50','100','200','300','400','500','600','700','800','900'];
const SURFACES = ['bg-0','bg-1','bg-2','bg-3','bg-4'];
const SPACINGS = ['s-1','s-2','s-3','s-4','s-5','s-6','s-8','s-10','s-12','s-16','s-20'];
const RADII = ['r-xs','r-sm','r-md','r-lg','r-xl','r-2xl','r-pill'];

function Swatch({ token, label }: { token: string; label?: string }) {
  return (
    <div style={{ width: 120 }}>
      <div style={{ width: '100%', height: 64, background: `var(--${token})`, borderRadius: 8, border: '1px solid var(--line-2)' }} />
      <div className="mono" style={{ fontSize: 'var(--t-xs)', color: 'var(--text-3)', marginTop: 6 }}>{label || token}</div>
    </div>
  );
}

export function Foundations() {
  return (
    <section id="foundations" style={{ marginTop: 32 }}>
      <Eyebrow>1. Foundations</Eyebrow>
      <Heading level="h1" style={{ marginTop: 8 }}>Tokens</Heading>

      <Heading level="h3" style={{ marginTop: 24 }}>Peacock spectrum</Heading>
      <Row style={{ flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        {PEACOCK.map((p) => <Swatch key={p} token={`peacock-${p}`} />)}
      </Row>

      <Heading level="h3" style={{ marginTop: 24 }}>Surfaces</Heading>
      <Row style={{ flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        {SURFACES.map((s) => <Swatch key={s} token={s} />)}
      </Row>

      <Heading level="h3" style={{ marginTop: 24 }}>Track accents</Heading>
      <Row style={{ flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
        <Swatch token="iris-400" label="iris (Swift)" />
        <Swatch token="amber-400" label="amber (Kotlin)" />
        <Swatch token="royal-400" label="royal" />
      </Row>

      <Heading level="h3" style={{ marginTop: 24 }}>Typography</Heading>
      <Stack gap="tight" style={{ marginTop: 12 }}>
        <div className="h-display">Display heading</div>
        <div className="h1">Heading 1</div>
        <div className="h2">Heading 2</div>
        <div className="h3">Heading 3</div>
        <div className="h4">Heading 4</div>
        <div>Body text — Inter Tight, 15px.</div>
        <div className="mono">mono · JetBrains Mono</div>
      </Stack>

      <Heading level="h3" style={{ marginTop: 24 }}>Spacing</Heading>
      <Stack gap="tight" style={{ marginTop: 12 }}>
        {SPACINGS.map((s) => (
          <Row key={s} style={{ alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ width: 60, fontSize: 'var(--t-xs)', color: 'var(--text-3)' }}>{s}</span>
            <div style={{ height: 8, width: `var(--${s})`, background: 'var(--peacock-400)', borderRadius: 2 }} />
          </Row>
        ))}
      </Stack>

      <Heading level="h3" style={{ marginTop: 24 }}>Radius</Heading>
      <Row style={{ gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        {RADII.map((r) => (
          <div key={r} style={{ width: 96, textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, background: 'var(--bg-3)', borderRadius: `var(--${r})`, border: '1px solid var(--line-2)', margin: '0 auto' }} />
            <div className="mono" style={{ fontSize: 'var(--t-xs)', color: 'var(--text-3)', marginTop: 6 }}>{r}</div>
          </div>
        ))}
      </Row>
    </section>
  );
}
