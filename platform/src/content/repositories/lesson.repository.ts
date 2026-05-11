import { Injectable } from '@nestjs/common';
import { Lesson, Block, BlockKind, LessonLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type BlockInput = {
  id: string;
  position: number;
  kind: BlockKind;
  explanationMarkdown?: string | null;
  exerciseId?: string | null;
  exerciseVersion?: number | null;
  videoUrl?: string | null;
  videoTitle?: string | null;
  videoDescription?: string | null;
  videoDurationLabel?: string | null;
  videoPosterUrl?: string | null;
};

export type CreateLessonInput = {
  id: string;
  trackId: string;
  position: number;
  title: string;
  level: LessonLevel;
  summary: string;
  blocks: BlockInput[];
};

export type NextLessonVersionInput = Omit<CreateLessonInput, 'id'>;

export type LessonWithBlocks = Lesson & { blocks: Block[] };

@Injectable()
export class LessonRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(input: CreateLessonInput): Promise<Lesson> {
    return this.persistVersion(input.id, 1, input);
  }

  async createNextVersion(
    id: string,
    input: NextLessonVersionInput,
  ): Promise<Lesson> {
    const latest = await this.prisma.lesson.findFirst({
      where: { id },
      orderBy: { version: 'desc' },
    });
    if (!latest) {
      throw new Error(`No existing lesson with id ${id}`);
    }
    return this.persistVersion(id, latest.version + 1, input);
  }

  private async persistVersion(
    id: string,
    version: number,
    input: NextLessonVersionInput,
  ): Promise<Lesson> {
    return this.prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.create({
        data: {
          id,
          version,
          trackId: input.trackId,
          position: input.position,
          title: input.title,
          level: input.level,
          summary: input.summary,
          blockIds: input.blocks.map((b) => b.id),
          publishedAt: null,
        },
      });

      if (input.blocks.length > 0) {
        await tx.block.createMany({
          data: input.blocks.map((b) => ({
            id: b.id,
            lessonId: id,
            lessonVersion: version,
            position: b.position,
            kind: b.kind,
            explanationMarkdown: b.explanationMarkdown ?? null,
            exerciseId: b.exerciseId ?? null,
            exerciseVersion: b.exerciseVersion ?? null,
            videoUrl: b.videoUrl ?? null,
            videoTitle: b.videoTitle ?? null,
            videoDescription: b.videoDescription ?? null,
            videoDurationLabel: b.videoDurationLabel ?? null,
            videoPosterUrl: b.videoPosterUrl ?? null,
          })),
        });
      }

      return lesson;
    });
  }

  async publish(id: string, version: number): Promise<Lesson> {
    return this.prisma.lesson.update({
      where: { id_version: { id, version } },
      data: { publishedAt: new Date() },
    });
  }

  async findByVersion(id: string, version: number): Promise<Lesson | null> {
    return this.prisma.lesson.findUnique({
      where: { id_version: { id, version } },
    });
  }

  async findByVersionWithBlocks(
    id: string,
    version: number,
  ): Promise<LessonWithBlocks | null> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id_version: { id, version } },
      include: { blocks: { orderBy: { position: 'asc' } } },
    });
    return lesson;
  }

  async findLatestPublished(id: string): Promise<Lesson | null> {
    return this.prisma.lesson.findFirst({
      where: { id, publishedAt: { not: null } },
      orderBy: { version: 'desc' },
    });
  }

  async findLatestPublishedWithBlocks(
    id: string,
  ): Promise<LessonWithBlocks | null> {
    const latest = await this.prisma.lesson.findFirst({
      where: { id, publishedAt: { not: null } },
      orderBy: { version: 'desc' },
      include: { blocks: { orderBy: { position: 'asc' } } },
    });
    return latest;
  }

  async findPublishedByVersionWithBlocks(
    id: string,
    version: number,
  ): Promise<LessonWithBlocks | null> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id_version: { id, version } },
      include: { blocks: { orderBy: { position: 'asc' } } },
    });
    if (!lesson || lesson.publishedAt === null) return null;
    return lesson;
  }
}
