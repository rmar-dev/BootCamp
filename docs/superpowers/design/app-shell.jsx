/* global React */
const { useState, useEffect, useRef } = React;

// ===== Icons (inline SVG, sized via props) =====
const Icon = ({ name, size = 18, className = "", style = {} }) => {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    home: <><path d="M3 11l9-8 9 8" {...stroke} /><path d="M5 10v10h14V10" {...stroke} /></>,
    tree: <><circle cx="6" cy="6" r="2.5" {...stroke} /><circle cx="18" cy="6" r="2.5" {...stroke} /><circle cx="12" cy="18" r="2.5" {...stroke} /><path d="M6 8.5v3a3 3 0 003 3h6a3 3 0 003-3v-3" {...stroke} /><path d="M12 14.5V18" {...stroke} /></>,
    play: <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" />,
    user: <><circle cx="12" cy="8" r="4" {...stroke} /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...stroke} /></>,
    trophy: <><path d="M7 4h10v4a5 5 0 01-10 0V4z" {...stroke} /><path d="M7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3" {...stroke} /><path d="M9 14h6l-1 4h-4l-1-4zM7 20h10" {...stroke} /></>,
    bookmark: <path d="M6 3h12v18l-6-4-6 4V3z" {...stroke} />,
    settings: <><circle cx="12" cy="12" r="3" {...stroke} /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" {...stroke} /></>,
    flame: <path d="M12 3c1 4 5 4 5 9a5 5 0 11-10 0c0-2 1-3 2-4-1 4 3 4 3-5z" {...stroke} />,
    bolt: <polygon points="13 2 4 14 11 14 9 22 20 10 13 10 13 2" {...stroke} />,
    check: <polyline points="5 12 10 17 19 7" {...stroke} strokeWidth="2.5" />,
    chevR: <polyline points="9 6 15 12 9 18" {...stroke} />,
    chevL: <polyline points="15 6 9 12 15 18" {...stroke} />,
    star: <polygon points="12 3 14.5 9.5 21 10 16 14.5 17.5 21 12 17.5 6.5 21 8 14.5 3 10 9.5 9.5" {...stroke} fill="currentColor" />,
    lock: <><rect x="4" y="11" width="16" height="10" rx="2" {...stroke} /><path d="M8 11V7a4 4 0 018 0v4" {...stroke} /></>,
    code: <><polyline points="9 8 4 12 9 16" {...stroke} /><polyline points="15 8 20 12 15 16" {...stroke} /></>,
    grid: <><rect x="4" y="4" width="7" height="7" rx="1" {...stroke} /><rect x="13" y="4" width="7" height="7" rx="1" {...stroke} /><rect x="4" y="13" width="7" height="7" rx="1" {...stroke} /><rect x="13" y="13" width="7" height="7" rx="1" {...stroke} /></>,
    book: <><path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4V4z" {...stroke} /><path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7V4z" {...stroke} /></>,
    target: <><circle cx="12" cy="12" r="9" {...stroke} /><circle cx="12" cy="12" r="5" {...stroke} /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
    search: <><circle cx="11" cy="11" r="7" {...stroke} /><path d="m21 21-4.3-4.3" {...stroke} /></>,
    plus: <><path d="M12 5v14M5 12h14" {...stroke} /></>,
    arrowR: <><path d="M5 12h14M13 6l6 6-6 6" {...stroke} /></>,
    refresh: <><path d="M3 12a9 9 0 0115-6.7L21 8M21 12a9 9 0 01-15 6.7L3 16" {...stroke} /><polyline points="21 3 21 8 16 8" {...stroke} /><polyline points="3 21 3 16 8 16" {...stroke} /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>{paths[name]}</svg>;
};

// ===== Logo =====
const Logo = ({ size = "" }) => (
  <div className={"logo " + size}>
    <span className="logo-mark"></span>
    <span>BootCamp</span>
  </div>
);

