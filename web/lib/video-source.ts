/**
 * Multi-source video URL → embed strategy.
 *
 * Resolves a single human-friendly URL (a YouTube watch link, a Vimeo URL, a
 * direct .mp4 file, etc.) into a strategy the Video primitive can render.
 * Pure, runtime-agnostic, easy to unit test.
 */

export type VideoSource =
  | { kind: 'youtube'; videoId: string; embedUrl: string }
  | { kind: 'vimeo'; videoId: string; embedUrl: string }
  | { kind: 'loom'; videoId: string; embedUrl: string }
  | { kind: 'file'; url: string; mimeType: string }
  | { kind: 'iframe'; url: string };

const FILE_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogg: 'video/ogg',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
};

/** Resolve a URL to a video source, or `null` if it's not a usable URL. */
export function resolveVideoSource(rawUrl: string): VideoSource | null {
  const url = rawUrl.trim();
  if (!url) return null;

  const yt = parseYouTubeId(url);
  if (yt) {
    return {
      kind: 'youtube',
      videoId: yt,
      embedUrl: `https://www.youtube.com/embed/${yt}?rel=0&modestbranding=1`,
    };
  }

  const vm = parseVimeoId(url);
  if (vm) {
    return {
      kind: 'vimeo',
      videoId: vm,
      embedUrl: `https://player.vimeo.com/video/${vm}`,
    };
  }

  const lm = parseLoomId(url);
  if (lm) {
    return {
      kind: 'loom',
      videoId: lm,
      embedUrl: `https://www.loom.com/embed/${lm}`,
    };
  }

  const fileMime = detectFileMime(url);
  if (fileMime) return { kind: 'file', url, mimeType: fileMime };

  if (/^https?:\/\//i.test(url)) return { kind: 'iframe', url };

  return null;
}

/** Extract a YouTube video id from any of the standard URL shapes. */
export function parseYouTubeId(url: string): string | null {
  // youtu.be/<id>
  const short = /(?:^|\/\/)(?:www\.)?youtu\.be\/([\w-]{6,})/i.exec(url);
  if (short) return short[1];

  // youtube.com/watch?v=<id>
  const watch = /[?&]v=([\w-]{6,})/i.exec(url);
  if (/youtube\.com\/watch/i.test(url) && watch) return watch[1];

  // youtube.com/embed/<id> or shorts/<id>
  const embed = /youtube\.com\/(?:embed|shorts|live)\/([\w-]{6,})/i.exec(url);
  if (embed) return embed[1];

  return null;
}

/** Extract a Vimeo numeric id. */
export function parseVimeoId(url: string): string | null {
  // vimeo.com/<id> or player.vimeo.com/video/<id>
  const m = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(url);
  return m ? m[1] : null;
}

/** Extract a Loom share id. */
export function parseLoomId(url: string): string | null {
  const m = /loom\.com\/(?:share|embed)\/([\w-]+)/i.exec(url);
  return m ? m[1] : null;
}

/** Inspect the URL's path extension and return a video MIME type, if any. */
export function detectFileMime(url: string): string | null {
  // Strip any query string / hash before reading the extension.
  const path = url.split(/[?#]/, 1)[0];
  const dot = path.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = path.slice(dot + 1).toLowerCase();
  return FILE_MIME[ext] ?? null;
}
