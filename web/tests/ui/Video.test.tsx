import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Video } from '@/components/ui';

describe('Video primitive', () => {
  it('renders a YouTube embed iframe with the right embed URL', () => {
    render(<Video url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Greeter intro" />);
    const iframe = screen.getByTitle('Greeter intro') as HTMLIFrameElement;
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.src).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1');
  });

  it('renders a Vimeo player iframe with the player.vimeo URL', () => {
    render(<Video url="https://vimeo.com/76979871" title="Demo" />);
    const iframe = screen.getByTitle('Demo') as HTMLIFrameElement;
    expect(iframe.src).toBe('https://player.vimeo.com/video/76979871');
  });

  it('renders a Loom embed iframe', () => {
    render(<Video url="https://loom.com/share/abc-123" title="Walkthrough" />);
    const iframe = screen.getByTitle('Walkthrough') as HTMLIFrameElement;
    expect(iframe.src).toBe('https://www.loom.com/embed/abc-123');
  });

  it('renders a native <video> with a typed <source> for direct file URLs', () => {
    const { container } = render(
      <Video url="https://cdn.example.com/clip.mp4" posterUrl="https://cdn.example.com/poster.jpg" />,
    );
    const videoEl = container.querySelector('video');
    expect(videoEl).toBeInTheDocument();
    expect(videoEl).toHaveAttribute('controls');
    expect(videoEl).toHaveAttribute('poster', 'https://cdn.example.com/poster.jpg');
    const source = videoEl?.querySelector('source');
    expect(source).toHaveAttribute('src', 'https://cdn.example.com/clip.mp4');
    expect(source).toHaveAttribute('type', 'video/mp4');
  });

  it('falls back to a generic iframe for any other http(s) URL', () => {
    render(<Video url="https://wistia.com/medias/abc" />);
    const iframe = document.querySelector('iframe.video-iframe') as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.src).toBe('https://wistia.com/medias/abc');
  });

  it('renders a fallback message when no source can be resolved', () => {
    render(<Video url="not a url" />);
    expect(screen.getByText(/no video source could be resolved/i)).toBeInTheDocument();
  });

  it('renders a caption below the player when provided', () => {
    render(
      <Video
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        caption="2:14 · Concept video"
      />,
    );
    expect(screen.getByText('2:14 · Concept video')).toBeInTheDocument();
  });

  it('respects a custom aspect ratio', () => {
    const { container } = render(
      <Video url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" aspectRatio={4 / 3} />,
    );
    const frame = container.querySelector('.video-frame') as HTMLElement;
    // 4:3 ratio → padding-top = 75%
    expect(frame.style.paddingTop).toBe('75%');
  });
});