// ===== Sidebar =====
const Sidebar = ({ route, setRoute, track }) => {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "tree", label: "Skill tree", icon: "tree" },
    { id: "lesson", label: "Continue lesson", icon: "play", badge: <span className="badge badge-brand">Day 12</span> },
    { id: "ide", label: "Class lab · IDE", icon: "code" },
    { id: "profile", label: "Profile", icon: "user" },
    { id: "leaderboard", label: "Leaderboard", icon: "trophy" },
  ];
  const sub = [
    { id: "saved", label: "Saved", icon: "bookmark" },
    { id: "ds", label: "Design system ↗", icon: "grid", href: "Design System.html" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];
  return (
    <aside className="side">
      <div style={{ padding: "0 4px 12px" }}><Logo size="logo-sm" /></div>

      <div style={{ padding: "12px", border: "1px solid var(--line-1)", borderRadius: "var(--r-md)", marginBottom: "8px", background: "var(--bg-1)" }}>
        <div className="eyebrow" style={{ marginBottom: "8px" }}>Active track</div>
        <div className="row" style={{ gap: "10px" }}>
          <span className={`badge ${track === "swift" ? "badge-iris" : "badge-amber"}`}><span className="badge-dot"></span>{track === "swift" ? "Swift" : "Kotlin"}</span>
          <span className="muted mono" style={{ fontSize: "var(--t-xs)", marginLeft: "auto" }}>L3 · 1240 XP</span>
        </div>
      </div>

      {items.map(it => (
        <div key={it.id} className={`side-link ${route === it.id ? "active" : ""}`} onClick={() => setRoute(it.id)}>
          <Icon name={it.icon} size={18} className="side-icon" />
          <span>{it.label}</span>
          {it.badge}
        </div>
      ))}

      <div className="side-section">More</div>
      {sub.map(it => it.href ? (
        <a key={it.id} className="side-link" href={it.href}>
          <Icon name={it.icon} size={18} className="side-icon" />
          <span>{it.label}</span>
        </a>
      ) : (
        <div key={it.id} className="side-link">
          <Icon name={it.icon} size={18} className="side-icon" />
          <span>{it.label}</span>
        </div>
      ))}

      <div style={{ marginTop: "auto", padding: "12px", borderRadius: "var(--r-md)", background: "var(--bg-2)", border: "1px solid var(--line-1)" }}>
        <div className="row" style={{ gap: "10px" }}>
          <div className="avatar avatar-sm">JK</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "var(--t-sm)", fontWeight: 600 }}>Jordan Kim</div>
            <div className="mono muted" style={{ fontSize: "var(--t-2xs)" }}>jordan@bootcamp.dev</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

// ===== Topbar =====
const Topbar = ({ track, setTrack, hearts = 5 }) => (
  <div className="topbar">
    <div className="search" style={{ position: "relative", flex: 1, maxWidth: 480 }}>
      <Icon name="search" size={16} />
      <input className="input input-search" placeholder="Search lessons, paths, badges…" />
      <kbd className="mono" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: "var(--t-2xs)", color: "var(--text-3)", border: "1px solid var(--line-2)", borderRadius: 4, padding: "2px 6px" }}>⌘K</kbd>
    </div>
    <div className="seg">
      <button className={`seg-btn ${track === "swift" ? "active swift" : ""}`} onClick={() => setTrack("swift")}>Swift</button>
      <button className={`seg-btn ${track === "kotlin" ? "active kotlin" : ""}`} onClick={() => setTrack("kotlin")}>Kotlin</button>
    </div>
    <div className="row" style={{ gap: 14, marginLeft: "auto" }}>
      <div className="row" style={{ gap: 6 }}>
        <Icon name="flame" size={16} style={{ color: "var(--amber-400)" }} />
        <span className="mono" style={{ fontWeight: 700 }}>12</span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <Icon name="bolt" size={16} style={{ color: "var(--peacock-300)" }} />
        <span className="mono" style={{ fontWeight: 700 }}>1,240</span>
      </div>
      <div className="hearts" aria-label="Hearts">
        {[0,1,2,3,4].map(i => (
          <svg key={i} className={"heart " + (i < hearts ? "" : "empty")} viewBox="0 0 24 24" width={16} height={16}>
            <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6 5c2 0 3.5 1 4.5 2.5C11.5 6 13 5 15 5c3.5 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z" fill="currentColor"/>
          </svg>
        ))}
      </div>
      <button className="btn btn-icon btn-sm" aria-label="Settings"><Icon name="settings" size={16} /></button>
    </div>
  </div>
);

Object.assign(window, { Icon, Logo, Sidebar, Topbar });
