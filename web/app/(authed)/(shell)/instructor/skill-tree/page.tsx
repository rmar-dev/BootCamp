'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { forkLessonToDraft } from '@/lib/builder';
import {
  fetchTrack,
  fetchTracks,
  type LessonSummary,
  type TrackSummary,
} from '@/lib/tracks';
import {
  type AssignmentWithTree,
  type CohortSummary,
  clearAssignment,
  createTree,
  deleteTree,
  getAssignment,
  listCohorts,
  listTrees,
  setAssignment,
  setStudentAssignment,
  type SkillTree,
  type SkillTreeVisibility,
  updateTree,
} from '@/lib/skill-trees';
import { fetchStudentDetail } from '@/lib/students';
import {
  Badge,
  Button,
  EmptyState,
  Eyebrow,
  Field,
  Heading,
  Icon,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';
import { SwapLessonModal, type PickedLesson } from '@/components/instructor/skill-tree/SwapLessonModal';

type SaveAsModalState =
  | { open: false }
  | { open: true; defaultName: string };

export default function SkillTreeComposerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // For-student mode: when the composer is opened from a student detail page
  // with `?trackId=…&forStudent=…`, we (a) pre-select the track, (b) show a
  // banner explaining the scope, and (c) on Save-as auto-assign the freshly
  // created tree as that student's personal override and bounce back.
  const queryTrackId = searchParams?.get('trackId') ?? '';
  const forStudentId = searchParams?.get('forStudent') ?? '';
  const [forStudentName, setForStudentName] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [trackId, setTrackId] = useState<string>('');
  const [cohorts, setCohorts] = useState<CohortSummary[]>([]);
  const [cohortId, setCohortId] = useState<string>('');
  const [defaultLessons, setDefaultLessons] = useState<LessonSummary[]>([]);
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [swapAt, setSwapAt] = useState<number | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Trees: every tree visible for the current track (own + public from
  // others). Refreshed after create/update/delete and after the track
  // changes.
  const [trees, setTrees] = useState<SkillTree[]>([]);
  // The tree currently loaded into the editor. null = unsaved scratch
  // (likely seeded from defaultLessons or freshly cleared).
  const [loadedTree, setLoadedTree] = useState<SkillTree | null>(null);
  // Active assignment for the (cohort, track) pair, if any.
  const [activeAssignment, setActiveAssignment] = useState<AssignmentWithTree | null>(null);

  // Save-as dialog: prompts for name + visibility before creating a new tree.
  const [saveAsModal, setSaveAsModal] = useState<SaveAsModalState>({ open: false });

  // Inline alert/status banner — surfaces server validation errors instead
  // of the previous silent console-only failure path.
  const [feedback, setFeedback] = useState<
    | { kind: 'error'; message: string }
    | { kind: 'success'; message: string }
    | null
  >(null);

  const [lessonLookup, setLessonLookup] = useState<Map<string, LessonSummary>>(new Map());

  // ── Initial bootstrap (tracks + cohorts) ──────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      router.replace('/dashboard');
      return;
    }
    Promise.all([
      fetchTracks().then((t) => {
        setTracks(t);
        // Prefer the ?trackId= from the URL when present (for-student deep-link
        // from the student detail page) and it exists in the list. Otherwise
        // fall back to the first track.
        const preferred = queryTrackId && t.some((tr) => tr.id === queryTrackId)
          ? queryTrackId
          : t[0]?.id ?? '';
        if (preferred) setTrackId(preferred);
      }),
      listCohorts()
        .then((c) => {
          setCohorts(c);
          if (c.length > 0) setCohortId(c[0].id);
        })
        .catch(() => setCohorts([])),
      forStudentId
        ? fetchStudentDetail(forStudentId)
            .then((d) => setForStudentName(d?.student.name ?? null))
            .catch(() => setForStudentName(null))
        : Promise.resolve(),
    ]).finally(() => setHydrated(true));
  }, [user, loading, router, queryTrackId, forStudentId]);

  // ── Refresh trees + active assignment whenever track changes ──────────
  const refreshTrees = useCallback(async (forTrackId: string) => {
    if (!forTrackId) {
      setTrees([]);
      return;
    }
    try {
      setTrees(await listTrees(forTrackId));
    } catch {
      setTrees([]);
    }
  }, []);

  const refreshActiveAssignment = useCallback(
    async (forCohort: string, forTrack: string) => {
      if (!forCohort || !forTrack) {
        setActiveAssignment(null);
        return;
      }
      try {
        setActiveAssignment(await getAssignment(forCohort, forTrack));
      } catch {
        setActiveAssignment(null);
      }
    },
    [],
  );

  // ── Load default lessons + reset editor when track changes ────────────
  // Always loads the canonical track via ?mode=preview so the composer
  // doesn't silently re-seed from an active assignment.
  useEffect(() => {
    if (!trackId) return;
    let cancelled = false;
    (async () => {
      const td = await fetchTrack(trackId, { preview: true });
      if (cancelled) return;
      const lessons = td?.lessons ?? [];
      setDefaultLessons(lessons);
      setLessonLookup((prev) => {
        const next = new Map(prev);
        for (const l of lessons) next.set(l.id, l);
        return next;
      });
      // Default to the canonical sequence on track change. Loading a tree
      // is an explicit action via the trees panel.
      setLoadedTree(null);
      setPlanIds(lessons.map((l) => l.id));
      await refreshTrees(trackId);
    })();
    return () => {
      cancelled = true;
    };
  }, [trackId, refreshTrees]);

  useEffect(() => {
    void refreshActiveAssignment(cohortId, trackId);
  }, [cohortId, trackId, refreshActiveAssignment]);

  // ── Derived state ─────────────────────────────────────────────────────
  const planLessons = useMemo(
    () =>
      planIds
        .map((id) => lessonLookup.get(id))
        .filter((l): l is LessonSummary => Boolean(l)),
    [planIds, lessonLookup],
  );

  const planSet = useMemo(() => new Set(planIds), [planIds]);

  const isDirty = useMemo(() => {
    if (loadedTree) {
      // Dirty against the currently-loaded tree.
      if (loadedTree.lessonIds.length !== planIds.length) return true;
      return loadedTree.lessonIds.some((id, i) => id !== planIds[i]);
    }
    // Unsaved scratch: dirty against the canonical default.
    const def = defaultLessons.map((l) => l.id);
    if (def.length !== planIds.length) return true;
    return def.some((id, i) => id !== planIds[i]);
  }, [loadedTree, planIds, defaultLessons]);

  const canEditLoadedTree = useMemo(() => {
    if (!loadedTree) return false;
    if (!user) return false;
    return user.role === 'admin' || loadedTree.authorUserId === user.id;
  }, [loadedTree, user]);

  // ── Editor mutations (drag / swap / remove / insert) ──────────────────
  const onReorder = useCallback((from: number, to: number) => {
    setPlanIds((cur) => {
      const next = [...cur];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const onRemove = useCallback((idx: number) => {
    setPlanIds((cur) => cur.filter((_, i) => i !== idx));
  }, []);

  const onPickedLesson = useCallback(
    (picked: PickedLesson) => {
      setLessonLookup((prev) => new Map(prev).set(picked.lesson.id, picked.lesson));
      if (swapAt !== null) {
        setPlanIds((cur) => {
          const next = [...cur];
          next[swapAt] = picked.lesson.id;
          return next;
        });
        setSwapAt(null);
      } else if (insertAt !== null) {
        setPlanIds((cur) => {
          const next = [...cur];
          next.splice(insertAt, 0, picked.lesson.id);
          return next;
        });
        setInsertAt(null);
      }
    },
    [swapAt, insertAt],
  );

  // ── Tree actions ──────────────────────────────────────────────────────
  const onLoadDefault = useCallback(() => {
    setLoadedTree(null);
    setPlanIds(defaultLessons.map((l) => l.id));
    setFeedback(null);
  }, [defaultLessons]);

  const onLoadTree = useCallback(
    (tree: SkillTree) => {
      setLoadedTree(tree);
      setPlanIds(tree.lessonIds);
      // Make sure every lesson the tree references is in the lookup so the
      // rows render rich metadata. We intentionally leave previously-loaded
      // entries in place (cross-track lessons may be present from swaps).
      setFeedback(null);
    },
    [],
  );

  const onSaveChanges = useCallback(async () => {
    if (!loadedTree) return;
    setFeedback(null);
    try {
      const next = await updateTree(loadedTree.id, { lessonIds: planIds });
      setLoadedTree(next);
      setFeedback({ kind: 'success', message: `Saved changes to "${next.name}".` });
      await refreshTrees(trackId);
    } catch (err) {
      setFeedback({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Save failed',
      });
    }
  }, [loadedTree, planIds, trackId, refreshTrees]);

  const onSaveAs = useCallback(
    async (name: string, description: string, visibility: SkillTreeVisibility) => {
      if (!trackId) return;
      setFeedback(null);
      try {
        const created = await createTree({
          trackId,
          name,
          description: description || null,
          visibility,
          lessonIds: planIds,
        });
        // For-student deep-link mode: chain a setStudentAssignment, then bounce
        // back to the student page. We swallow assignment failure into a
        // visible error rather than redirecting on a half-done state.
        if (forStudentId) {
          try {
            await setStudentAssignment(forStudentId, trackId, created.id);
          } catch (assignErr) {
            setFeedback({
              kind: 'error',
              message: `Tree "${created.name}" created, but assigning it to the student failed: ${
                assignErr instanceof Error ? assignErr.message : String(assignErr)
              }. You can pick it from the student page.`,
            });
            setLoadedTree(created);
            setSaveAsModal({ open: false });
            await refreshTrees(trackId);
            return;
          }
          router.replace(`/instructor/students/${encodeURIComponent(forStudentId)}`);
          return;
        }
        setLoadedTree(created);
        setSaveAsModal({ open: false });
        setFeedback({ kind: 'success', message: `Created "${created.name}".` });
        await refreshTrees(trackId);
      } catch (err) {
        setFeedback({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Create failed',
        });
      }
    },
    [trackId, planIds, refreshTrees, forStudentId, router],
  );

  const onDeleteLoadedTree = useCallback(async () => {
    if (!loadedTree) return;
    setFeedback(null);
    try {
      await deleteTree(loadedTree.id);
      setFeedback({ kind: 'success', message: `Deleted "${loadedTree.name}".` });
      setLoadedTree(null);
      setPlanIds(defaultLessons.map((l) => l.id));
      await refreshTrees(trackId);
      await refreshActiveAssignment(cohortId, trackId);
    } catch (err) {
      setFeedback({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Delete failed',
      });
    }
  }, [loadedTree, defaultLessons, trackId, cohortId, refreshTrees, refreshActiveAssignment]);

  const onToggleVisibility = useCallback(async () => {
    if (!loadedTree || !canEditLoadedTree) return;
    setFeedback(null);
    const next: SkillTreeVisibility = loadedTree.visibility === 'public' ? 'private' : 'public';
    try {
      const updated = await updateTree(loadedTree.id, { visibility: next });
      setLoadedTree(updated);
      setFeedback({
        kind: 'success',
        message: `Visibility set to ${updated.visibility}.`,
      });
      await refreshTrees(trackId);
    } catch (err) {
      setFeedback({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Update failed',
      });
    }
  }, [loadedTree, canEditLoadedTree, trackId, refreshTrees]);

  // ── Cohort assignment actions ─────────────────────────────────────────
  const onActivateOnCohort = useCallback(async () => {
    if (!loadedTree || !cohortId || !trackId) return;
    setFeedback(null);
    try {
      await setAssignment(cohortId, trackId, loadedTree.id);
      const cohortName = cohorts.find((c) => c.id === cohortId)?.name ?? cohortId.slice(0, 8);
      setFeedback({
        kind: 'success',
        message: `Activated "${loadedTree.name}" on cohort "${cohortName}".`,
      });
      await refreshActiveAssignment(cohortId, trackId);
    } catch (err) {
      setFeedback({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Activation failed',
      });
    }
  }, [loadedTree, cohortId, trackId, cohorts, refreshActiveAssignment]);

  // Click-through to the lesson editor: fork the published lesson into a
  // local draft (the builder edits drafts, not published rows directly),
  // then navigate to the immersive builder route. Mirrors the flow on
  // /instructor/builder when an instructor opens an existing lesson.
  const [openingLessonId, setOpeningLessonId] = useState<string | null>(null);
  const onOpenLessonInBuilder = useCallback(
    async (lessonId: string) => {
      if (openingLessonId) return;
      setOpeningLessonId(lessonId);
      setFeedback(null);
      try {
        const draft = await forkLessonToDraft(lessonId);
        router.push(`/instructor/builder/${draft.id}`);
      } catch (err) {
        setFeedback({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Could not open lesson in builder',
        });
        setOpeningLessonId(null);
      }
    },
    [openingLessonId, router],
  );

  const onClearCohortAssignment = useCallback(async () => {
    if (!cohortId || !trackId) return;
    setFeedback(null);
    try {
      await clearAssignment(cohortId, trackId);
      setFeedback({
        kind: 'success',
        message: 'Cohort reverted to the default published sequence.',
      });
      await refreshActiveAssignment(cohortId, trackId);
    } catch (err) {
      setFeedback({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Clear failed',
      });
    }
  }, [cohortId, trackId, refreshActiveAssignment]);

  if (loading || !hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const myUserId = user?.id;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 28px 80px' }}>
      <header style={{ marginBottom: 24 }}>
        <Heading level="h1" style={{ marginBottom: 4 }}>
          Skill tree composer
        </Heading>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--t-md)' }}>
          Author named lesson sequences for a track. Save them as private (only
          you) or public (any instructor can adopt). Activate one on a cohort
          to change what its students see in Your Path.
        </p>
      </header>

      {forStudentId && (
        <div
          role="status"
          style={{
            marginBottom: 18,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid var(--peacock-500, #0e7490)',
            background: 'color-mix(in oklab, var(--peacock-500, #0e7490) 12%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 'var(--t-sm)' }}>
            Composing a new tree for{' '}
            <strong>{forStudentName ?? 'student'}</strong>
            {trackId && tracks.length > 0 && (
              <>
                {' '}
                on{' '}
                <strong>
                  {tracks.find((t) => t.id === trackId)?.title ?? 'this track'}
                </strong>
              </>
            )}
            . When you Save it, it will be auto-assigned as this student&apos;s
            personal pick.
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/instructor/students/${encodeURIComponent(forStudentId)}`)}
          >
            Cancel and go back
          </Button>
        </div>
      )}

      {/* ── Track + cohort selectors ─────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 18,
          maxWidth: 720,
        }}
      >
        <Field label="Track" htmlFor="track">
          <Select id="track" value={trackId} onChange={(e) => setTrackId(e.target.value)}>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.language})
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Cohort"
          htmlFor="cohort"
          help={
            cohorts.length === 0
              ? 'No cohorts available — create one first or ask an admin to assign you.'
              : activeAssignment
                ? `Currently active: "${activeAssignment.skillTree.name}".`
                : 'Currently using the published default for this cohort.'
          }
        >
          <Select
            id="cohort"
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            disabled={cohorts.length === 0}
          >
            {cohorts.length === 0 && <option value="">— no cohorts —</option>}
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* ── Trees panel: load default, load existing tree, create new ──── */}
      <TreesPanel
        trees={trees}
        loadedTreeId={loadedTree?.id ?? null}
        myUserId={myUserId}
        onLoadDefault={onLoadDefault}
        onLoadTree={onLoadTree}
      />

      {/* ── Currently editing badge + tree-level actions ──────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
          marginTop: 24,
        }}
      >
        <Eyebrow>
          {loadedTree ? (
            <>
              Editing: <span style={{ textTransform: 'none', letterSpacing: 0 }}>{loadedTree.name}</span>
              <Badge tone={loadedTree.visibility === 'public' ? 'success' : 'default'} dot style={{ marginLeft: 8 }}>
                {loadedTree.visibility}
              </Badge>
              {!canEditLoadedTree && (
                <Badge tone="amber" style={{ marginLeft: 6 }}>
                  read-only (not your tree)
                </Badge>
              )}
            </>
          ) : (
            <>
              Editing default sequence
              <span className="muted" style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                · save as a new tree to persist
              </span>
            </>
          )}
          <span className="muted" style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
            · {planLessons.length} lesson{planLessons.length === 1 ? '' : 's'}
          </span>
          {isDirty && (
            <span className="muted" style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
              · unsaved changes
            </span>
          )}
        </Eyebrow>
        <div style={{ display: 'inline-flex', gap: 8 }}>
          {loadedTree && canEditLoadedTree && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleVisibility}
              title={`Switch to ${loadedTree.visibility === 'public' ? 'private' : 'public'}`}
            >
              <Icon name={loadedTree.visibility === 'public' ? 'lock' : 'eye'} size={12} />
              Make {loadedTree.visibility === 'public' ? 'private' : 'public'}
            </Button>
          )}
          {loadedTree && canEditLoadedTree && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeleteLoadedTree}
              title="Delete this tree (only allowed if not assigned)"
            >
              <Icon name="trash" size={12} />
              Delete tree
            </Button>
          )}
          {loadedTree && canEditLoadedTree && (
            <Button
              variant="iridescent"
              size="sm"
              onClick={onSaveChanges}
              disabled={!isDirty}
              title="Save changes to this tree"
            >
              Save changes
            </Button>
          )}
          <Button
            variant={loadedTree ? 'outline' : 'iridescent'}
            size="sm"
            onClick={() =>
              setSaveAsModal({
                open: true,
                defaultName: loadedTree
                  ? `${loadedTree.name} (copy)`
                  : forStudentId && forStudentName
                    ? `${forStudentName} — personal track`
                    : 'New skill tree',
              })
            }
            title={
              forStudentId
                ? `Create a new tree and assign it as ${forStudentName ?? "this student"}'s personal pick`
                : 'Create a new tree from the current sequence'
            }
          >
            <Icon name="plus" size={12} />
            {forStudentId ? 'Save & assign to student…' : 'Save as new tree…'}
          </Button>
        </div>
      </div>

      {/* ── Cohort assignment row ────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px dashed var(--border-subtle, #cbd5e1)',
          background: 'var(--bg-subtle, transparent)',
        }}
      >
        <span style={{ fontSize: 'var(--t-sm)' }}>
          {activeAssignment ? (
            <>
              <strong>{activeAssignment.skillTree.name}</strong> is active on this cohort.
              {loadedTree && loadedTree.id !== activeAssignment.skillTreeId && (
                <span className="muted"> (loaded a different tree to preview)</span>
              )}
            </>
          ) : (
            <>This cohort is using the default published sequence.</>
          )}
        </span>
        <div style={{ display: 'inline-flex', gap: 8 }}>
          {loadedTree && (
            <Button
              variant="primary"
              size="sm"
              onClick={onActivateOnCohort}
              disabled={
                !cohortId ||
                (activeAssignment != null && activeAssignment.skillTreeId === loadedTree.id)
              }
              title={
                activeAssignment?.skillTreeId === loadedTree.id
                  ? 'This tree is already active on this cohort'
                  : 'Make this tree the active sequence for this cohort'
              }
            >
              Activate on cohort
            </Button>
          )}
          {activeAssignment && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearCohortAssignment}
              title="Revert this cohort to the default published sequence"
            >
              Clear assignment
            </Button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid',
            borderColor:
              feedback.kind === 'error'
                ? 'var(--danger-500, #b91c1c)'
                : 'var(--peacock-500, #0e7490)',
            background:
              feedback.kind === 'error'
                ? 'color-mix(in oklab, var(--danger-500, #b91c1c) 12%, transparent)'
                : 'color-mix(in oklab, var(--peacock-500, #0e7490) 12%, transparent)',
            color: 'var(--text-primary, inherit)',
            fontSize: 'var(--t-sm)',
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* ── Lesson plan editor ───────────────────────────────────────── */}
      {planLessons.length === 0 ? (
        <EmptyState
          icon="tree"
          title="No lessons in this plan"
          description="Insert lessons from any track to start composing this tree."
          action={
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Icon name="plus" size={12} />}
              onClick={() => setInsertAt(0)}
            >
              Insert lesson
            </Button>
          }
        />
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {planLessons.map((lesson, idx) => (
            <li
              key={`${lesson.id}-${idx}`}
              draggable={canEditLoadedTree || !loadedTree}
              onDragStart={(e) => {
                setDraggingIndex(idx);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(idx));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingIndex !== null && draggingIndex !== idx) onReorder(draggingIndex, idx);
                setDraggingIndex(null);
              }}
              onDragEnd={() => setDraggingIndex(null)}
              style={{ opacity: draggingIndex === idx ? 0.5 : 1 }}
            >
              <div className="lesson-list-row" style={{ gridTemplateColumns: 'auto auto 1fr auto auto auto auto' }}>
                <span className="outline-handle" aria-hidden style={{ cursor: 'grab' }}>
                  <Icon name="drag" size={14} />
                </span>
                <span className="outline-index">{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => onOpenLessonInBuilder(lesson.id)}
                  disabled={openingLessonId !== null}
                  title="Open this lesson in the builder"
                  style={{
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    textAlign: 'left',
                    minWidth: 0,
                    cursor: openingLessonId === lesson.id ? 'wait' : 'pointer',
                    color: 'inherit',
                  }}
                >
                  <div className="lesson-row-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {lesson.title}
                    <Icon name="pencil" size={11} />
                  </div>
                  <div className="lesson-row-meta">
                    <span className="truncate">{lesson.summary || `v${lesson.version}`}</span>
                  </div>
                </button>
                <Badge tone="brand">{lesson.level}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenLessonInBuilder(lesson.id)}
                  disabled={openingLessonId !== null}
                  leadingIcon={<Icon name="pencil" size={12} />}
                  title="Edit this lesson in the builder"
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSwapAt(idx)}
                  leadingIcon={<Icon name="refresh" size={12} />}
                  disabled={loadedTree != null && !canEditLoadedTree}
                >
                  Swap
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label="Remove from plan"
                  onClick={() => onRemove(idx)}
                  disabled={loadedTree != null && !canEditLoadedTree}
                >
                  <Icon name="trash" size={12} />
                </Button>
              </div>
              <button
                type="button"
                className="block-divider"
                onClick={() => setInsertAt(idx + 1)}
                aria-label="Insert lesson here"
                disabled={loadedTree != null && !canEditLoadedTree}
              >
                <span className="block-divider-pill">
                  <Icon name="plus" size={10} />
                  Insert lesson
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <SwapLessonModal
        open={swapAt !== null || insertAt !== null}
        onClose={() => {
          setSwapAt(null);
          setInsertAt(null);
        }}
        onPick={onPickedLesson}
        alreadyInPlan={planSet}
      />

      {saveAsModal.open && (
        <SaveAsTreeModal
          defaultName={saveAsModal.defaultName}
          forStudentName={forStudentId ? forStudentName : null}
          onCancel={() => setSaveAsModal({ open: false })}
          onSubmit={onSaveAs}
        />
      )}
    </div>
  );
}

// ── TreesPanel ────────────────────────────────────────────────────────────

function TreesPanel({
  trees,
  loadedTreeId,
  myUserId,
  onLoadDefault,
  onLoadTree,
}: {
  trees: SkillTree[];
  loadedTreeId: string | null;
  myUserId: string | undefined;
  onLoadDefault: () => void;
  onLoadTree: (t: SkillTree) => void;
}) {
  const myTrees = trees.filter((t) => t.authorUserId === myUserId);
  const sharedTrees = trees.filter((t) => t.authorUserId !== myUserId);

  return (
    <section style={{ marginBottom: 24 }}>
      <Eyebrow style={{ marginBottom: 8 }}>Available trees</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          type="button"
          className="lesson-list-row"
          style={{
            width: '100%',
            cursor: 'pointer',
            gridTemplateColumns: '1fr auto auto',
            ...(loadedTreeId === null
              ? {
                  borderColor: 'color-mix(in oklch, var(--peacock-400) 50%, transparent)',
                  background: 'var(--brand-bg)',
                }
              : {}),
          }}
          onClick={onLoadDefault}
        >
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div className="lesson-row-title">Default published sequence</div>
            <div className="lesson-row-meta">
              <span>What students see when no tree is assigned</span>
            </div>
          </div>
          <Badge tone="success" dot>
            default
          </Badge>
          {loadedTreeId === null && (
            <Badge tone="brand" dot>
              loaded
            </Badge>
          )}
        </button>

        {myTrees.length > 0 && (
          <>
            <Eyebrow style={{ marginTop: 12, marginBottom: 4 }}>Your trees</Eyebrow>
            {myTrees.map((t) => (
              <TreeRow key={t.id} tree={t} loaded={loadedTreeId === t.id} onClick={() => onLoadTree(t)} owned />
            ))}
          </>
        )}

        {sharedTrees.length > 0 && (
          <>
            <Eyebrow style={{ marginTop: 12, marginBottom: 4 }}>Shared (public) trees</Eyebrow>
            {sharedTrees.map((t) => (
              <TreeRow key={t.id} tree={t} loaded={loadedTreeId === t.id} onClick={() => onLoadTree(t)} owned={false} />
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function TreeRow({
  tree,
  loaded,
  owned,
  onClick,
}: {
  tree: SkillTree;
  loaded: boolean;
  owned: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="lesson-list-row"
      style={{
        width: '100%',
        cursor: 'pointer',
        gridTemplateColumns: '1fr auto auto',
        ...(loaded
          ? {
              borderColor: 'color-mix(in oklch, var(--peacock-400) 50%, transparent)',
              background: 'var(--brand-bg)',
            }
          : {}),
      }}
      onClick={onClick}
    >
      <div style={{ minWidth: 0, textAlign: 'left' }}>
        <div className="lesson-row-title">{tree.name}</div>
        <div className="lesson-row-meta">
          <span>{tree.lessonIds.length} lesson{tree.lessonIds.length === 1 ? '' : 's'}</span>
          <span>·</span>
          <span>updated {new Date(tree.updatedAt).toLocaleDateString()}</span>
          {tree.description && (
            <>
              <span>·</span>
              <span className="truncate">{tree.description}</span>
            </>
          )}
        </div>
      </div>
      <Badge tone={tree.visibility === 'public' ? 'success' : 'default'} dot>
        {tree.visibility}
      </Badge>
      {loaded ? (
        <Badge tone="brand" dot>
          loaded
        </Badge>
      ) : (
        <span className="muted" style={{ fontSize: 'var(--t-xs)' }}>
          {owned ? 'yours' : 'shared'}
        </span>
      )}
    </button>
  );
}

// ── SaveAsTreeModal ──────────────────────────────────────────────────────

function SaveAsTreeModal({
  defaultName,
  forStudentName,
  onCancel,
  onSubmit,
}: {
  defaultName: string;
  forStudentName: string | null;
  onCancel: () => void;
  onSubmit: (name: string, description: string, visibility: SkillTreeVisibility) => Promise<void> | void;
}) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<SkillTreeVisibility>('private');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(name.trim(), description.trim(), visibility);
    } finally {
      setSubmitting(false);
    }
  }, [name, description, visibility, onSubmit]);

  return (
    <Modal
      open={true}
      onClose={onCancel}
      size="md"
      title={forStudentName ? `Save and assign to ${forStudentName}` : 'Save as new tree'}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="iridescent"
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
          >
            {forStudentName ? 'Create & assign' : 'Create tree'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Name" htmlFor="tree-name">
          <Input
            id="tree-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Accelerated Swift (4-week)"
          />
        </Field>
        <Field
          label="Description"
          htmlFor="tree-description"
          help="Optional. Helps other instructors recognise this tree."
        >
          <Textarea
            id="tree-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Field>
        <Field
          label="Visibility"
          htmlFor="tree-visibility"
          help={
            visibility === 'public'
              ? 'Any instructor can see and assign this tree to their cohorts. Only you can edit.'
              : 'Only you can see, edit, and assign this tree.'
          }
        >
          <Select
            id="tree-visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as SkillTreeVisibility)}
          >
            <option value="private">Private (only you)</option>
            <option value="public">Public (shareable with all instructors)</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
