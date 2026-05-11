export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 0).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}
