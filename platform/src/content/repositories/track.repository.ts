import { Injectable } from '@nestjs/common';
import { Track, Language, TrackKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type LessonRef = {
  id: string;
  version: number;
};

export type CreateTrackInput = {
  id: string;
  title: string;
  language: Language;
  kind: TrackKind;
  description: string;
  lessons: LessonRef[];
};

export type NextVersionInput = Omit<CreateTrackInput, 'id'>;

function splitLessonRefs(refs: LessonRef[]): {
  ids: string[];
  versions: number[];
} {
  return {
    ids: refs.map((r) => r.id),
    versions: refs.map((r) => r.version),
  };
}

@Injectable()
export class TrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(input: CreateTrackInput): Promise<Track> {
    const { ids, versions } = splitLessonRefs(input.lessons);
    return this.prisma.track.create({
      data: {
        id: input.id,
        version: 1,
        title: input.title,
        language: input.language,
        kind: input.kind,
        description: input.description,
        lessonIds: ids,
        lessonVersions: versions,
        publishedAt: null,
      },
    });
  }

  async createNextVersion(id: string, input: NextVersionInput): Promise<Track> {
    const latest = await this.prisma.track.findFirst({
      where: { id },
      orderBy: { version: 'desc' },
    });
    if (!latest) {
      throw new Error(`No existing track with id ${id}`);
    }
    const { ids, versions } = splitLessonRefs(input.lessons);
    return this.prisma.track.create({
      data: {
        id,
        version: latest.version + 1,
        title: input.title,
        language: input.language,
        kind: input.kind,
        description: input.description,
        lessonIds: ids,
        lessonVersions: versions,
        publishedAt: null,
      },
    });
  }

  async publish(id: string, version: number): Promise<Track> {
    return this.prisma.track.update({
      where: { id_version: { id, version } },
      data: { publishedAt: new Date() },
    });
  }

  async findByVersion(id: string, version: number): Promise<Track | null> {
    return this.prisma.track.findUnique({
      where: { id_version: { id, version } },
    });
  }

  async findLatestPublished(id: string): Promise<Track | null> {
    return this.prisma.track.findFirst({
      where: { id, publishedAt: { not: null } },
      orderBy: { version: 'desc' },
    });
  }

  async findAllLatestPublished(): Promise<Track[]> {
    // Get all published tracks, grouped by id, take highest version per id.
    const all = await this.prisma.track.findMany({
      where: { publishedAt: { not: null } },
      orderBy: [{ id: 'asc' }, { version: 'desc' }],
    });
    const byId = new Map<string, Track>();
    for (const track of all) {
      if (!byId.has(track.id)) byId.set(track.id, track);
    }
    return [...byId.values()];
  }
}
