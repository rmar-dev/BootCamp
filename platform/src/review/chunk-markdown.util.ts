// src/review/chunk-markdown.util.ts
export function chunkMarkdown(text: string, size: number): string[] {
  if (size < 1) throw new Error('chunkMarkdown size must be >= 1');
  if (text.length === 0) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}
