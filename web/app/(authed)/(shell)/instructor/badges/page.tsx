'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge as BadgeChip,
  Button,
  EmptyState,
  Field,
  Heading,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import {
  awardBadge,
  createBadge,
  deleteBadge,
  listInstructorBadges,
  type Badge as BadgeRow,
  type BadgeScopeKind,
  type CreateBadgeInput,
} from '@/lib/instructor-badges';
import { fetchRoster, type RosterEntry } from '@/lib/students';

type CriteriaKind = CreateBadgeInput['criteriaKind'];

const CRITERIA_OPTIONS: Array<{ value: CriteriaKind; label: string; help: string }> = [
  {
    value: 'manual_award',
    label: 'Manual award',
    help: 'You grant this badge by hand to specific students.',
  },
  {
    value: 'points_threshold',
    label: 'Points threshold',
    help: 'Auto-awarded when a student\'s total points cross the threshold.',
  },
  {
    value: 'streak_threshold',
    label: 'Streak threshold',
    help: 'Auto-awarded when a student\'s daily streak reaches the threshold.',
  },
  {
    value: 'exercises_passed',
    label: 'Exercises passed',
    help: 'Auto-awarded when a student passes the threshold number of exercises.',
  },
];

const SCOPE_OPTIONS: Array<{ value: BadgeScopeKind; label: string }> = [
  { value: 'public', label: 'Public — every student' },
  { value: 'cohort', label: 'Cohort — students in a specific cohort' },
  { value: 'track', label: 'Track — students enrolled in a track' },
  { value: 'private_to_student', label: 'Private — a single student' },
];

const initialForm: CreateBadgeInput = {
  name: '',
  description: '',
  icon: '🏅',
  criteriaKind: 'manual_award',
  thresholdValue: null,
  scopeKind: 'public',
  scopeId: null,
};

export default function InstructorBadgesPage() {
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateBadgeInput>(initialForm);
  const [saving, setSaving] = useState(false);
  const [awardOpenFor, setAwardOpenFor] = useState<string | null>(null);
  const [awardStudentId, setAwardStudentId] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [bs, rs] = await Promise.all([listInstructorBadges(), fetchRoster()]);
      setBadges(bs);
      setRoster(rs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const criteriaHelp = useMemo(
    () => CRITERIA_OPTIONS.find((c) => c.value === form.criteriaKind)?.help ?? '',
    [form.criteriaKind],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: CreateBadgeInput = {
        ...form,
        thresholdValue:
          form.criteriaKind === 'manual_award' ? null : Number(form.thresholdValue ?? 0),
        scopeId: form.scopeKind === 'public' ? null : form.scopeId ?? null,
      };
      await createBadge(payload);
      setForm(initialForm);
      setToast('Badge created');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (badgeId: string) => {
    if (!confirm('Delete this badge? Existing awards to students will also be removed.')) return;
    try {
      await deleteBadge(badgeId);
      setToast('Badge deleted');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const onAward = async (badgeId: string) => {
    if (!awardStudentId) return;
    try {
      const r = await awardBadge(badgeId, awardStudentId);
      setToast(r.awarded ? 'Badge granted' : 'Student already had this badge');
      setAwardOpenFor(null);
      setAwardStudentId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Award failed');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 28px 80px' }}>
      <header style={{ marginBottom: 24 }}>
        <Heading level="h1" style={{ marginBottom: 4 }}>
          Badges
        </Heading>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--t-md)' }}>
          Author achievements your students can earn. {badges.length} authored.
        </p>
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
      {toast && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--success-500, #15803d)',
            background: 'color-mix(in oklab, var(--success-500, #15803d) 12%, transparent)',
            fontSize: 'var(--t-sm)',
          }}
          onClick={() => setToast(null)}
        >
          {toast}
        </div>
      )}

      <section style={{ marginBottom: 32 }}>
        <Heading level="h2" style={{ marginBottom: 12, fontSize: 18 }}>
          Create a badge
        </Heading>
        <form
          onSubmit={onSubmit}
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: '1fr 1fr',
            padding: 16,
            border: '1px solid var(--neutral-200, #e5e7eb)',
            borderRadius: 12,
          }}
        >
          <Field label="Name">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Hard Worker"
            />
          </Field>
          <Field label="Icon (emoji)">
            <Input
              required
              maxLength={4}
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="🏅"
            />
          </Field>
          <Field label="Description" style={{ gridColumn: '1 / -1' }}>
            <Textarea
              required
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does the student have to do to earn this?"
            />
          </Field>
          <Field label="Criteria" help={criteriaHelp}>
            <Select
              value={form.criteriaKind}
              onChange={(e) =>
                setForm({ ...form, criteriaKind: e.target.value as CriteriaKind })
              }
              options={CRITERIA_OPTIONS.map((c) => ({ value: c.value, label: c.label }))}
            />
          </Field>
          <Field label="Threshold" help="Required for points/streak/exercises criteria.">
            <Input
              type="number"
              min={1}
              disabled={form.criteriaKind === 'manual_award'}
              value={form.thresholdValue ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  thresholdValue: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              placeholder={form.criteriaKind === 'manual_award' ? 'n/a' : 'e.g. 250'}
            />
          </Field>
          <Field label="Scope">
            <Select
              value={form.scopeKind}
              onChange={(e) =>
                setForm({ ...form, scopeKind: e.target.value as BadgeScopeKind, scopeId: null })
              }
              options={SCOPE_OPTIONS}
            />
          </Field>
          <Field label="Scope target ID" help="Cohort/track/student UUID. Leave empty for public.">
            <Input
              disabled={form.scopeKind === 'public'}
              value={form.scopeId ?? ''}
              onChange={(e) => setForm({ ...form, scopeId: e.target.value || null })}
              placeholder={form.scopeKind === 'public' ? 'n/a' : 'UUID'}
            />
          </Field>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="primary" size="md" disabled={saving}>
              {saving ? 'Creating…' : 'Create badge'}
            </Button>
          </div>
        </form>
      </section>

      <section>
        <Heading level="h2" style={{ marginBottom: 12, fontSize: 18 }}>
          Your badges
        </Heading>
        {badges.length === 0 ? (
          <EmptyState
            icon="trophy"
            title="No badges yet"
            description="Use the form above to create your first badge."
          />
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {badges.map((b) => (
              <li
                key={b.id}
                style={{
                  padding: 12,
                  border: '1px solid var(--neutral-200, #e5e7eb)',
                  borderRadius: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{b.icon}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{b.description}</div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <BadgeChip tone="default">{b.criteriaKind}</BadgeChip>
                      {b.thresholdValue != null && <BadgeChip tone="default">≥ {b.thresholdValue}</BadgeChip>}
                      <BadgeChip tone={b.scopeKind === 'public' ? 'default' : 'amber'}>{b.scopeKind}</BadgeChip>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {b.criteriaKind === 'manual_award' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setAwardOpenFor(awardOpenFor === b.id ? null : b.id);
                          setAwardStudentId('');
                        }}
                      >
                        Award
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onDelete(b.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                {awardOpenFor === b.id && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <Field label="Award to" style={{ flex: 1 }}>
                      <Select
                        value={awardStudentId}
                        onChange={(e) => setAwardStudentId(e.target.value)}
                        options={[
                          { value: '', label: '— pick a student —' },
                          ...roster.map((r) => ({ value: r.id, label: `${r.name} (${r.email})` })),
                        ]}
                      />
                    </Field>
                    <Button variant="primary" size="sm" disabled={!awardStudentId} onClick={() => onAward(b.id)}>
                      Confirm
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
