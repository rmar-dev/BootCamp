/* global React */

// ===== Profile =====
const Profile = ({ track }) => {
  const heat = Array.from({ length: 26 * 7 }, (_, i) => {
    const seed = (Math.sin(i * 1.7) + 1) / 2;
    if (i > 26 * 7 - 14 && seed > 0.4) return 4;
    if (seed > 0.85) return 4;
    if (seed > 0.65) return 3;
    if (seed > 0.45) return 2;
    if (seed > 0.30) return 1;
    return 0;
  });

  const badges = [
    { icon: "trophy", title: "First lesson", desc: "Completed your first lesson", earned: true, when: "Apr 19, 2026" },
    { icon: "flame", title: "Week one", desc: "7-day streak", earned: true, when: "Apr 25, 2026" },
    { icon: "star", title: "Swift fundamentals", desc: "Mastered all 12 lessons", earned: true, when: "Apr 28, 2026" },
    { icon: "bolt", title: "Speed runner", desc: "5 lessons in a single day", earned: true, when: "Apr 30, 2026" },
    { icon: "code", title: "Compose master", desc: "Master all 24 Compose lessons", earned: false },
    { icon: "target", title: "Perfect week", desc: "100% on every quiz this week", earned: false },
  ];

  return (
    <div className="main">
      <div className="profile-head">
        <div className="row" style={{ gap: 24, alignItems: "center" }}>
          <div className="avatar avatar-lg" style={{ width: 96, height: 96, fontSize: 32 }}>JK</div>
          <div style={{ flex: 1 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Member since Mar 2026 · Level 3</div>
            <h1 className="h-display" style={{ fontSize: "var(--t-4xl)", marginBottom: 8 }}>Jordan Kim</h1>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="badge badge-iris"><span className="badge-dot"></span>Swift learner</span>
              <span className="badge badge-amber"><span className="badge-dot"></span>Kotlin learner</span>
              <span className="badge badge-mono">@jordan</span>
            </div>
          </div>
          <div className="row" style={{ gap: 32 }}>
            <div className="kpi"><div className="kpi-label">XP</div><div className="kpi-value mono peacock-text">1,240</div></div>
            <div className="kpi"><div className="kpi-label">Streak</div><div className="kpi-value mono">12 d</div></div>
            <div className="kpi"><div className="kpi-label">Badges</div><div className="kpi-value mono">4 / 18</div></div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24 }}>
        <div className="stack">
          {/* Heatmap */}
          <div className="card card-elevated">
            <div className="row-between" style={{ marginBottom: 16 }}>
              <div>
                <h3 className="h3">Practice activity</h3>
                <p className="muted" style={{ fontSize: "var(--t-sm)", marginTop: 4 }}>182 lessons over the past 26 weeks</p>
              </div>
              <div className="row" style={{ gap: 4, fontSize: "var(--t-xs)", color: "var(--text-3)" }}>
                <span>less</span>
                <span className="heat-cell" style={{ width: 12, height: 12 }}></span>
                <span className="heat-cell heat-1" style={{ width: 12, height: 12 }}></span>
                <span className="heat-cell heat-2" style={{ width: 12, height: 12 }}></span>
                <span className="heat-cell heat-3" style={{ width: 12, height: 12 }}></span>
                <span className="heat-cell heat-4" style={{ width: 12, height: 12 }}></span>
                <span>more</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateRows: "repeat(7, 1fr)", gridAutoFlow: "column", gridAutoColumns: "1fr", gap: 4 }}>
              {heat.map((v, i) => <div key={i} className={"heat-cell heat-" + v} style={{ aspectRatio: 1 }}></div>)}
            </div>
          </div>

          {/* Skills mastered */}
          <div className="card">
            <h3 className="h3" style={{ marginBottom: 16 }}>Skills mastered</h3>
            <div className="stack-tight">
              {[
                { name: "Swift fundamentals", level: 100, color: "var(--iris-400)" },
                { name: "SwiftUI views & state", level: 65, color: "var(--iris-400)" },
                { name: "Kotlin fundamentals", level: 100, color: "var(--amber-400)" },
                { name: "Compose · UI & state", level: 65, color: "var(--amber-400)" },
                { name: "Networking", level: 12, color: "var(--peacock-400)" },
              ].map((s, i) => (
                <div key={i}>
                  <div className="row-between" style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: "var(--t-sm)", fontWeight: 500 }}>{s.name}</span>
                    <span className="mono muted" style={{ fontSize: "var(--t-xs)" }}>{s.level}%</span>
                  </div>
                  <div className="bar"><div className="bar-fill" style={{ width: s.level + "%", background: s.color }}></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="card">
          <div className="row-between" style={{ marginBottom: 18 }}>
            <h3 className="h3">Badges</h3>
            <span className="muted mono" style={{ fontSize: "var(--t-xs)" }}>4 / 18 earned</span>
          </div>
          <div className="stack-tight">
            {badges.map((b, i) => (
              <div key={i} className="medal-row">
                <div className={"medal " + (b.earned ? "" : "locked")} style={{ width: 64, height: 64, fontSize: 24 }}>
                  <Icon name={b.icon} size={26} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{b.title}</div>
                  <div className="muted" style={{ fontSize: "var(--t-sm)" }}>{b.desc}</div>
                  <div className="mono" style={{ fontSize: "var(--t-2xs)", color: b.earned ? "var(--peacock-300)" : "var(--text-3)", marginTop: 4 }}>
                    {b.earned ? "Earned " + b.when : "Locked"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== Leaderboard =====
const Leaderboard = ({ track }) => {
  const data = [
    { rank: 1, name: "Maya Okafor", xp: 4280, init: "MO", track: "swift", streak: 28 },
    { rank: 2, name: "Tarun Patel", xp: 3940, init: "TP", track: "kotlin", streak: 21 },
    { rank: 3, name: "Saga Lindqvist", xp: 3210, init: "SL", track: "swift", streak: 19 },
    { rank: 4, name: "Diego Rivas", xp: 2880, init: "DR", track: "kotlin", streak: 17 },
    { rank: 5, name: "Aiko Tanaka", xp: 2100, init: "AT", track: "swift", streak: 14 },
    { rank: 6, name: "Felix Brun", xp: 1690, init: "FB", track: "kotlin", streak: 11 },
    { rank: 7, name: "Jordan Kim (you)", xp: 1240, init: "JK", track: track, you: true, streak: 12 },
    { rank: 8, name: "Hana Park", xp: 1080, init: "HP", track: "swift", streak: 9 },
    { rank: 9, name: "Eli Cohen", xp: 920, init: "EC", track: "kotlin", streak: 7 },
    { rank: 10, name: "Noor Hassan", xp: 780, init: "NH", track: "swift", streak: 5 },
  ];

  return (
    <div className="main main-narrow">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Weekly leaderboard · resets in 3d 14h</div>
          <h1 className="h-display">This week.</h1>
          <p className="muted" style={{ marginTop: 8, fontSize: "var(--t-lg)" }}>Top 10 climb to the next league. Currently in <span style={{ color: "var(--peacock-200)" }}>Sapphire league</span>.</p>
        </div>
        <div className="seg">
          <button className="seg-btn active">Weekly</button>
          <button className="seg-btn">Monthly</button>
          <button className="seg-btn">All-time</button>
        </div>
      </div>

      {/* Podium */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 16, marginBottom: 32, alignItems: "end" }}>
        {[data[1], data[0], data[2]].map((p, i) => {
          const heights = [180, 220, 160];
          const colors = ["var(--bg-3)", "var(--amber-400)", "var(--bg-3)"];
          const places = [2, 1, 3];
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div className="avatar avatar-lg" style={{ width: places[i] === 1 ? 80 : 64, height: places[i] === 1 ? 80 : 64, background: places[i] === 1 ? "var(--grad-peacock)" : p.track === "swift" ? "var(--iris-400)" : "var(--amber-400)", fontSize: places[i] === 1 ? 24 : 18 }}>{p.init}</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div className="mono" style={{ fontSize: "var(--t-sm)", color: "var(--peacock-200)", fontWeight: 700 }}>{p.xp.toLocaleString()} XP</div>
              </div>
              <div style={{
                width: "100%", height: heights[i],
                background: places[i] === 1 ? "linear-gradient(180deg, var(--amber-400), color-mix(in oklch, var(--amber-400) 40%, var(--bg-2)))" : "linear-gradient(180deg, var(--bg-3), var(--bg-2))",
                borderRadius: "var(--r-lg) var(--r-lg) 0 0",
                border: "1px solid var(--line-2)",
                borderBottom: 0,
                display: "grid", placeItems: "center",
                fontFamily: "var(--font-display, var(--font-sans))",
                fontSize: places[i] === 1 ? 64 : 48, fontWeight: 800,
                color: places[i] === 1 ? "#2b1700" : "var(--text-3)",
              }}>{places[i]}</div>
            </div>
          );
        })}
      </div>

      <div className="card card-elevated">
        <div className="stack-tight">
          {data.slice(3).map((r, i) => (
            <div key={i} className={"lb-row " + (r.you ? "you" : "")}>
              <div className="lb-rank">{r.rank}</div>
              <div className="row" style={{ gap: 12 }}>
                <div className="avatar avatar-sm" style={{ background: r.track === "swift" ? "var(--iris-400)" : "var(--amber-400)" }}>{r.init}</div>
                <div>
                  <div style={{ fontSize: "var(--t-sm)", fontWeight: r.you ? 600 : 500 }}>{r.name}</div>
                  <div className="mono muted" style={{ fontSize: "var(--t-2xs)", marginTop: 2 }}>
                    <Icon name="flame" size={10} style={{ display: "inline", verticalAlign: "middle", color: "var(--amber-400)" }} /> {r.streak}d streak
                  </div>
                </div>
              </div>
              <span className="mono" style={{ fontSize: "var(--t-sm)", fontWeight: 600 }}>{r.xp.toLocaleString()} XP</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

window.Profile = Profile;
window.Leaderboard = Leaderboard;
