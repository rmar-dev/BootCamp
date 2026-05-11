import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { HelpAnchorKind, HelpRequestStatus } from '@prisma/client';
import { HelpRequestService } from '../../src/help/help-request.service';

// Pure unit suite — every collaborator mocked. The State / Help / Auth
// integration plays out at the controller-spec level; this file guards
// the service's authorization, validation, and state-machine behavior.

describe('HelpRequestService', () => {
  // ── helpers ─────────────────────────────────────────────────────────────
  function buildRepo() {
    return {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdWithMessages: jest.fn(),
      findInbox: jest.fn(),
      findByStudent: jest.fn(),
      setStatus: jest.fn(),
      appendMessage: jest.fn(),
    };
  }
  function buildStudents() {
    return { findByUserId: jest.fn() };
  }
  function build() {
    const repo = buildRepo();
    const students = buildStudents();
    const svc = new HelpRequestService(repo as any, students as any);
    return { svc, repo, students };
  }

  // ── createForStudent ────────────────────────────────────────────────────
  describe('createForStudent', () => {
    const baseInput = {
      studentUserId: 'user-1',
      anchorKind: HelpAnchorKind.lesson,
      anchorId: 'lesson-1',
      title: 'Stuck on lesson',
      body: 'I do not get the closure capture rules',
    };

    it('creates a request + opening message with instructorId from Student.instructorId', async () => {
      const { svc, repo, students } = build();
      students.findByUserId.mockResolvedValueOnce({ id: 'student-1', instructorId: 'inst-1' });
      repo.create.mockResolvedValueOnce({ id: 'req-1' });
      repo.appendMessage.mockResolvedValueOnce({});
      repo.findByIdWithMessages.mockResolvedValueOnce({ id: 'req-1', messages: [] });

      await svc.createForStudent(baseInput);

      expect(repo.create).toHaveBeenCalledWith({
        studentId: 'student-1',
        instructorId: 'inst-1',
        anchorKind: HelpAnchorKind.lesson,
        anchorId: 'lesson-1',
        title: 'Stuck on lesson',
      });
      expect(repo.appendMessage).toHaveBeenCalledWith({
        helpRequestId: 'req-1',
        authorId: 'user-1',
        body: 'I do not get the closure capture rules',
      });
    });

    it('rejects with BadRequest when the user has no Student record', async () => {
      const { svc, students } = build();
      students.findByUserId.mockResolvedValueOnce(null);
      await expect(svc.createForStudent(baseInput)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects with BadRequest when the student has no assigned instructor', async () => {
      const { svc, students } = build();
      students.findByUserId.mockResolvedValueOnce({ id: 'student-1', instructorId: null });
      await expect(svc.createForStudent(baseInput)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects with BadRequest when title is empty (after trim)', async () => {
      const { svc, students } = build();
      students.findByUserId.mockResolvedValueOnce({ id: 'student-1', instructorId: 'inst-1' });
      await expect(
        svc.createForStudent({ ...baseInput, title: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects with BadRequest when title exceeds 200 chars', async () => {
      const { svc, students } = build();
      students.findByUserId.mockResolvedValueOnce({ id: 'student-1', instructorId: 'inst-1' });
      await expect(
        svc.createForStudent({ ...baseInput, title: 'x'.repeat(201) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects with BadRequest when body is empty', async () => {
      const { svc, students } = build();
      students.findByUserId.mockResolvedValueOnce({ id: 'student-1', instructorId: 'inst-1' });
      await expect(
        svc.createForStudent({ ...baseInput, body: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── getThread ───────────────────────────────────────────────────────────
  describe('getThread', () => {
    it('returns the thread when caller is the assigned instructor', async () => {
      const { svc, repo } = build();
      const r = { id: 'r1', instructorId: 'inst-1', studentId: 's1', messages: [] };
      repo.findByIdWithMessages.mockResolvedValueOnce(r);
      await expect(svc.getThread('r1', 'inst-1', 'instructor')).resolves.toBe(r);
    });

    it('returns the thread when caller is admin (regardless of assignment)', async () => {
      const { svc, repo } = build();
      const r = { id: 'r1', instructorId: 'inst-1', studentId: 's1', messages: [] };
      repo.findByIdWithMessages.mockResolvedValueOnce(r);
      await expect(svc.getThread('r1', 'admin-9', 'admin')).resolves.toBe(r);
    });

    it('returns the thread when caller is the owning student', async () => {
      const { svc, repo, students } = build();
      const r = { id: 'r1', instructorId: 'inst-1', studentId: 's1', messages: [] };
      repo.findByIdWithMessages.mockResolvedValueOnce(r);
      students.findByUserId.mockResolvedValueOnce({ id: 's1' });
      await expect(svc.getThread('r1', 'student-user', 'student')).resolves.toBe(r);
    });

    it('throws Forbidden when caller is a different student', async () => {
      const { svc, repo, students } = build();
      const r = { id: 'r1', instructorId: 'inst-1', studentId: 's1', messages: [] };
      repo.findByIdWithMessages.mockResolvedValueOnce(r);
      students.findByUserId.mockResolvedValueOnce({ id: 's2' }); // a different student
      await expect(svc.getThread('r1', 'other-user', 'student')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws NotFound when the request id is unknown', async () => {
      const { svc, repo } = build();
      repo.findByIdWithMessages.mockResolvedValueOnce(null);
      await expect(svc.getThread('missing', 'u', 'instructor')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── appendReply ─────────────────────────────────────────────────────────
  describe('appendReply', () => {
    it("transitions open → answered when the instructor replies first", async () => {
      const { svc, repo } = build();
      repo.findById.mockResolvedValueOnce({
        id: 'r1',
        instructorId: 'inst-1',
        studentId: 's1',
        status: HelpRequestStatus.open,
      });
      repo.appendMessage.mockResolvedValueOnce({ id: 'm1' });
      repo.setStatus.mockResolvedValueOnce({});
      await svc.appendReply('r1', 'inst-1', 'instructor', 'looking now');
      expect(repo.setStatus).toHaveBeenCalledWith('r1', HelpRequestStatus.answered);
    });

    it('transitions answered → open when the student replies', async () => {
      const { svc, repo, students } = build();
      repo.findById.mockResolvedValueOnce({
        id: 'r1',
        instructorId: 'inst-1',
        studentId: 's1',
        status: HelpRequestStatus.answered,
      });
      students.findByUserId.mockResolvedValueOnce({ id: 's1' });
      repo.appendMessage.mockResolvedValueOnce({ id: 'm2' });
      repo.setStatus.mockResolvedValueOnce({});
      await svc.appendReply('r1', 'student-user', 'student', 'still confused');
      expect(repo.setStatus).toHaveBeenCalledWith('r1', HelpRequestStatus.open);
    });

    it('does NOT transition status when the student replies on an open thread', async () => {
      const { svc, repo, students } = build();
      repo.findById.mockResolvedValueOnce({
        id: 'r1',
        instructorId: 'inst-1',
        studentId: 's1',
        status: HelpRequestStatus.open,
      });
      students.findByUserId.mockResolvedValueOnce({ id: 's1' });
      repo.appendMessage.mockResolvedValueOnce({ id: 'm3' });
      await svc.appendReply('r1', 'student-user', 'student', 'one more thing');
      expect(repo.setStatus).not.toHaveBeenCalled();
    });

    it('rejects an empty body with BadRequest before touching the repo', async () => {
      const { svc, repo } = build();
      await expect(svc.appendReply('r1', 'u', 'instructor', '   ')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('throws Forbidden when caller is unrelated to the request', async () => {
      const { svc, repo, students } = build();
      repo.findById.mockResolvedValueOnce({
        id: 'r1',
        instructorId: 'inst-1',
        studentId: 's1',
        status: HelpRequestStatus.open,
      });
      students.findByUserId.mockResolvedValueOnce({ id: 's2' });
      await expect(
        svc.appendReply('r1', 'other-user', 'student', 'hi'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── setStatus ──────────────────────────────────────────────────────────
  describe('setStatus', () => {
    it('allows assigned instructor open → resolved', async () => {
      const { svc, repo } = build();
      repo.findById.mockResolvedValueOnce({
        id: 'r1',
        instructorId: 'inst-1',
        status: HelpRequestStatus.open,
      });
      repo.setStatus.mockResolvedValueOnce({ id: 'r1', status: HelpRequestStatus.resolved });
      await svc.setStatus('r1', 'inst-1', 'instructor', HelpRequestStatus.resolved);
      expect(repo.setStatus).toHaveBeenCalledWith('r1', HelpRequestStatus.resolved);
    });

    it('rejects student attempts to set status (Forbidden)', async () => {
      const { svc, repo } = build();
      repo.findById.mockResolvedValueOnce({
        id: 'r1',
        instructorId: 'inst-1',
        status: HelpRequestStatus.answered,
      });
      await expect(
        svc.setStatus('r1', 'student-user', 'student', HelpRequestStatus.resolved),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects illegal transition (open → open) with BadRequest', async () => {
      const { svc, repo } = build();
      repo.findById.mockResolvedValueOnce({
        id: 'r1',
        instructorId: 'inst-1',
        status: HelpRequestStatus.open,
      });
      await expect(
        svc.setStatus('r1', 'inst-1', 'instructor', HelpRequestStatus.open),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects illegal transition (resolved → answered) with BadRequest', async () => {
      const { svc, repo } = build();
      repo.findById.mockResolvedValueOnce({
        id: 'r1',
        instructorId: 'inst-1',
        status: HelpRequestStatus.resolved,
      });
      await expect(
        svc.setStatus('r1', 'inst-1', 'instructor', HelpRequestStatus.answered),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('admin can set status even when not the assigned instructor', async () => {
      const { svc, repo } = build();
      repo.findById.mockResolvedValueOnce({
        id: 'r1',
        instructorId: 'inst-1',
        status: HelpRequestStatus.answered,
      });
      repo.setStatus.mockResolvedValueOnce({ id: 'r1' });
      await svc.setStatus('r1', 'admin-user', 'admin', HelpRequestStatus.resolved);
      expect(repo.setStatus).toHaveBeenCalled();
    });
  });
});
