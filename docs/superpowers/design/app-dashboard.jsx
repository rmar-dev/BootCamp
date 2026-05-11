/* global React */
const { useState: useS1 } = React;

// ===== Dashboard =====
const Dashboard = ({ track, setRoute }) => {
  const trackData = track === "swift" ? {
    label: "Swift", color: "var(--iris-400)", course: "iOS Development with SwiftUI",
    nextLesson: { num: "08", title: "State, Bindings, and the @State property wrapper", mins: 6, type: "Concept + quiz" },
  } : {
    label: "Kotlin", color: "var(--amber-400)", course: "Android Development with Jetpack Compose",
    nextLesson: { num: "08", title: "Coroutines: launch vs async, when to use which", mins: 8, type: "Code + tests" },
  };

  const recent = track === "swift" ? [
    { type: "concept", icon: "book", title: "Optionals & nil-coalescing", meta: "Lesson 06 · 5 min", state: "completed" },
    { type: "code",    icon: "code", title: "Build a tip calculator", meta: "Project · 18 min", state: "completed" },
    { type: "concept", icon: "book", title: "Closures as last argument", meta: "Lesson 07 · 4 min", state: "completed" },
  ] : [
    { type: "concept", icon: "book", title: "Null safety: ?., !!, let", meta: "Lesson 06 · 5 min", state: "completed" },
    { type: "code",    icon: "code", title: "Data classes & destructuring", meta: "Lesson 07 · 7 min", state: "completed" },
    { type: "concept", icon: "book", title: "Sealed classes for state", meta: "Lesson 08 · 6 min", state: "completed" },
  ];

  const upNext = track === "swift" ? [
    { icon: "play", title: "State, Bindings, and @State", meta: "Concept · 6 min", chip: "next" },
    { icon: "target", title: "Build a settings screen", meta: "Project · 22 min" },
    { icon: "code", title: "ObservableObject in practice", meta: "Code lab · 12 min" },
    { icon: "book", title: "Navigation with NavigationStack", meta: "Concept · 8 min" },
  ] : [
    { icon: "play", title: "Launch vs async", meta: "Concept · 8 min", chip: "next" },
    { icon: "target", title: "Build a network-aware list", meta: "Project · 24 min" },
    { icon: "code", title: "Flow & StateFlow", meta: "Code lab · 14 min" },
    { icon: "book", title: "Compose state hoisting", meta: "Concept · 7 min" },
  ];

  const paths = [
    { name: track === "swift" ? "SwiftUI fundamentals" : "Compose fundamentals", progress: 70, total: 24, done: 17, color: trackData.color },
    { name: track === "swift" ? "Networking with URLSession" : "Networking with Ktor", progress: 33, total: 18, done: 6, color: trackData.color },
    { name: track === "swift" ? "Core Data essentials" : "Room database", progress: 12, total: 16, done: 2, color: trackData.color },
    { name: "Algorithms in " + (track === "swift" ? "Swift" : "Kotlin"), progress: 0, total: 30, done: 0, locked: true, color: trackData.color },
  ];

  return (
    <div className="main">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{trackData.course}</div>
          <h1 className="h-display">Welcome back, Jordan.</h1>
          <p className="muted" style={{ marginTop: 8, fontSize: "var(--t-lg)" }}>You're 3 lessons away from your next badge.</p>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <button className="btn btn-ghost"><Icon name="refresh" size={14} />Restart streak insurance</button>
          <button className="btn btn-iridescent btn-lg" onClick={() => setRoute("lesson")}>
            <Icon name="play" size={14} /> Continue lesson 08
          </button>
        </div>
      </div>

      {/* Daily strip */}
      <div className="daily">
        <div className="daily-grid">
          <div>
            <div className="eyebrow" style={{ marginBottom: 10, color: "var(--peacock-200)" }}>Today's plan · 30 min</div>
            <h2 className="h2" style={{ marginBottom: 10 }}>{trackData.nextLesson.title}</h2>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="badge badge-mono">L{trackData.nextLesson.num}</span>
              <span className="badge">{trackData.nextLesson.type}</span>
              <span className="badge"><span className="badge-dot"></span>{trackData.nextLesson.mins} min</span>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Streak</div>
            <div className="kpi-value mono"><Icon name="flame" size={24} style={{ color: "var(--amber-400)", marginRight: 8 }} />12</div>
            <div className="kpi-delta">+1 today</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Daily XP</div>
            <div className="kpi-value mono peacock-text">18 / 20</div>
            <div className="bar bar-thin" style={{ marginTop: 8 }}><div className="bar-fill" style={{ width: "90%" }}></div></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Mastery</div>
            <div className="kpi-value mono">L3</div>
            <div className="kpi-delta muted" style={{ color: "var(--text-3)" }}>540 XP to L4</div>
          </div>
        </div>
      </div>

      {/* Two column: Up next + Paths */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, marginTop: 32 }}>
        <div className="stack">
          <div className="row-between">
            <h3 className="h3">Up next</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setRoute("tree")}>View skill tree<Icon name="chevR" size={14} /></button>
          </div>
          <div className="stack-tight">
            {upNext.map((u, i) => (
              <div key={i} className="lesson-row" onClick={() => setRoute("lesson")}>
                <div className="lesson-icon" style={i === 0 ? { background: trackData.color, color: "#0a0a0a", borderColor: trackData.color } : {}}>
                  <Icon name={u.icon} size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{u.title}</div>
                  <div className="muted mono" style={{ fontSize: "var(--t-xs)" }}>{u.meta}</div>
                </div>
                {u.chip && <span className="badge badge-brand"><span className="badge-dot"></span>Next</span>}
                <Icon name="chevR" size={16} style={{ color: "var(--text-3)" }} />
              </div>
            ))}
          </div>

          <div className="row-between" style={{ marginTop: 20 }}>
            <h3 className="h3">Recently completed</h3>
            <span className="muted" style={{ fontSize: "var(--t-sm)" }}>This week</span>
          </div>
          <div className="stack-tight">
            {recent.map((r, i) => (
              <div key={i} className="lesson-row completed">
                <div className="lesson-icon"><Icon name="check" size={22} /></div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{r.title}</div>
                  <div className="muted mono" style={{ fontSize: "var(--t-xs)" }}>{r.meta}</div>
                </div>
                <span className="badge badge-success"><span className="badge-dot"></span>Done</span>
                <Icon name="chevR" size={16} style={{ color: "var(--text-3)" }} />
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <h3 className="h3">Your paths</h3>
          <div className="stack-tight">
            {paths.map((p, i) => (
              <div key={i} className="card" style={{ opacity: p.locked ? 0.55 : 1 }}>
                <div className="row-between" style={{ marginBottom: 10 }}>
                  <div className="row" style={{ gap: 10 }}>
                    {p.locked ? <Icon name="lock" size={16} style={{ color: "var(--text-3)" }} /> : <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }}></span>}
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                  </div>
                  <span className="mono muted" style={{ fontSize: "var(--t-xs)" }}>{p.done}/{p.total}</span>
                </div>
                <div className="bar"><div className="bar-fill" style={{ width: p.progress + "%", background: p.locked ? "var(--bg-3)" : `linear-gradient(90deg, ${p.color}, var(--peacock-300))` }}></div></div>
              </div>
            ))}
          </div>

          {/* Mini leaderboard preview */}
          <div className="card card-elevated" style={{ marginTop: 8 }}>
            <div className="row-between" style={{ marginBottom: 14 }}>
              <h4 className="h4">This week's leaderboard</h4>
              <button className="btn btn-ghost btn-sm" onClick={() => setRoute("leaderboard")}>See all</button>
            </div>
            <div className="stack-tight">
              {[
                { rank: 1, name: "M. Okafor", xp: 4280, top: true, init: "MO" },
                { rank: 2, name: "T. Patel", xp: 3940, init: "TP" },
                { rank: 3, name: "S. Lindqvist", xp: 3210, init: "SL" },
                { rank: 7, name: "Jordan Kim (you)", xp: 1240, you: true, init: "JK" },
              ].map((r, i) => (
                <div key={i} className={"lb-row " + (r.you ? "you" : "")}>
                  <div className={"lb-rank " + (r.top ? "top" : "")}>{r.rank}</div>
                  <div className="row" style={{ gap: 10 }}>
                    <div className="avatar avatar-sm" style={r.top ? { background: "var(--amber-400)" } : {}}>{r.init}</div>
                    <span style={{ fontSize: "var(--t-sm)", fontWeight: r.you ? 600 : 500 }}>{r.name}</span>
                  </div>
                  <span className="mono" style={{ fontSize: "var(--t-sm)", fontWeight: 600 }}>{r.xp.toLocaleString()} XP</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.Dashboard = Dashboard;
