import { generateInviteToken, hashInviteToken } from '../../src/invitations/invitation.token';

describe('invitation.token', () => {
  it('generates a 64-char hex token', () => {
    const t = generateInviteToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates a different token each call', () => {
    expect(generateInviteToken()).not.toBe(generateInviteToken());
  });

  it('hashes deterministically (same input -> same hash)', () => {
    expect(hashInviteToken('abc')).toBe(hashInviteToken('abc'));
  });

  it('produces a 64-char hex sha256 hash that differs from the raw token', () => {
    const t = generateInviteToken();
    const h = hashInviteToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(t);
  });
});
