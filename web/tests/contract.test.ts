import { describe, it, expect } from 'vitest';
import { lessonSchema } from '@/lib/exercise-payloads.zod';

const SEED_LESSON_ID = '22222222-2222-4222-8222-222222222222';
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

describe('contract: live lesson API', () => {
  it('seeded lesson parses against web Zod schema', async () => {
    let res: Response;
    try {
      res = await fetch(`${BASE}/api/lessons/${SEED_LESSON_ID}`);
    } catch {
      throw new Error(
        `Could not reach ${BASE}. Start the platform server (npm run start) and run the seed (npm run seed) before running this test.`,
      );
    }
    expect(res.status).toBe(200);
    const json = await res.json();
    const parsed = lessonSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error('Lesson contract drift: ' + JSON.stringify(parsed.error.issues, null, 2));
    }
    expect(parsed.data.title).toBe('Hello BootCamp');
    expect(parsed.data.blocks).toHaveLength(7);
  });
});
