import { createHash, randomBytes } from 'crypto';

/** 32 random bytes as lowercase hex (64 chars). This is the raw magic-link token. */
export function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
}

/** SHA-256 of the raw token, lowercase hex. Only this is stored at rest. */
export function hashInviteToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
