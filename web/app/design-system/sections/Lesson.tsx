'use client';
import { useState } from 'react';
import {
  Badge, Button, Callout, Card, Choice, CodeBlock, CodeFrame, CodeOutput,
  Eyebrow, Heading, HexBar, Icon, Row, Stack, StepDots, Toast, ToastStack,
  Video,
  type ChoiceState, type HexState,
} from '@/components/ui';
import { ExplanationBlock } from '@/components/lesson/ExplanationBlock';
import { VideoBlock } from '@/components/lesson/VideoBlock';
import { MultipleChoiceExercise } from '@/components/lesson/renderers/MultipleChoiceExercise';
import { FillBlankExercise } from '@/components/lesson/renderers/FillBlankExercise';
import { PredictOutputExercise } from '@/components/lesson/renderers/PredictOutputExercise';
import { CodeExercise } from '@/components/lesson/renderers/CodeExercise';
import { CapstoneSubmissionExercise } from '@/components/lesson/renderers/CapstoneSubmissionExercise';
import { VisualPlaygroundExercise } from '@/components/lesson/renderers/VisualPlaygroundExercise';
import { LessonCompleteScreen } from '@/components/lesson/player/LessonCompleteScreen';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

function Pane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ marginTop: 12 }}>
      <Eyebrow>{title}</Eyebrow>
      <div style={{ marginTop: 12 }}>{children}</div>
    </Card>
  );
}

const HEX_DEMO: HexState[] = ['first_try', 'first_try', 'eventual', 'first_try', 'unattempted', 'unattempted'];

