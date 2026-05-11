import { v5 as uuid5 } from 'uuid';
import { createHash } from 'crypto';

// Fixed namespace UUID for BootCamp curriculum
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function stableId(path: string): string {
  return uuid5(path, NAMESPACE);
}

// Canonicalize an arbitrary JSON value so equivalent inputs produce identical
// strings. Recursively sorts object keys; arrays preserve order. Used by
// contentHash to fingerprint exercise / lesson payloads — any nested change
// (e.g. starterCode body, blanks list) must affect the hash.
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = canonicalize((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}

export function contentHash(content: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(content))).digest('hex');
}
