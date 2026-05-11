'use client';
import { useTweaks } from '@/lib/tweaks';
import { TweaksPanel, TweakSection, TweakRadio, Heading, Eyebrow, Stack } from '@/components/ui';
import { Foundations } from './sections/Foundations';
import { Primitives } from './sections/Primitives';
import { Composites } from './sections/Composites';
import { Lesson } from './sections/Lesson';

export function Showcase() {
  const { theme, density, setTheme, setDensity } = useTweaks();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh' }}>
      <nav style={{ position: 'sticky', top: 0, height: '100vh', padding: 24, borderRight: '1px solid var(--line-1)', background: 'var(--bg-1)' }}>
        <Eyebrow>Design system</Eyebrow>
        <Stack gap="tight" style={{ marginTop: 16 }}>
          <a href="#foundations" style={{ color: 'var(--text-2)' }}>Foundations</a>
          <a href="#primitives" style={{ color: 'var(--text-2)' }}>Primitives</a>
          <a href="#composites" style={{ color: 'var(--text-2)' }}>Composites</a>
          <a href="#lesson" style={{ color: 'var(--text-2)' }}>Lesson</a>
        </Stack>
      </nav>
      <main style={{ padding: 32, maxWidth: 1080 }}>
        <Heading level="display">BootCamp design system</Heading>
        <p style={{ color: 'var(--text-2)', marginTop: 8 }}>
          Live reference for tokens and primitives. All variants in one place.
        </p>
        <Foundations />
        <Primitives />
        <Composites />
        <Lesson />
      </main>
      <TweaksPanel title="Tweaks" defaultOpen>
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme" value={theme === 'system' ? 'dark' : theme} options={['dark', 'light']} onChange={setTheme} />
        <TweakRadio label="Density" value={density} options={['comfortable', 'compact']} onChange={setDensity} />
      </TweaksPanel>
    </div>
  );
}
