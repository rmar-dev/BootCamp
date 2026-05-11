export function HeatStrip({ cells }: { cells: ReadonlyArray<number> }) {
  const active = cells.filter((c) => c > 0).length;
  return (
    <div
      className="heat"
      aria-label={`${active} active days in the past 26 weeks`}
      style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gridAutoFlow: 'column', gridAutoColumns: '1fr', gap: 4 }}
    >
      {cells.map((v, i) => (
        <div key={i} className={`heat-cell${v > 0 ? ` heat-${v}` : ''}`} style={{ aspectRatio: 1 }} />
      ))}
    </div>
  );
}
