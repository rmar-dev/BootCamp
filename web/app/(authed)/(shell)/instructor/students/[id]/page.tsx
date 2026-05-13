'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import {
  assignStudent,
  type DifficultyBaseline,
  fetchStudentDetail,
  type Language,
  removeExamOverride,
  setDifficulty,
  setStudentLanguage,
  type StudentDetail,
  type StudentTrackContext,
} from '@/lib/students';
import {
  clearAssignment as clearSkillTreeAssignment,
  clearStudentAssignment,
  setAssignment as setSkillTreeAssignment,
  setStudentAssignment,
} from '@/lib/skill-trees';
import {
  Badge,
  Button,
  EmptyState,
  Eyebrow,
  Heading,
  Icon,
  Select,
} from '@/components/ui';

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const studentId = params?.id ?? '';
  const { user, loading } = useAuth();

  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const d = await fetchStudentDetail(studentId);
      setDetail(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student detail');
    }
  }, [studentId]);

  useEffect(() => {
    if (loading) return;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      router.replace('/dashboard');
      return;
    }
    if (!studentId) return;
    refresh().finally(() => setHydrated(true));
  }, [user, loading, router, studentId, refresh]);

  const onSetBaseline = useCallback(
    async (baseline: DifficultyBaseline) => {
      setError(null);
      setSavingBaseline(true);
      try {
        await setDifficulty(studentId, baseline);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSavingBaseline(false);
      }
    },
    [studentId, refresh],
  );

  const onSetLanguage = useCallback(
    async (language: Language | null) => {
      setError(null);
      setSavingLanguage(true);
      try {
        await setStudentLanguage(studentId, language);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSavingLanguage(false);
      }
    },
    [studentId, refresh],
  );

  const onRemoveOverride = useCallback(
    async (exerciseId: string) => {
      setError(null);
      try {
        await removeExamOverride(studentId, exerciseId);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Remove failed');
      }
    },
    [studentId, refresh],
  );

  // Release the student back to the unassigned pool. The roster page has the
  // same control; we expose it here too so an instructor reviewing a student
  // can hand them off without bouncing back to the list.
  const onRelease = useCallback(async () => {
    if (
      !confirm(
        'Release this student? They go back to the unassigned pool and you stop seeing them in your roster. Their data is kept.',
      )
    ) {
      return;
    }
    setError(null);
    try {
      await assignStudent(studentId, null);
      router.replace('/instructor/students');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Release failed');
    }
  }, [studentId, router]);

  // Switch the cohort's active skill tree for one of the student's enrolled
  // tracks. WARNING: cohort-scoped — applies to every student in the same
  // cohort. The UI surfaces this explicitly via the section's helper text and
  // the confirm() prompt below.
  const onSwitchTree = useCallback(
    async (track: StudentTrackContext, newTreeId: string | '') => {
      if (!detail?.cohortId) return;
      const cohortShort = detail.cohortId.slice(0, 8);
      const action = newTreeId
        ? `switch the active skill tree for cohort ${cohortShort} on "${track.trackTitle}"`
        : `clear the skill-tree assignment for cohort ${cohortShort} on "${track.trackTitle}" (revert to canonical track)`;
      if (!confirm(`This affects every student in cohort ${cohortShort}.\n\nProceed to ${action}?`)) {
        return;
      }
      setError(null);
      try {
        if (newTreeId) {
          await setSkillTreeAssignment(detail.cohortId, track.trackId, newTreeId);
        } else {
          await clearSkillTreeAssignment(detail.cohortId, track.trackId);
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Skill tree switch failed');
      }
    },
    [detail?.cohortId, refresh],
  );

  // Set (or clear) a per-student skill-tree override. Shadows the cohort
  // assignment for THIS student only — cohort-mates are unaffected. No
  // confirm() prompt: the blast radius is one student, and the helper text
  // in the section already calls it out.
  const onSetStudentOverride = useCallback(
    async (track: StudentTrackContext, newTreeId: string | '') => {
      setError(null);
      try {
        if (newTreeId) {
          await setStudentAssignment(studentId, track.trackId, newTreeId);
        } else {
          await clearStudentAssignment(studentId, track.trackId);
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Per-student override failed');
      }
    },
    [studentId, refresh],
  );

  if (loading || !hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ maxWidth: 720, margin: '64px auto', padding: '32px 28px', textAlign: 'center' }}>
        <Heading level="h2">Student not found</Heading>
        <p className="muted" style={{ marginTop: 8 }}>
          {error ?? 'Either this student does not exist, or they are not assigned to you.'}
        </p>
        <Link href="/instructor/students" style={{ display: 'inline-block', marginTop: 16 }}>
          <Button variant="ghost" size="sm">← Back to roster</Button>
        </Link>
      </div>
    );
  }

  const { student, difficultyBaseline, examOverrides, openHelpRequestCount } = detail;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 28px 80px' }}>
      <Link href="/instructor/students" style={{ fontSize: 'var(--t-sm)' }}>
        <span className="muted">← Back to roster</span>
      </Link>

      <header
        style={{
          margin: '12px 0 24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <Heading level="h1" style={{ marginBottom: 4 }}>
            {student.name}
          </Heading>
          <p className="muted" style={{ margin: 0, fontSize: 'var(--t-md)' }}>
            {student.email}
            {student.cohortId && (
              <>
                {' · '}
                <span className="mono">cohort {student.cohortId.slice(0, 8)}</span>
              </>
            )}
          </p>
        </div>
        {/* Release button — mirrors the per-row Release on /instructor/students.
            Admin can release anyone; instructors only see their own students
            on this page so no extra role check needed here. */}
        {student.instructorId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRelease}
            title="Release this student back to the unassigned pool"
          >
            Release student
          </Button>
        )}
      </header>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--danger-500, #b91c1c)',
            background: 'color-mix(in oklab, var(--danger-500, #b91c1c) 12%, transparent)',
            fontSize: 'var(--t-sm)',
          }}
        >
          {error}
        </div>
      )}

      {/* ── KPIs ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <KpiCard label="Difficulty" value={difficultyBaseline} />
        <KpiCard label="Open help requests" value={String(openHelpRequestCount)} />
        <KpiCard label="Exam overrides" value={String(examOverrides.length)} />
      </div>

      {/* ── Difficulty dial ─────────────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <Eyebrow style={{ marginBottom: 8 }}>Difficulty baseline</Eyebrow>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 'var(--t-sm)' }}>
          Biases the lesson assembler when picking exercises for this student. Per-exam
          overrides below win over the dial.
        </p>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          {(['easy', 'standard', 'challenging'] as const).map((b) => (
            <Button
              key={b}
              variant={difficultyBaseline === b ? 'primary' : 'outline'}
              size="sm"
              disabled={savingBaseline}
              onClick={() => onSetBaseline(b)}
            >
              {b}
            </Button>
          ))}
        </div>
      </section>

      {/* ── Language assignment ─────────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <Eyebrow style={{ marginBottom: 8 }}>Language</Eyebrow>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 'var(--t-sm)' }}>
          Decides which language this student is learning. When set, the student only
          sees tracks of this language. Clear it to give them access to every track.
        </p>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          {([
            { value: null, label: 'Any' },
            { value: 'swift', label: 'Swift' },
            { value: 'kotlin', label: 'Kotlin' },
          ] as const).map((opt) => (
            <Button
              key={opt.label}
              variant={(student.language ?? null) === opt.value ? 'primary' : 'outline'}
              size="sm"
              disabled={savingLanguage}
              onClick={() => onSetLanguage(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </section>

      {/* ── Per-exam overrides ─────────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <Eyebrow style={{ marginBottom: 8 }}>Per-exam overrides</Eyebrow>
        {examOverrides.length === 0 ? (
          <EmptyState
            icon="target"
            title="No per-exam overrides"
            description="Per-exercise tweaks (extend time, mark optional, swap exercise) appear here once configured."
          />
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {examOverrides.map((o) => (
              <li key={o.exerciseId}>
                <div className="lesson-list-row" style={{ gridTemplateColumns: '1fr auto auto auto' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="lesson-row-title">
                      <span className="mono">exercise {o.exerciseId.slice(0, 8)}</span>
                      {' · '}v{o.exerciseVersion}
                    </div>
                    <div className="lesson-row-meta">
                      {o.extendTimeMs != null && (
                        <>
                          <span>+{Math.round(o.extendTimeMs / 1000)}s extra</span>
                          <span>·</span>
                        </>
                      )}
                      {o.optional && (
                        <>
                          <Badge tone="amber">optional</Badge>
                          <span>·</span>
                        </>
                      )}
                      {o.swapToExerciseId && (
                        <>
                          <span>swap → {o.swapToExerciseId.slice(0, 8)}</span>
                          <span>·</span>
                        </>
                      )}
                      <span>updated {new Date(o.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label="Remove override"
                    onClick={() => onRemoveOverride(o.exerciseId)}
                  >
                    <Icon name="trash" size={12} />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="muted" style={{ marginTop: 12, fontSize: 'var(--t-xs)' }}>
          Adding a new override needs the target exerciseId — author-side
          add-override UI will land alongside the lesson-runtime exercise
          picker (deferred).
        </p>
      </section>

      {/* ── Skill trees (cohort-scoped + per-student override) ─────── */}
      <section style={{ marginBottom: 24 }}>
        <Eyebrow style={{ marginBottom: 8 }}>Skill tree</Eyebrow>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 'var(--t-sm)' }}>
          Choose the lesson sequence this student sees. The{' '}
          <strong>personal pick</strong> applies to this student only;
          the <strong>cohort default</strong> applies to every student in the
          cohort. When both are set, the personal pick wins. Tracks are
          filtered to the student&apos;s assigned language.
        </p>
        {detail.tracks.length === 0 ? (
          <EmptyState
            icon="tree"
            title="Not enrolled in any tracks"
            description="Once the student enrolls in a track, the cohort's active skill tree will appear here."
          />
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {detail.tracks.map((t) => {
              const effective = t.studentOverride ?? t.activeSkillTree;
              return (
                <li
                  key={t.trackId}
                  style={{
                    padding: 12,
                    border: '1px solid var(--border-subtle, #2a3340)',
                    borderRadius: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Badge tone={t.language === 'kotlin' ? 'amber' : 'default'}>{t.language}</Badge>
                    <strong>{t.trackTitle}</strong>
                    <span className="muted" style={{ fontSize: 'var(--t-xs)' }}>v{t.trackVersion}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 'var(--t-sm)', marginBottom: 10 }}>
                    Currently active:{' '}
                    {effective
                      ? <strong style={{ color: 'inherit' }}>{effective.name}</strong>
                      : <em>track default</em>}
                    {t.studentOverride && (
                      <Badge tone="brand" style={{ marginLeft: 8 }}>personal pick</Badge>
                    )}
                  </div>

                  {/* Personal pick — applies to this one student. */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                    <label style={{ fontSize: 'var(--t-xs)', minWidth: 150 }} className="muted">
                      Personal pick:
                    </label>
                    <Select
                      controlSize="sm"
                      value={t.studentOverride?.id ?? ''}
                      onChange={(e) => onSetStudentOverride(t, e.target.value)}
                      options={[
                        { value: '', label: 'Use cohort default' },
                        ...t.availableTrees.map((tree) => ({
                          value: tree.id,
                          label: `${tree.name}${tree.visibility === 'private' ? ' (private)' : ''}`,
                        })),
                      ]}
                    />
                    <span className="muted" style={{ fontSize: 'var(--t-xs)' }}>
                      this student only
                    </span>
                    {t.availableTrees.length === 0 && (
                      <span className="muted" style={{ fontSize: 'var(--t-xs)' }}>
                        No trees authored yet.{' '}
                        <Link href="/instructor/skill-tree" style={{ color: 'inherit', textDecoration: 'underline' }}>
                          Create one →
                        </Link>
                      </span>
                    )}
                  </div>

                  {/* Cohort default — only when the student is in a cohort. */}
                  {detail.cohortId && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: 'var(--t-xs)', minWidth: 150 }} className="muted">
                        Cohort default:
                      </label>
                      <Select
                        controlSize="sm"
                        value={t.activeSkillTree?.id ?? ''}
                        onChange={(e) => onSwitchTree(t, e.target.value)}
                        options={[
                          { value: '', label: 'Use track default' },
                          ...t.availableTrees.map((tree) => ({
                            value: tree.id,
                            label: `${tree.name}${tree.visibility === 'private' ? ' (private)' : ''}`,
                          })),
                        ]}
                      />
                      <span className="muted" style={{ fontSize: 'var(--t-xs)' }}>
                        every student in this cohort
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* ── Help-request shortcut ─────────────────────────────────── */}
      <section>
        <Eyebrow style={{ marginBottom: 8 }}>Help requests</Eyebrow>
        <p className="muted" style={{ margin: '0 0 8px', fontSize: 'var(--t-sm)' }}>
          {openHelpRequestCount > 0
            ? `${openHelpRequestCount} open help request${openHelpRequestCount === 1 ? '' : 's'} from this student.`
            : 'No open help requests from this student.'}
        </p>
        <Link href="/instructor/help">
          <Button variant="outline" size="sm" leadingIcon={<Icon name="arrowR" size={12} />}>
            Open inbox
          </Button>
        </Link>
      </section>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '16px 18px',
        borderRadius: 10,
        border: '1px solid var(--border-subtle, #2a3340)',
      }}
    >
      <div className="muted" style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: 'var(--t-2xl)', fontWeight: 600 }}>{value}</div>
    </div>
  );
}
