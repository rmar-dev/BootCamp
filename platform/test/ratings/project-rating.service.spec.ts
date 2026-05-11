import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRatingService } from '../../src/ratings/project-rating.service';

describe('ProjectRatingService', () => {
  function buildRepo() {
    return {
      upsert: jest.fn(),
      findByAttempt: jest.fn(),
      findById: jest.fn(),
      remove: jest.fn(),
    };
  }
  function build() {
    const repo = buildRepo();
    const svc = new ProjectRatingService(repo as any);
    return { svc, repo };
  }

  // ── upsert ──────────────────────────────────────────────────────────────
  describe('upsert', () => {
    it('forwards a valid input to the repo', async () => {
      const { svc, repo } = build();
      repo.upsert.mockResolvedValueOnce({ id: 'r1' });
      const r = await svc.upsert({
        raterUserId: 'u1',
        attemptId: 'a1',
        score: 4,
        comment: '  nice work  ',
      });
      expect(r).toEqual({ id: 'r1' });
      expect(repo.upsert).toHaveBeenCalledWith({
        attemptId: 'a1',
        raterUserId: 'u1',
        score: 4,
        comment: 'nice work',
      });
    });

    it.each([
      [0, 'below range'],
      [6, 'above range'],
      [3.5, 'non-integer'],
      [Number.NaN, 'NaN'],
    ])('rejects score %p (%s) with BadRequest', async (score) => {
      const { svc, repo } = build();
      await expect(
        svc.upsert({ raterUserId: 'u1', attemptId: 'a1', score, comment: 'hi' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('rejects empty comment (after trim) with BadRequest', async () => {
      const { svc, repo } = build();
      await expect(
        svc.upsert({ raterUserId: 'u1', attemptId: 'a1', score: 5, comment: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('rejects comment exceeding 4000 characters', async () => {
      const { svc } = build();
      await expect(
        svc.upsert({
          raterUserId: 'u1',
          attemptId: 'a1',
          score: 5,
          comment: 'x'.repeat(4001),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts boundary score values 1 and 5', async () => {
      const { svc, repo } = build();
      repo.upsert.mockResolvedValue({ id: 'r1' });
      await svc.upsert({ raterUserId: 'u', attemptId: 'a', score: 1, comment: 'x' });
      await svc.upsert({ raterUserId: 'u', attemptId: 'a', score: 5, comment: 'x' });
      expect(repo.upsert).toHaveBeenCalledTimes(2);
    });
  });

  // ── getForAttempt ───────────────────────────────────────────────────────
  describe('getForAttempt', () => {
    it('forwards to the repo', async () => {
      const { svc, repo } = build();
      const rows = [{ id: 'r1' }, { id: 'r2' }];
      repo.findByAttempt.mockResolvedValueOnce(rows);
      const r = await svc.getForAttempt('a1');
      expect(r).toBe(rows);
      expect(repo.findByAttempt).toHaveBeenCalledWith('a1');
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────
  describe('remove', () => {
    it("allows the rater to delete their own rating", async () => {
      const { svc, repo } = build();
      repo.findById.mockResolvedValueOnce({ id: 'r1', raterUserId: 'u1' });
      await svc.remove('r1', 'u1', 'instructor');
      expect(repo.remove).toHaveBeenCalledWith('r1');
    });

    it('allows admin to delete any rating', async () => {
      const { svc, repo } = build();
      repo.findById.mockResolvedValueOnce({ id: 'r1', raterUserId: 'u1' });
      await svc.remove('r1', 'admin-u', 'admin');
      expect(repo.remove).toHaveBeenCalledWith('r1');
    });

    it('rejects another instructor trying to delete with Forbidden', async () => {
      const { svc, repo } = build();
      repo.findById.mockResolvedValueOnce({ id: 'r1', raterUserId: 'u1' });
      await expect(svc.remove('r1', 'u2', 'instructor')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('throws NotFound when the rating id is unknown', async () => {
      const { svc, repo } = build();
      repo.findById.mockResolvedValueOnce(null);
      await expect(svc.remove('missing', 'u', 'admin')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