export function Lesson() {
  const [step, setStep] = useState(2);
  const totalSteps = 6;
  const [picked, setPicked] = useState<string | null>('a');
  const [showToast, setShowToast] = useState(false);

  return (
    <section id="lesson" style={{ marginTop: 48 }}>
      <Eyebrow>4. Lesson primitives</Eyebrow>
      <Heading level="h1" style={{ marginTop: 8 }}>Lesson player kit</Heading>
      <p style={{ color: 'var(--text-2)', marginTop: 8 }}>
        Composable building blocks used by <code className="mono">/lesson</code>.
        Use these to assemble new exercise types or rebuild flows without bespoke CSS.
      </p>

      <Pane title="Callout">
        <Stack gap="tight">
          <Callout tone="neutral" title="Neutral notice">Default tone, no urgency.</Callout>
          <Callout tone="brand" title="Brand callout" icon={<Icon name="bolt" size={14} />}>Highlights a feature or recommendation.</Callout>
          <Callout tone="success" title="Passed — submission locked"
            icon={<Icon name="check" size={14} />}
            trailing={<Button variant="ghost" size="sm">Reset</Button>}
          >
            Reset to try again.
          </Callout>
          <Callout tone="warning" title="Compile error" icon={<Icon name="bolt" size={14} />}>Check your syntax around line 4.</Callout>
          <Callout tone="danger" title="Tests failed" icon={<Icon name="bolt" size={14} />}>Got <code className="mono">{'"hi"'}</code>, expected <code className="mono">{'"hello"'}</code>.</Callout>
          <Callout tone="info" title="AI review" icon={<span style={{ fontSize: 'var(--t-base)' }}>🤖</span>}>
            Streaming feedback from the AI reviewer goes here.
          </Callout>
          <Callout tone="success" size="sm" icon={<Icon name="check" size={12} />}>
            <strong>Correct!</strong>
          </Callout>
        </Stack>
      </Pane>

      <Pane title="HexBar — per-exercise badge bar (earn-on-perfection)">
        <Stack gap="tight">
          <Row style={{ gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="mono muted" style={{ width: 60, fontSize: 'var(--t-xs)' }}>sm</span>
            <HexBar size="sm" states={HEX_DEMO} />
          </Row>
          <Row style={{ gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="mono muted" style={{ width: 60, fontSize: 'var(--t-xs)' }}>md</span>
            <HexBar states={HEX_DEMO} />
          </Row>
          <Row style={{ gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="mono muted" style={{ width: 60, fontSize: 'var(--t-xs)' }}>lg</span>
            <HexBar size="lg" states={HEX_DEMO} />
          </Row>
        </Stack>
      </Pane>

      <Pane title="StepDots — lesson progress dots">
        <Stack gap="tight">
          <StepDots total={totalSteps} current={step} />
          <Row style={{ gap: 8 }}>
            <Button size="sm" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>← Prev</Button>
            <Button size="sm" variant="ghost" onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}>Next →</Button>
          </Row>
        </Stack>
      </Pane>

      <Pane title="Choice — multiple-choice option row">
        <Stack gap="tight">
          {(['a', 'b', 'c', 'd'] as const).map((id, i) => {
            const isPicked = picked === id;
            const state: ChoiceState =
              picked === 'b' && id === 'b' ? 'correct'
              : picked === 'c' && id === 'c' ? 'wrong'
              : isPicked ? 'picked' : 'idle';
            return (
              <Choice
                key={id}
                state={state}
                keyLabel={String.fromCharCode(65 + i)}
                onClick={() => setPicked(id)}
              >
                Option {id.toUpperCase()} — preview of state <code className="mono">{state}</code>
              </Choice>
            );
          })}
          <Choice keyLabel="E" disabled state="idle">Disabled option</Choice>
        </Stack>
      </Pane>

      <Pane title="CodeFrame + CodeOutput — exercise + run output">
        <Stack gap="tight">
          <CodeFrame
            tabs={[{ label: 'main.swift', active: true }]}
            rightSlot={<Badge tone="iris" mono>SWIFT</Badge>}
          >
            <CodeBlock>{`func greet(_ name: String) -> String {
  return "Hello, \\(name)!"
}`}</CodeBlock>
          </CodeFrame>
          <CodeOutput stream="stdout" label="stdout">{'Hello, Daisy!\nDone in 12ms\n'}</CodeOutput>
          <CodeOutput stream="stderr" label="stderr">{'main.swift:2:10: error: cannot find \'Hello\' in scope\n'}</CodeOutput>
        </Stack>
      </Pane>

      <Pane title="Video — multi-source player (YouTube, Vimeo, Loom, direct .mp4, generic iframe)">
        <Stack gap="default">
          <Stack gap="tight">
            <Eyebrow>Watch · 2 min</Eyebrow>
            <Heading level="h2">What does <span className="mono peacock-text">@State</span> actually do?</Heading>
            <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Local, mutable storage owned by a single view. When it changes, the view re-renders.
              That&apos;s the whole story — and also the trap.
            </p>
          </Stack>

          {/* Placeholder mock — what the chrome looks like before a real source resolves. */}
          <figure className="video">
            <div className="video-frame" style={{ paddingTop: '56.25%' }}>
              <div className="video-frame-inner">
                <div className="video-placeholder">
                  <button type="button" className="video-play" aria-label="Play concept video">
                    <Icon name="play" size={28} />
                  </button>
                  <div className="video-meta">2:14 · Concept video placeholder</div>
                  <div className="video-scrubber">
                    <span>0:42</span>
                    <div className="bar bar-thin">
                      <div className="bar-fill" style={{ width: '32%' }} />
                    </div>
                    <span>2:14</span>
                  </div>
                </div>
              </div>
            </div>
          </figure>

          <Callout tone="brand" title="Key takeaways">
            <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.7 }}>
              <li><span className="mono peacock-text">@State</span> wraps a value type owned by a single view.</li>
              <li>Reading the value triggers the view to subscribe to changes.</li>
              <li>If multiple views need the same state, hoist it up — don&apos;t duplicate.</li>
            </ul>
          </Callout>

          <Stack gap="tight">
            <Eyebrow>YouTube source</Eyebrow>
            <Video
              url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              caption="2:14 · YouTube embed"
              title="Sample YouTube video"
            />
          </Stack>

          <Stack gap="tight">
            <Eyebrow>Direct .mp4 source</Eyebrow>
            <Video
              url="https://cdn.example.com/clips/peacock-intro.mp4"
              caption="0:30 · MP4 direct file"
              title="Sample MP4 video"
            />
          </Stack>
        </Stack>
      </Pane>

      <Pane title="Toast / ToastStack — badge unlock surface">
        <Stack gap="tight">
          <Row style={{ gap: 8 }}>
            <Button variant="primary" size="sm" onClick={() => setShowToast((v) => !v)}>
              {showToast ? 'Hide' : 'Reveal'} unlock toast
            </Button>
            <span className="muted" style={{ fontSize: 'var(--t-sm)' }}>Renders fixed top-right.</span>
          </Row>
          <Stack gap="tight" style={{ alignItems: 'flex-start' }}>
            <Toast tone="brand"   icon={<span style={{ fontSize: 'var(--t-xl)' }}>🦚</span>} title="Peacock streak" description="Badge unlocked" />
            <Toast tone="success" icon={<span style={{ fontSize: 'var(--t-xl)' }}>✅</span>} title="First steps" description="Badge unlocked" />
            <Toast tone="neutral" icon={<span style={{ fontSize: 'var(--t-xl)' }}>📘</span>} title="Bookworm" description="Badge unlocked" />
          </Stack>
        </Stack>
        {showToast && (
          <ToastStack position="top-right">
            <Toast tone="brand" visible icon={<span style={{ fontSize: 'var(--t-xl)' }}>🦚</span>} title="Peacock streak" description="Badge unlocked" />
          </ToastStack>
        )}
      </Pane>

      <Pane title="ExplanationBlock — markdown body">
        <ExplanationBlock
          markdown={`### Why \`@State\` is value-typed

SwiftUI views are **structs** — value types that get re-created on every render. \`@State\` survives those re-creations because the framework stores the value in a separate, view-specific allocation.

- The wrapped value behaves like a plain \`Int\` / \`Bool\` / \`String\`.
- Reading the value subscribes the view to changes.
- \`@State\` is for **local** state. Hoist with \`@Binding\` for cross-view sharing.

\`\`\`swift
struct Counter: View {
  @State private var count = 0
  var body: some View {
    Button("Tapped \\(count) times") { count += 1 }
  }
}
\`\`\`
`}
        />
      </Pane>

      <Pane title="VideoBlock — assembled lesson video block">
        <VideoBlock
          video={{
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            title: 'What does @State actually do?',
            description:
              'Local, mutable storage owned by a single view. When it changes, the view re-renders. That’s the whole story — and also the trap.',
            durationLabel: '2 MIN',
          }}
        />
      </Pane>

      <Pane title="MultipleChoiceExercise — single-select renderer">
        <MultipleChoiceExercise exercise={mcExercise()} />
      </Pane>

      <Pane title="FillBlankExercise — drag-and-drop token pool">
        <FillBlankExercise exercise={fillBlankExercise()} />
      </Pane>

      <Pane title="PredictOutputExercise — read code, type expected output">
        <PredictOutputExercise exercise={predictOutputExercise()} />
      </Pane>

      <Pane title="CodeExercise — live coding (handles both `code` and `fix_bug` payloads)">
        <Stack gap="loose">
          <Stack gap="tight">
            <Eyebrow>code variant</Eyebrow>
            <CodeExercise exercise={codeExercise()} />
          </Stack>
          <Stack gap="tight">
            <Eyebrow>fix_bug variant — same renderer, &quot;buggy&quot; badge + buggy filename</Eyebrow>
            <CodeExercise exercise={fixBugExercise()} />
          </Stack>
        </Stack>
      </Pane>

      <Pane title="CapstoneSubmissionExercise — instructor-graded milestone">
        <CapstoneSubmissionExercise exercise={capstoneExercise()} />
      </Pane>

      <Pane title="VisualPlaygroundExercise — build a UI piece, watch the code update live">
        <Stack gap="default">
          <Stack gap="tight">
            <Eyebrow>Visual playground</Eyebrow>
            <Heading level="h2">Build a button.</Heading>
            <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Tweak the modifiers on the right. Watch the SwiftUI code update in real time.
            </p>
          </Stack>
          <VisualPlaygroundExercise exercise={visualPlaygroundExercise()} />
        </Stack>
      </Pane>

      <Pane title="LessonCompleteScreen — regular variant">
        <LessonCompleteScreen
          variant="regular"
          hexStates={['first_try', 'first_try', 'eventual', 'first_try']}
          nextLessonId="lesson-bindings"
          onNextLesson={() => {}}
          onBackToTrack={() => {}}
        />
      </Pane>

      <Pane title="LessonCompleteScreen — pool_complete variant">
        <LessonCompleteScreen
          variant="pool_complete"
          hexStates={['first_try', 'first_try', 'eventual', 'first_try', 'first_try', 'eventual']}
          onFreshExercises={() => {}}
          onBackToTrack={() => {}}
        />
      </Pane>

      <Pane title="Lesson player chrome (assembled)">
        <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--line-2)' }}>
          {/* Header */}
          <div className="player-head" style={{ position: 'static' }}>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Icon name="chevL" size={14} />}
            >
              Back to track
            </Button>
            <div className="player-progress">
              <div className="row-between" style={{ marginBottom: 6 }}>
                <Eyebrow>Optionals · Lesson 4</Eyebrow>
                <span className="mono muted">3/6</span>
              </div>
              <div className="bar bar-thin">
                <div className="bar-fill" style={{ width: '50%' }} />
              </div>
            </div>
            <HexBar states={HEX_DEMO} />
          </div>
          {/* Body sample */}
          <div style={{ padding: 32, background: 'var(--bg-0)' }}>
            <Stack>
              <p style={{ margin: 0, color: 'var(--text-2)' }}>Pick the variant that compiles.</p>
              <Choice state="picked" keyLabel="A">An optional unwrapped with <code className="mono">if let</code></Choice>
              <Choice state="idle" keyLabel="B">A force-unwrapped optional with <code className="mono">!</code></Choice>
            </Stack>
          </div>
          {/* Footer */}
          <div className="player-foot" style={{ position: 'static' }}>
            <Button variant="ghost" leadingIcon={<Icon name="chevL" size={14} />}>Previous</Button>
            <StepDots total={totalSteps} current={step} />
            <Button variant="iridescent">
              <span className="btn-iridescent-label">Continue →</span>
            </Button>
          </div>
        </div>
      </Pane>
    </section>
  );
}

// ── Sample exercise fixtures ────────────────────────────────────────────────
// All renderers are driven by a single ExerciseDTO shape. These fixtures keep
// the showcase honest — every visual is the actual production renderer with
// representative data, not a parallel mock that can drift.

function mcExercise(): ExerciseDTO {
  return {
    id: 'demo-mc', version: 1, type: 'multiple_choice', pointsMax: 5,
    promptMarkdown: '',
    attemptStatus: 'unattempted',
    payload: {
      type: 'multiple_choice',
      questionMarkdown: 'Which keyword declares immutable storage in Swift?',
      options: [
        { id: 'a', text: '`var`' },
        { id: 'b', text: '`let`' },
        { id: 'c', text: '`const`' },
        { id: 'd', text: '`final`' },
      ],
      correctOptionIds: ['b'],
      multiSelect: false,
    },
  };
}

function fillBlankExercise(): ExerciseDTO {
  return {
    id: 'demo-fb', version: 1, type: 'fill_blank', pointsMax: 5,
    promptMarkdown: '',
    attemptStatus: 'unattempted',
    payload: {
      type: 'fill_blank', language: 'swift',
      template: '___1___ ___2___ isExpanded: ___3___ = false',
      blanks: [
        { id: '1', expected: ['@State'] },
        { id: '2', expected: ['private'] },
        { id: '3', expected: ['Bool'] },
      ],
      tokens: ['var', 'let', 'private', '@State', '@Binding', 'Bool', 'Int'],
    },
  };
}

function predictOutputExercise(): ExerciseDTO {
  return {
    id: 'demo-po', version: 1, type: 'predict_output', pointsMax: 5,
    promptMarkdown: '',
    attemptStatus: 'unattempted',
    payload: {
      type: 'predict_output',
      displayedLanguage: 'swift',
      displayedCode: `let xs = [1, 2, 3]
let doubled = xs.map { $0 * 2 }
print(doubled)`,
      expectedOutput: '[2, 4, 6]',
    },
  };
}

function codeExercise(): ExerciseDTO {
  return {
    id: 'demo-code', version: 1, type: 'code', pointsMax: 10,
    promptMarkdown: '',
    attemptStatus: 'unattempted',
    hints: [
      'Use string interpolation: \\(name) inserts the value into a string literal.',
      'Don\'t forget the trailing exclamation mark in the expected greeting.',
    ],
    payload: {
      type: 'code', language: 'swift',
      starterCode: `func greet(_ name: String) -> String {
  // Return "Hello, BootCamp!" using string interpolation.
  return ""
}

print(greet("BootCamp"))
`,
      testCode: '',
      testEntryPoint: 'greet',
    },
  };
}

function fixBugExercise(): ExerciseDTO {
  return {
    id: 'demo-fix', version: 1, type: 'fix_bug', pointsMax: 8,
    promptMarkdown: '',
    attemptStatus: 'unattempted',
    hints: ['Look at the closing brace on the recursive call.'],
    payload: {
      type: 'fix_bug', language: 'swift',
      brokenCode: `func factorial(_ n: Int) -> Int {
  if n <= 1 { return 1 }
  return n * factorial(n)   // bug: should be n - 1
}
`,
      testCode: '',
      testEntryPoint: 'factorial',
    },
  };
}

function capstoneExercise(): ExerciseDTO {
  return {
    id: 'demo-capstone', version: 1, type: 'capstone_submission', pointsMax: 100,
    promptMarkdown: '',
    attemptStatus: 'unattempted',
    payload: { type: 'capstone_submission' },
  };
}

function visualPlaygroundExercise(): ExerciseDTO {
  return {
    id: 'demo-playground', version: 1, type: 'visual_playground', pointsMax: 0,
    promptMarkdown: '',
    attemptStatus: 'unattempted',
    payload: {
      type: 'visual_playground',
      language: 'swift',
      primitive: 'button',
      controls: [
        { kind: 'text', id: 'label', label: 'Label', default: 'Tap me' },
        {
          kind: 'color', id: 'backgroundColor', label: 'Background',
          default: 'amber',
          options: [
            { id: 'peacock', cssColor: '#0aa6c4', codeRef: 'peacock', label: 'peacock' },
            { id: 'iris',    cssColor: '#f25cb6', codeRef: 'iris',    label: 'iris'    },
            { id: 'amber',   cssColor: '#ffae3d', codeRef: 'amber',   label: 'amber'   },
            { id: 'royal',   cssColor: '#4a64ee', codeRef: 'royal',   label: 'royal'   },
          ],
        },
        {
          kind: 'slider', id: 'cornerRadius', label: 'Corner radius',
          min: 0, max: 40, step: 1, unit: 'pt', default: 21,
        },
        { kind: 'toggle', id: 'shadow', label: 'Shadow', default: true },
      ],
    },
  };
}
