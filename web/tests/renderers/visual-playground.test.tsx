import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisualPlaygroundExercise } from '@/components/lesson/renderers/VisualPlaygroundExercise';
import {
  generateSwiftUiTokens,
  tokensToString,
} from '@/components/lesson/renderers/visual-playground/code-generator';
import type { ExerciseDTO, VisualPlaygroundPayload } from '@/lib/exercise-payloads';

function buttonPayload(): VisualPlaygroundPayload {
  return {
    type: 'visual_playground',
    language: 'swift',
    primitive: 'button',
    controls: [
      { kind: 'text', id: 'label', label: 'Label', default: 'Tap me' },
      {
        kind: 'color', id: 'backgroundColor', label: 'Background', default: 'amber',
        options: [
          { id: 'peacock', cssColor: '#0aa6c4', codeRef: 'peacock' },
          { id: 'amber',   cssColor: '#ffae3d', codeRef: 'amber'   },
          { id: 'iris',    cssColor: '#f25cb6', codeRef: 'iris'    },
        ],
      },
      { kind: 'slider', id: 'cornerRadius', label: 'Corner radius', min: 0, max: 40, step: 1, unit: 'pt', default: 21 },
      { kind: 'toggle', id: 'shadow', label: 'Shadow', default: true },
    ],
  };
}

function buttonExercise(): ExerciseDTO {
  return {
    id: 'demo', version: 1, type: 'visual_playground', pointsMax: 0,
    promptMarkdown: '', attemptStatus: 'unattempted',
    payload: buttonPayload(),
  };
}

// ── code generator (pure) ────────────────────────────────────────────────────

describe('generateSwiftUiTokens — button primitive', () => {
  it('emits the screenshot example with default state', () => {
    const tokens = generateSwiftUiTokens(buttonPayload(), {
      label: 'Tap me', backgroundColor: 'amber', cornerRadius: 21, shadow: true,
    });
    const text = tokensToString(tokens);
    expect(text).toContain('Button("Tap me") { }');
    expect(text).toContain('.padding(.horizontal, 28)');
    expect(text).toContain('.background(Color.amber)');
    expect(text).toContain('.cornerRadius(21)');
    expect(text).toContain('.shadow(radius: 8)');
  });

  it('omits the .shadow line when the shadow toggle is off', () => {
    const text = tokensToString(generateSwiftUiTokens(buttonPayload(), {
      label: 'Tap me', backgroundColor: 'amber', cornerRadius: 21, shadow: false,
    }));
    expect(text).not.toContain('.shadow');
  });

  it('reflects the label change in the code', () => {
    const text = tokensToString(generateSwiftUiTokens(buttonPayload(), {
      label: 'Hello!', backgroundColor: 'iris', cornerRadius: 8, shadow: false,
    }));
    expect(text).toContain('Button("Hello!")');
    expect(text).toContain('.background(Color.iris)');
    expect(text).toContain('.cornerRadius(8)');
  });

  it('falls back to the control default for any unset state field', () => {
    // Only label is set; background/radius/shadow should fall back to defaults.
    const text = tokensToString(generateSwiftUiTokens(buttonPayload(), {
      label: 'Default!',
    }));
    expect(text).toContain('"Default!"');
    expect(text).toContain('Color.amber');     // default
    expect(text).toContain('.cornerRadius(21)'); // default
    expect(text).toContain('.shadow(radius: 8)'); // default
  });

  it('uses each color option\'s codeRef (not its id) when emitting', () => {
    // Same id and codeRef in this fixture; verify the codeRef path is used.
    const payload = buttonPayload();
    (payload.controls[1] as { options: { id: string; cssColor: string; codeRef: string }[] }).options[1]
      .codeRef = 'orange';   // change the codeRef but keep id 'amber'
    const text = tokensToString(generateSwiftUiTokens(payload, {
      backgroundColor: 'amber',
    }));
    expect(text).toContain('Color.orange');
    expect(text).not.toContain('Color.amber');
  });
});

// ── renderer interaction ────────────────────────────────────────────────────

describe('VisualPlaygroundExercise', () => {
  // The generated code is rendered as a stream of token <span>s, so
  // testing-library's getByText (which doesn't cross element boundaries)
  // can't match. Read the <pre> element's textContent instead.
  function codeText(container: HTMLElement): string {
    const pre = container.querySelector('pre');
    return pre?.textContent ?? '';
  }

  it('renders the modifier panel and the live code', () => {
    const { container } = render(<VisualPlaygroundExercise exercise={buttonExercise()} />);
    expect(screen.getByText('Modifiers')).toBeInTheDocument();
    expect(screen.getByLabelText('Label')).toHaveValue('Tap me');
    expect(screen.getByLabelText('Background')).toBeInTheDocument();
    expect(screen.getByLabelText('Corner radius')).toBeInTheDocument();
    expect(codeText(container)).toContain('Button("Tap me") { }');
  });

  it('updates the label in the live code as the input changes', async () => {
    const user = userEvent.setup();
    const { container } = render(<VisualPlaygroundExercise exercise={buttonExercise()} />);
    const input = screen.getByLabelText('Label');
    await user.clear(input);
    await user.type(input, 'Hello');
    expect(codeText(container)).toContain('Button("Hello")');
  });

  it('updates the background color when a swatch is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<VisualPlaygroundExercise exercise={buttonExercise()} />);
    // The fixture starts with `amber` selected; click peacock.
    await user.click(screen.getByRole('radio', { name: /peacock/i }));
    expect(codeText(container)).toContain('Color.peacock');
    expect(codeText(container)).not.toContain('Color.amber');
  });

  it('omits .shadow from the code when the toggle is turned off', async () => {
    const user = userEvent.setup();
    const { container } = render(<VisualPlaygroundExercise exercise={buttonExercise()} />);
    expect(codeText(container)).toContain('.shadow(radius: 8)');
    await user.click(screen.getByRole('switch', { name: /shadow/i }));
    expect(codeText(container)).not.toContain('.shadow');
  });

  it('shows the LIVE badge in the code frame header', () => {
    render(<VisualPlaygroundExercise exercise={buttonExercise()} />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });
});
