import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DifficultyBaseline, HelpRequestStatus, UserRole } from '@prisma/client';
import { StudentsService } from '../../src/students/students.service';

describe('StudentsService', () => {
  function buildDeps() {
    return {
      students: {
        findById: jest.fn(),
        findByInstructor: jest.fn(),
        findUnassigned: jest.fn(),
        assignInstructor: jest.fn(),
        setLanguage: jest.fn(),
      },
      difficulty: { getOrDefault: jest.fn() },
      overrides: { findByStudent: jest.fn() },
      help: { findInbox: jest.fn(), findByStudent: jest.fn() },
      users: { findById: jest.fn() },
      enrollments: { listByStudent: jest.fn().mockResolvedValue([]) },
      tracks: { findByVersion: jest.fn() },
      skillTrees: {
        getAssignmentWithTree: jest.fn().mockResolvedValue(null),
        listVisibleForUser: jest.fn().mockResolvedValue([]),
        getStudentOverride: jest.fn().mockResolvedValue(null),
      },
    };
  }
  function build() {
    const d = buildDeps();
    const svc = new StudentsService(
      d.students as any,
      d.difficulty as any,
      d.overrides as any,
      d.enrollments as any,
      d.tracks as any,
      d.skillTrees as any,
      d.help as any,
      d.users as any,
    );
    return { svc, ...d };
  }

  // ── getRoster ───────────────────────────────────────────────────────────
  describe('getRoster', () => {
    it('attaches openHelpRequestCount per student (filtered by status)', async () => {
      const { svc, students, help } = build();
      students.findByInstructor.mockResolvedValueOnce([
        { id: 's1', name: 'A' },
        { id: 's2', name: 'B' },
      ]);
      help.findInbox.mockResolvedValue([
        { studentId: 's1', status: HelpRequestStatus.open },
        { studentId: 's1', status: HelpRequestStatus.answered },
        { studentId: 's1', status: HelpRequestStatus.resolved }, // excluded
        { studentId: 's2', status: HelpRequestStatus.open },
      ]);
      const r = await svc.getRoster('inst-1');
      expect(r).toEqual([
        expect.objectContaining({ id: 's1', openHelpRequestCount: 2 }),
        expect.objectContaining({ id: 's2', openHelpRequestCount: 1 }),
      ]);
    });
  });

  // ── assign ──────────────────────────────────────────────────────────────
  describe('assign', () => {
    it('admin can reassign anyone to anyone', async () => {
      const { svc, students, users } = build();
      users.findById.mockResolvedValueOnce({ id: 'inst-2', role: UserRole.instructor });
      students.findById.mockResolvedValueOnce({ id: 's1', instructorId: 'inst-1' });
      students.assignInstructor.mockResolvedValueOnce({ id: 's1', instructorId: 'inst-2' });
      const r = await svc.assign('s1', 'inst-2', 'admin-u', 'admin');
      expect(r.instructorId).toBe('inst-2');
      expect(students.assignInstructor).toHaveBeenCalledWith('s1', 'inst-2');
    });

    it('admin can clear assignment (target null)', async () => {
      const { svc, students } = build();
      students.findById.mockResolvedValueOnce({ id: 's1', instructorId: 'inst-1' });
      students.assignInstructor.mockResolvedValueOnce({ id: 's1', instructorId: null });
      await svc.assign('s1', null, 'admin-u', 'admin');
      expect(students.assignInstructor).toHaveBeenCalledWith('s1', null);
    });

    it('instructor can self-claim an unassigned student', async () => {
      const { svc, students, users } = build();
      users.findById.mockResolvedValueOnce({ id: 'inst-1', role: UserRole.instructor });
      students.findById.mockResolvedValueOnce({ id: 's1', instructorId: null });
      students.assignInstructor.mockResolvedValueOnce({ id: 's1', instructorId: 'inst-1' });
      const r = await svc.assign('s1', 'inst-1', 'inst-1', 'instructor');
      expect(r.instructorId).toBe('inst-1');
    });

    it('instructor cannot claim a student already assigned to someone else', async () => {
      const { svc, students, users } = build();
      users.findById.mockResolvedValueOnce({ id: 'inst-1', role: UserRole.instructor });
      students.findById.mockResolvedValueOnce({ id: 's1', instructorId: 'inst-2' });
      await expect(
        svc.assign('s1', 'inst-1', 'inst-1', 'instructor'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('instructor can release their own student (target null)', async () => {
      const { svc, students } = build();
      students.findById.mockResolvedValueOnce({ id: 's1', instructorId: 'inst-1' });
      students.assignInstructor.mockResolvedValueOnce({ id: 's1', instructorId: null });
      const r = await svc.assign('s1', null, 'inst-1', 'instructor');
      expect(r.instructorId).toBeNull();
    });

    it('instructor cannot release someone else\'s student', async () => {
      const { svc, students } = build();
      students.findById.mockResolvedValueOnce({ id: 's1', instructorId: 'inst-2' });
      await expect(svc.assign('s1', null, 'inst-1', 'instructor')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects with BadRequest when target user does not exist', async () => {
      const { svc, users } = build();
      users.findById.mockResolvedValueOnce(null);
      await expect(
        svc.assign('s1', 'unknown-user', 'admin-u', 'admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects with BadRequest when target user is a student (not an instructor / admin)', async () => {
      const { svc, users } = build();
      users.findById.mockResolvedValueOnce({ id: 'student-u', role: UserRole.student });
      await expect(
        svc.assign('s1', 'student-u', 'admin-u', 'admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound when the studentId is unknown', async () => {
      const { svc, students, users } = build();
      users.findById.mockResolvedValueOnce({ id: 'inst-1', role: UserRole.instructor });
      students.findById.mockResolvedValueOnce(null);
      await expect(
        svc.assign('missing', 'inst-1', 'admin-u', 'admin'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── setLanguage ─────────────────────────────────────────────────────────
  describe('setLanguage', () => {
    it('assigned instructor can set language', async () => {
      const { svc, students } = build();
      students.findById.mockResolvedValueOnce({ id: 's1', instructorId: 'inst-1' });
      students.setLanguage.mockResolvedValueOnce({ id: 's1', language: 'swift' });
      const r = await svc.setLanguage('s1', 'swift', { userId: 'inst-1', role: 'instructor' });
      expect(students.setLanguage).toHaveBeenCalledWith('s1', 'swift');
      expect(r.language).toBe('swift');
    });

    it('admin can set language for any student', async () => {
      const { svc, students } = build();
      students.findById.mockResolvedValueOnce({ id: 's1', instructorId: 'inst-2' });
      students.setLanguage.mockResolvedValueOnce({ id: 's1', language: 'kotlin' });
      const r = await svc.setLanguage('s1', 'kotlin', { userId: 'admin-u', role: 'admin' });
      expect(r.language).toBe('kotlin');
    });

    it('null clears the language', async () => {
      const { svc, students } = build();
      students.findById.mockResolvedValueOnce({ id: 's1', instructorId: 'inst-1' });
      students.setLanguage.mockResolvedValueOnce({ id: 's1', language: null });
      await svc.setLanguage('s1', null, { userId: 'inst-1', role: 'instructor' });
      expect(students.setLanguage).toHaveBeenCalledWith('s1', null);
    });

    it('forbids instructors who are not assigned to the student', async () => {
      const { svc, students } = build();
      students.findById.mockResolvedValueOnce({ id: 's1', instructorId: 'inst-other' });
      await expect(
        svc.setLanguage('s1', 'swift', { userId: 'inst-1', role: 'instructor' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFound when student does not exist', async () => {
      const { svc, students } = build();
      students.findById.mockResolvedValueOnce(null);
      await expect(
        svc.setLanguage('missing', 'swift', { userId: 'inst-1', role: 'instructor' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── getDetail ───────────────────────────────────────────────────────────
  describe('getDetail', () => {
    it('composes student + difficulty + overrides + open-help-count', async () => {
      const { svc, students, difficulty, overrides, help } = build();
      const student = { id: 's1', cohortId: 'c1', instructorId: 'inst-1' };
      students.findById.mockResolvedValueOnce(student);
      difficulty.getOrDefault.mockResolvedValueOnce(DifficultyBaseline.easy);
      overrides.findByStudent.mockResolvedValueOnce([{ exerciseId: 'ex-1', extendTimeMs: 60_000 }]);
      help.findByStudent.mockResolvedValueOnce([
        { status: HelpRequestStatus.open },
        { status: HelpRequestStatus.answered },
        { status: HelpRequestStatus.resolved }, // excluded
      ]);
      const r = await svc.getDetail('s1', { userId: 'inst-1', role: 'instructor' });
      expect(r.student).toBe(student);
      expect(r.cohortId).toBe('c1');
      expect(r.difficultyBaseline).toBe(DifficultyBaseline.easy);
      expect(r.examOverrides).toHaveLength(1);
      expect(r.openHelpRequestCount).toBe(2);
      expect(r.tracks).toEqual([]);
    });

    it('throws NotFound when student does not exist', async () => {
      const { svc, students } = build();
      students.findById.mockResolvedValueOnce(null);
      await expect(
        svc.getDetail('missing', { userId: 'inst-1', role: 'instructor' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Forbidden when caller is not the assigned instructor', async () => {
      const { svc, students } = build();
      students.findById.mockResolvedValueOnce({
        id: 's1',
        cohortId: 'c1',
        instructorId: 'inst-other',
      });
      await expect(
        svc.getDetail('s1', { userId: 'inst-1', role: 'instructor' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('admin can see any student detail', async () => {
      const { svc, students, difficulty, overrides, help } = build();
      students.findById.mockResolvedValueOnce({
        id: 's1', cohortId: null, instructorId: 'inst-x',
      });
      difficulty.getOrDefault.mockResolvedValueOnce(DifficultyBaseline.standard);
      overrides.findByStudent.mockResolvedValueOnce([]);
      help.findByStudent.mockResolvedValueOnce([]);
      const r = await svc.getDetail('s1', { userId: 'admin-u', role: 'admin' });
      expect(r.cohortId).toBeNull();
    });

    it('composes per-track skill-tree context for enrolled tracks', async () => {
      const { svc, students, difficulty, overrides, help, enrollments, tracks, skillTrees } = build();
      students.findById.mockResolvedValueOnce({
        id: 's1', cohortId: 'c1', instructorId: 'inst-1',
      });
      difficulty.getOrDefault.mockResolvedValueOnce(DifficultyBaseline.standard);
      overrides.findByStudent.mockResolvedValueOnce([]);
      help.findByStudent.mockResolvedValueOnce([]);
      enrollments.listByStudent.mockResolvedValueOnce([
        { trackId: 't1', trackVersion: 1 },
      ]);
      tracks.findByVersion.mockResolvedValueOnce({
        id: 't1', version: 1, title: 'Swift Fundamentals', language: 'swift',
      });
      skillTrees.getAssignmentWithTree.mockResolvedValueOnce({
        skillTree: { id: 'tree-1', name: 'Linear path' },
      });
      skillTrees.listVisibleForUser.mockResolvedValueOnce([
        { id: 'tree-1', name: 'Linear path', visibility: 'private', authorUserId: 'inst-1' },
        { id: 'tree-2', name: 'Fast track', visibility: 'public', authorUserId: 'inst-2' },
      ]);
      const r = await svc.getDetail('s1', { userId: 'inst-1', role: 'instructor' });
      expect(r.tracks).toHaveLength(1);
      expect(r.tracks[0].trackTitle).toBe('Swift Fundamentals');
      expect(r.tracks[0].activeSkillTree).toEqual({ id: 'tree-1', name: 'Linear path' });
      expect(r.tracks[0].availableTrees).toHaveLength(2);
    });
  });
});
