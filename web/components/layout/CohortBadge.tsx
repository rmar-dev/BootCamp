type Props = { cohortLength: 'four_week' | 'twelve_week' | null };

export function CohortBadge({ cohortLength }: Props) {
  if (!cohortLength) return null;
  const label = cohortLength === 'four_week' ? '4-week cohort' : '12-week cohort';
  return (
    <span className="inline-flex items-center rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
      {label}
    </span>
  );
}
