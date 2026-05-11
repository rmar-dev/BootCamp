'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/layout/AuthProvider';
import { getDraft, type LessonDraft } from '@/lib/builder';
import { Button, Icon } from '@/components/ui';
import { BuilderShell } from '@/components/instructor/builder/BuilderShell';

export default function BuilderEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const lessonId = typeof params?.lessonId === 'string' ? params.lessonId : '';
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      router.replace('/dashboard');
      return;
    }
    setDraft(getDraft(lessonId));
    setResolved(true);
  }, [user, loading, router, lessonId]);

  if (loading || !resolved) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!draft) {
    return (
      <div style={{ maxWidth: 540, margin: '64px auto', padding: '0 24px', textAlign: 'center' }}>
        <h1 style={{ marginBottom: 12 }}>Draft not found</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          This draft no longer exists in this browser. Drafts are stored locally
          until the instructor save API is wired in.
        </p>
        <Link href="/instructor/builder">
          <Button variant="primary" leadingIcon={<Icon name="chevL" size={12} />}>
            Back to builder
          </Button>
        </Link>
      </div>
    );
  }

  return <BuilderShell initialDraft={draft} />;
}
