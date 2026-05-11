import { PrismaClient } from '@prisma/client';

export async function publishTrack(
  prisma: PrismaClient,
  trackId: string,
  version: number,
  lessonVersions: Array<{ id: string; version: number }>,
  exerciseVersions: Array<{ id: string; version: number }>,
): Promise<void> {
  // Publish bottom-up: exercises → lessons → track
  for (const ex of exerciseVersions) {
    const existing = await prisma.exercise.findFirst({
      where: { id: ex.id, version: ex.version },
    });
    if (existing && !existing.publishedAt) {
      await prisma.exercise.update({
        where: { id_version: { id: ex.id, version: ex.version } },
        data: { publishedAt: new Date() },
      });
    }
  }

  for (const lesson of lessonVersions) {
    const existing = await prisma.lesson.findFirst({
      where: { id: lesson.id, version: lesson.version },
    });
    if (existing && !existing.publishedAt) {
      await prisma.lesson.update({
        where: { id_version: { id: lesson.id, version: lesson.version } },
        data: { publishedAt: new Date() },
      });
    }
  }

  const track = await prisma.track.findFirst({
    where: { id: trackId, version },
  });
  if (track && !track.publishedAt) {
    await prisma.track.update({
      where: { id_version: { id: trackId, version } },
      data: { publishedAt: new Date() },
    });
  }
}
