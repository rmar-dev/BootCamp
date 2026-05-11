// app/(authed)/(immersive)/lesson/[id]/page.tsx
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { fetchLesson } from '@/lib/api';
import { LessonPlayerShell } from '@/components/lesson/LessonPlayerShell';

export const dynamic = 'force-dynamic';

export default async function LessonPage({
  params,
}: {
  params: { id: string };
}) {
  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const lesson = await fetchLesson(params.id, cookieHeader);
  if (!lesson) notFound();
  return <LessonPlayerShell lesson={lesson} />;
}
