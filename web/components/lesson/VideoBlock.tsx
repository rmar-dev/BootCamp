import { Eyebrow, Heading, Stack, Video } from '@/components/ui';
import type { VideoBlockData } from '@/lib/exercise-payloads';

export function VideoBlock({ video }: { video: VideoBlockData }) {
  return (
    <Stack>
      {video.durationLabel && (
        <Eyebrow>Watch · {video.durationLabel}</Eyebrow>
      )}
      {video.title && <Heading level="h2">{video.title}</Heading>}
      {video.description && (
        <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: 1.6 }}>
          {video.description}
        </p>
      )}
      <Video
        url={video.url}
        title={video.title}
        posterUrl={video.posterUrl}
        caption={video.durationLabel ? video.durationLabel : undefined}
      />
    </Stack>
  );
}
