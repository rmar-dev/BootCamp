/* global React */

// ===== Skill Tree =====
const SkillTree = ({ track, setRoute }) => {
  const trackTint = track === "swift" ? "tint-swift" : "tint-kotlin";
  const trackBadge = track === "swift" ? "badge-iris" : "badge-amber";
  const trackName = track === "swift" ? "Swift" : "Kotlin";

  const sections = track === "swift" ? [
    {
      title: "Swift fundamentals",
      meta: "12 lessons · ~2 hours",
      progress: 100,
      done: true,
      nodes: [
        { state: "completed", icon: "check", label: "Variables & types" },
        { state: "completed", icon: "check", label: "Optionals" },
        { state: "completed", icon: "check", label: "Closures" },
        { state: "completed", icon: "check", label: "Structs & classes" },
      ],
    },
    {
      title: "SwiftUI · Views & state",
      meta: "10 lessons · ~3 hours",
      progress: 65,
      nodes: [
        { state: "completed", icon: "check", label: "View protocol" },
        { state: "completed", icon: "check", label: "VStack & HStack" },
        { state: "completed", icon: "check", label: "Modifiers" },
        { state: "current", icon: "play", label: "@State property" },
        { state: "available", icon: "play", label: "@Binding" },
        { state: "available", icon: "play", label: "Build a form" },
      ],
    },
    {
      title: "Networking & data",
      meta: "8 lessons · ~3 hours",
      progress: 0,
      locked: true,
      nodes: [
        { state: "locked", icon: "lock", label: "URLSession" },
        { state: "locked", icon: "lock", label: "Codable" },
        { state: "locked", icon: "lock", label: "Async/await" },
        { state: "locked", icon: "lock", label: "Build a weather app" },
      ],
    },
  ] : [
    {
      title: "Kotlin fundamentals",
      meta: "12 lessons · ~2 hours",
      progress: 100,
      done: true,
      nodes: [
        { state: "completed", icon: "check", label: "val vs var" },
        { state: "completed", icon: "check", label: "Null safety" },
        { state: "completed", icon: "check", label: "Lambdas" },
        { state: "completed", icon: "check", label: "Data classes" },
      ],
    },
    {
      title: "Compose · UI & state",
      meta: "10 lessons · ~3 hours",
      progress: 65,
      nodes: [
        { state: "completed", icon: "check", label: "Composable fn" },
        { state: "completed", icon: "check", label: "Column & Row" },
        { state: "completed", icon: "check", label: "Modifiers" },
        { state: "current", icon: "play", label: "remember & state" },
        { state: "available", icon: "play", label: "State hoisting" },
        { state: "available", icon: "play", label: "Build a form" },
      ],
    },
    {
      title: "Coroutines & flow",
      meta: "8 lessons · ~3 hours",
      progress: 0,
      locked: true,
      nodes: [
        { state: "locked", icon: "lock", label: "launch vs async" },
        { state: "locked", icon: "lock", label: "Dispatchers" },
        { state: "locked", icon: "lock", label: "Flow basics" },
        { state: "locked", icon: "lock", label: "Build a chat app" },
      ],
    },
  ];

  return (
    <div className="main main-narrow">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Skill tree · {trackName} track</div>
          <h1 className="h-display">Your path forward.</h1>
          <p className="muted" style={{ marginTop: 8, fontSize: "var(--t-lg)" }}>Sections unlock as you master the previous one. Tap any node to begin.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className={"badge " + trackBadge}><span className="badge-dot"></span>{trackName}</span>
          <span className="badge"><span className="badge-dot"></span>26 of 78 lessons</span>
        </div>
      </div>

      <div className="tree-wrap">
        {sections.map((s, si) => (
          <div key={si} className="tree-section">
            <div className="tree-section-head">
              <div className="lesson-icon" style={{
                background: s.done ? "color-mix(in oklch, var(--success-400) 22%, var(--bg-2))" : s.locked ? "var(--bg-2)" : "var(--bg-3)",
                color: s.done ? "var(--success-400)" : s.locked ? "var(--text-3)" : "var(--text-1)",
                borderColor: s.done ? "color-mix(in oklch, var(--success-400) 40%, transparent)" : "var(--line-2)",
              }}>
                <Icon name={s.done ? "check" : s.locked ? "lock" : "book"} size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="h3">{s.title}</h3>
                <div className="muted mono" style={{ fontSize: "var(--t-xs)", marginTop: 4 }}>{s.meta}</div>
              </div>
              <div style={{ width: 160 }}>
                <div className="bar"><div className="bar-fill" style={{ width: s.progress + "%" }}></div></div>
                <div className="mono muted" style={{ fontSize: "var(--t-xs)", textAlign: "right", marginTop: 6 }}>{s.progress}%</div>
              </div>
            </div>

            <div className={"tree-track " + trackTint}>
              {s.nodes.map((n, ni) => {
                const offset = (ni % 2 === 0 ? -90 : 90) + (Math.sin(ni) * 20);
                return (
                  <div key={ni} className="tree-row">
                    <div style={{ transform: `translateX(${offset}px)`, position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
                      <div className={"node " + n.state} onClick={() => n.state !== "locked" && setRoute("lesson")}>
                        {n.state === "completed" && <Icon name="check" size={24} />}
                        {n.state === "current" && <Icon name="play" size={20} />}
                        {n.state === "available" && <Icon name="play" size={20} />}
                        {n.state === "locked" && <Icon name="lock" size={20} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "var(--t-sm)" }}>{n.label}</div>
                        <div className="mono muted" style={{ fontSize: "var(--t-2xs)", marginTop: 2 }}>
                          {n.state === "current" ? "In progress · 4 of 6" : n.state === "completed" ? "Mastered" : n.state === "available" ? "Tap to start" : "Locked"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Section milestone */}
              {!s.locked && (
                <div className="tree-row">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div className="medal" style={s.done ? {} : { filter: "grayscale(0.4)", opacity: 0.7 }}>
                      <Icon name="trophy" size={32} />
                    </div>
                    <div className="mono" style={{ fontSize: "var(--t-xs)", color: s.done ? "var(--amber-300)" : "var(--text-3)" }}>
                      {s.done ? "Badge earned" : "Section badge"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

window.SkillTree = SkillTree;
