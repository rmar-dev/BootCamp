import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  HelpAnchorKind,
  HelpMessage,
  HelpRequest,
  HelpRequestStatus,
} from '@prisma/client';
import {
  HelpRequestRepository,
  type HelpRequestWithMessages,
} from './help-request.repository';
import { StudentRepository } from '../state/repositories/student.repository';

export type CreateRequestInput = {
  studentUserId: string;
  anchorKind: HelpAnchorKind;
  anchorId: string;
  title: string;
  body: string;
};

@Injectable()
export class HelpRequestService {
  private readonly logger = new Logger(HelpRequestService.name);

  constructor(
    private readonly repo: HelpRequestRepository,
    private readonly students: StudentRepository,
  ) {}

  /**
   * Student opens a new help request. The instructorId is captured at
   * creation from Student.instructorId — it does NOT migrate if the student
   * is later reassigned (the request stays with whoever was supposed to
   * handle it).
   *
   * Throws if the student has no assigned instructor (the platform cannot
   * route the request anywhere). Admins can backfill the assignment via
   * `/instructor/students` and the student can re-submit.
   */
  async createForStudent(input: CreateRequestInput): Promise<HelpRequestWithMessages> {
    const student = await this.students.findByUserId(input.studentUserId);
    if (!student) throw new BadRequestException('No student record for this user');
    if (!student.instructorId) {
      throw new BadRequestException(
        'You do not have an assigned instructor — please contact an admin to be assigned',
      );
    }
    const title = input.title.trim();
    if (title.length === 0) throw new BadRequestException('title cannot be empty');
    if (title.length > 200) throw new BadRequestException('title cannot exceed 200 characters');
    const body = input.body.trim();
    if (body.length === 0) throw new BadRequestException('body cannot be empty');

    const request = await this.repo.create({
      studentId: student.id,
      instructorId: student.instructorId,
      anchorKind: input.anchorKind,
      anchorId: input.anchorId,
      title,
    });
    await this.repo.appendMessage({
      helpRequestId: request.id,
      authorId: input.studentUserId,
      body,
    });
    const full = await this.repo.findByIdWithMessages(request.id);
    if (!full) throw new Error('Help request disappeared after creation');
    return full;
  }

  async getInbox(instructorUserId: string, status?: HelpRequestStatus): Promise<HelpRequest[]> {
    return this.repo.findInbox(instructorUserId, { status });
  }

  /**
   * Single-request fetch with thread. Authorization: assigned instructor of
   * the request OR the student whose request it is. Anyone else gets 403.
   */
  async getThread(
    requestId: string,
    callerUserId: string,
    callerRole: string,
  ): Promise<HelpRequestWithMessages> {
    const request = await this.repo.findByIdWithMessages(requestId);
    if (!request) throw new NotFoundException('Help request not found');
    if (callerRole === 'admin') return request;
    if (request.instructorId === callerUserId) return request;
    // Student must be the request's owner.
    const student = await this.students.findByUserId(callerUserId);
    if (student && request.studentId === student.id) return request;
    throw new ForbiddenException('You do not have access to this help request');
  }

  /**
   * Append a reply to the thread. Authorization mirrors getThread.
   * Status transition side-effect: a reply from the assigned instructor
   * moves an `open` request to `answered`; a reply from the student on an
   * `answered` request moves it back to `open` (re-opened, awaiting
   * instructor again).
   */
  async appendReply(
    requestId: string,
    callerUserId: string,
    callerRole: string,
    body: string,
  ): Promise<HelpMessage> {
    const trimmed = body.trim();
    if (trimmed.length === 0) throw new BadRequestException('body cannot be empty');

    const request = await this.repo.findById(requestId);
    if (!request) throw new NotFoundException('Help request not found');

    const isAssignedInstructor = request.instructorId === callerUserId;
    let isOwningStudent = false;
    if (!isAssignedInstructor && callerRole !== 'admin') {
      const student = await this.students.findByUserId(callerUserId);
      isOwningStudent = !!student && request.studentId === student.id;
      if (!isOwningStudent) throw new ForbiddenException('You do not have access to this help request');
    }

    const message = await this.repo.appendMessage({
      helpRequestId: requestId,
      authorId: callerUserId,
      body: trimmed,
    });

    // Status transitions are best-effort — never block the reply on failure.
    // The message is already persisted; a failed transition just means the
    // status drifts at most one step until the next event re-triggers it.
    // This mirrors the gamification rule from CLAUDE.md: side-effect work
    // (badges, status updates) must NOT fail the underlying primary action.
    try {
      if (isAssignedInstructor && request.status === HelpRequestStatus.open) {
        await this.repo.setStatus(requestId, HelpRequestStatus.answered);
      } else if (isOwningStudent && request.status === HelpRequestStatus.answered) {
        await this.repo.setStatus(requestId, HelpRequestStatus.open);
      }
    } catch (err) {
      this.logger.warn(
        `status transition for help request ${requestId} failed; reply persisted: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return message;
  }

  /**
   * Status transition. The caller must be the assigned instructor (or
   * admin); students cannot directly mark a request resolved (they reach
   * resolution by replying, then the instructor closes it). Allowed
   * transitions:
   *   open      → answered | resolved
   *   answered  → open     | resolved
   *   resolved  → open     (re-open by instructor only)
   *
   * The student's "implicit re-open by replying" path lives in appendReply,
   * not here.
   */
  async setStatus(
    requestId: string,
    callerUserId: string,
    callerRole: string,
    next: HelpRequestStatus,
  ): Promise<HelpRequest> {
    const request = await this.repo.findById(requestId);
    if (!request) throw new NotFoundException('Help request not found');

    if (callerRole !== 'admin' && request.instructorId !== callerUserId) {
      throw new ForbiddenException('Only the assigned instructor can change request status');
    }

    if (!isLegalTransition(request.status, next)) {
      throw new BadRequestException(`Cannot transition from ${request.status} to ${next}`);
    }
    return this.repo.setStatus(requestId, next);
  }
}

function isLegalTransition(
  current: HelpRequestStatus,
  next: HelpRequestStatus,
): boolean {
  if (current === next) return false;
  if (current === HelpRequestStatus.open) {
    return next === HelpRequestStatus.answered || next === HelpRequestStatus.resolved;
  }
  if (current === HelpRequestStatus.answered) {
    return next === HelpRequestStatus.open || next === HelpRequestStatus.resolved;
  }
  if (current === HelpRequestStatus.resolved) {
    return next === HelpRequestStatus.open;
  }
  return false;
}
