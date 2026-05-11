'use client';

const BLOCK = { background: 'var(--bg-3)', borderRadius: 4 } as const;
const CIRCLE = { background: 'var(--bg-3)', borderRadius: '50%' } as const;

export function TreeSkeleton() {
  return (
    <div className="tree-wrap" data-testid="tree-skeleton" aria-busy="true">
      {[0, 1, 2].map((s) => (
        <div className="tree-section" key={s}>
          <div className="tree-section-head">
            <div style={{ ...CIRCLE, width: 48, height: 48 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ ...BLOCK, width: '60%', height: 18 }} />
              <div style={{ ...BLOCK, width: '30%', height: 12 }} />
            </div>
            <div style={{ ...BLOCK, width: 160, height: 14 }} />
          </div>
          <div className="tree-track">
            {[0, 1, 2, 3].map((r) => {
              const offset = (r % 2 === 0 ? -90 : 90) + Math.sin(r) * 20;
              return (
                <div className="tree-row" key={r}>
                  <div
                    style={{
                      transform: `translateX(${offset}px)`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                    }}
                  >
                    <div style={{ ...CIRCLE, width: 64, height: 64 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ ...BLOCK, width: 140, height: 14 }} />
                      <div style={{ ...BLOCK, width: 80, height: 10 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
