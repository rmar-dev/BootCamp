import { useMemo, type ReactNode } from 'react';
import { cn } from './cn';
import { resolveVideoSource, type VideoSource } from '@/lib/video-source';

export interface VideoProps {
  /** Canonical URL: a YouTube watch URL, Vimeo URL, Loom share URL, direct .mp4, or any embeddable iframe URL. */
  url: string;
  /** Optional caption rendered below the player ("2:14 · Concept video"). */
  caption?: ReactNode;
  /** Aspect ratio override. Defaults to 16:9. */
  aspectRatio?: number;
  /** Optional poster image for native <video> sources. */
  posterUrl?: string;
  /** Native player only: autoplay, muted by default per browser policy. */
  autoPlay?: boolean;
  className?: string;
  /** Accessible title forwarded to the embed iframe (required by most embed providers). */
  title?: string;
}

export function Video({
  url,
  caption,
  aspectRatio = 16 / 9,
  posterUrl,
  autoPlay,
  className,
  title,
}: VideoProps) {
  const source = useMemo(() => resolveVideoSource(url), [url]);
  const paddingTop = `${(1 / aspectRatio) * 100}%`;

  return (
    <figure className={cn('video', className)}>
      <div className="video-frame" style={{ paddingTop }}>
        <div className="video-frame-inner">
          {source ? (
            renderSource(source, { posterUrl, autoPlay, title })
          ) : (
            <div className="video-fallback">
              <span>No video source could be resolved for this URL.</span>
            </div>
          )}
        </div>
      </div>
      {caption && <figcaption className="video-caption">{caption}</figcaption>}
    </figure>
  );
}

function renderSource(
  source: VideoSource,
  opts: { posterUrl?: string; autoPlay?: boolean; title?: string },
) {
  switch (source.kind) {
    case 'youtube':
    case 'vimeo':
    case 'loom':
    case 'iframe':
      return (
        <iframe
          className="video-iframe"
          src={'embedUrl' in source ? source.embedUrl : source.url}
          title={opts.title ?? labelFor(source)}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      );
    case 'file':
      return (
        <video
          className="video-native"
          controls
          preload="metadata"
          poster={opts.posterUrl}
          autoPlay={opts.autoPlay}
          muted={opts.autoPlay}
          playsInline
        >
          <source src={source.url} type={source.mimeType} />
        </video>
      );
  }
}

function labelFor(source: VideoSource): string {
  switch (source.kind) {
    case 'youtube': return 'YouTube video player';
    case 'vimeo':   return 'Vimeo video player';
    case 'loom':    return 'Loom video player';
    case 'iframe':  return 'Embedded video';
    case 'file':    return 'Video';
  }
}
