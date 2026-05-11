/* global React */
const { useState: useSt, useEffect: useEf } = React;

// ===== Lesson Player — handles 5 lesson types =====
const LessonPlayer = ({ track, setRoute }) => {
  const [step, setStep] = useSt(0);
  const total = 5;
  const trackTint = track === "swift" ? "var(--iris-400)" : "var(--amber-400)";
  const trackName = track === "swift" ? "Swift" : "Kotlin";

  // Steps: video, multiple-choice, drag-drop, code editor, playground
  const steps = [
    { type: "intro", title: "Intro · State in " + (track === "swift" ? "SwiftUI" : "Compose") },
    { type: "concept", title: "Concept check" },
    { type: "dnd", title: "Build the syntax" },
    { type: "code", title: "Live coding" },
    { type: "playground", title: "Visual playground" },
  ];

  return (
    <div className="player">
      {/* Header */}
      <div className="player-head">
        <button className="btn btn-ghost btn-sm" onClick={() => setRoute("tree")}>
          <Icon name="chevL" size={14} /> Back to tree
        </button>
        <div className="player-progress">
          <div className="row-between" style={{ marginBottom: 6 }}>
            <span className="eyebrow">Lesson 08 · {steps[step].title}</span>
            <span className="mono muted" style={{ fontSize: "var(--t-xs)" }}>{step + 1}/{total}</span>
          </div>
          <div className="bar"><div className="bar-fill" style={{ width: ((step + 1) / total * 100) + "%", background: trackTint }}></div></div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <span className={"badge " + (track === "swift" ? "badge-iris" : "badge-amber")}><span className="badge-dot"></span>{trackName}</span>
          <div className="hearts" aria-label="Hearts">
            {[0,1,2,3,4].map(i => (
              <svg key={i} className={"heart " + (i < 5 ? "" : "empty")} viewBox="0 0 24 24" width={16} height={16}>
                <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6 5c2 0 3.5 1 4.5 2.5C11.5 6 13 5 15 5c3.5 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z" fill="currentColor"/>
              </svg>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="player-body">
        {step === 0 && <StepIntro track={track} />}
        {step === 1 && <StepMC track={track} />}
        {step === 2 && <StepDnD track={track} />}
        {step === 3 && <StepCode track={track} />}
        {step === 4 && <StepPlayground track={track} />}
      </div>

      {/* Footer */}
      <div className="player-foot">
        <button className="btn btn-ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          <Icon name="chevL" size={14} /> Previous
        </button>
        <div className="row" style={{ gap: 8 }}>
          {steps.map((s, i) => (
            <span key={i} style={{
              width: 8, height: 8, borderRadius: "50%",
              background: i === step ? trackTint : i < step ? "var(--success-400)" : "var(--line-2)",
              transition: "all 200ms",
            }}></span>
          ))}
        </div>
        <button className="btn btn-iridescent" onClick={() => step < total - 1 ? setStep(step + 1) : setRoute("dashboard")}>
          {step < total - 1 ? "Continue" : "Finish lesson"} <Icon name="chevR" size={14} />
        </button>
      </div>
    </div>
  );
};

// ----- Step 1: Intro / video -----
const StepIntro = ({ track }) => (
  <div style={{ maxWidth: 880, margin: "0 auto" }}>
    <div className="eyebrow" style={{ marginBottom: 12 }}>Watch · 2 min</div>
    <h2 className="h-display" style={{ fontSize: "var(--t-4xl)", marginBottom: 14 }}>
      {track === "swift" ? <>What does <span className="mono peacock-text">@State</span> actually do?</>
                         : <>What does <span className="mono peacock-text">remember</span> actually do?</>}
    </h2>
    <p className="muted" style={{ fontSize: "var(--t-lg)", marginBottom: 28 }}>
      Local, mutable storage owned by a single view. When it changes, the view re-renders. That's the whole story — and also the trap.
    </p>

    {/* Video placeholder */}
    <div style={{
      aspectRatio: "16/9",
      borderRadius: "var(--r-lg)",
      background: "linear-gradient(135deg, var(--bg-2), var(--bg-3))",
      border: "1px solid var(--line-2)",
      position: "relative",
      overflow: "hidden",
      display: "grid",
      placeItems: "center",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, transparent 0 12px, rgba(255,255,255,0.02) 12px 24px)" }}></div>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <button className="btn btn-iridescent btn-lg" style={{ borderRadius: "50%", width: 80, height: 80, padding: 0 }}>
          <Icon name="play" size={32} />
        </button>
        <div className="mono muted" style={{ fontSize: "var(--t-sm)" }}>2:14 · Concept video placeholder</div>
      </div>
      <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <span className="mono" style={{ fontSize: "var(--t-xs)", color: "var(--text-2)" }}>0:42</span>
        <div className="bar" style={{ flex: 1 }}><div className="bar-fill" style={{ width: "32%" }}></div></div>
        <span className="mono" style={{ fontSize: "var(--t-xs)", color: "var(--text-3)" }}>2:14</span>
      </div>
    </div>

    <div className="card card-elevated" style={{ marginTop: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Key takeaways</div>
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, color: "var(--text-2)" }}>
        <li>{track === "swift" ? <><span className="mono" style={{ color: "var(--peacock-200)" }}>@State</span> wraps a value type owned by a single view.</> : <><span className="mono" style={{ color: "var(--peacock-200)" }}>remember &#123; mutableStateOf(…) &#125;</span> survives recomposition.</>}</li>
        <li>Reading the value triggers the view to subscribe to changes.</li>
        <li>If multiple views need the same state, hoist it up — don't duplicate.</li>
      </ul>
    </div>
  </div>
);

// ----- Step 2: Multiple choice -----
const StepMC = ({ track }) => {
  const [picked, setPicked] = useSt(null);
  const correct = 1;
  const opts = track === "swift" ? [
    "A way to share state across multiple views",
    "Local, mutable storage owned by a single view",
    "Persistent storage written to disk",
    "A wrapper for binding to Combine publishers",
  ] : [
    "Persistent state saved across app restarts",
    "Storage that survives recomposition for a single composable",
    "A way to share state across the entire app",
    "A coroutine builder for UI updates",
  ];
  const q = track === "swift" ? "What does @State primarily provide?" : "What does remember { mutableStateOf(...) } provide?";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Question · 1 of 1</div>
      <h2 className="h2" style={{ marginBottom: 32, lineHeight: 1.4, textWrap: "pretty" }}>{q}</h2>

      <div className="stack-tight">
        {opts.map((o, i) => {
          const isPicked = picked === i;
          const showResult = picked !== null;
          const isCorrect = i === correct;
          return (
            <div key={i}
                 className={"mc-option " + (showResult && isCorrect ? "correct" : showResult && isPicked ? "wrong" : "")}
                 onClick={() => setPicked(i)}>
              <span className="mc-key" style={
                showResult && isCorrect ? { color: "var(--success-400)", borderColor: "var(--success-500)" } :
                showResult && isPicked ? { color: "var(--danger-400)", borderColor: "var(--danger-500)" } : {}
              }>{String.fromCharCode(65 + i)}</span>
              <span style={{ flex: 1 }}>{o}</span>
              {showResult && isCorrect && <span style={{ color: "var(--success-400)", fontSize: "var(--t-sm)", fontWeight: 600 }}>Correct</span>}
              {showResult && isPicked && !isCorrect && <span style={{ color: "var(--danger-400)", fontSize: "var(--t-sm)", fontWeight: 600 }}>Try again</span>}
            </div>
          );
        })}
      </div>

      {picked !== null && picked === correct && (
        <div className="card" style={{ marginTop: 24, borderColor: "color-mix(in oklch, var(--success-400) 30%, transparent)", background: "color-mix(in oklch, var(--success-400) 8%, var(--bg-1))" }}>
          <div className="eyebrow" style={{ color: "var(--success-400)", marginBottom: 8 }}>✓ Nice — that's it</div>
          <p style={{ margin: 0, color: "var(--text-2)" }}>It's storage tied to a single view's lifetime. Hoist it up when more than one view needs it.</p>
        </div>
      )}
    </div>
  );
};

// ----- Step 3: Drag-and-drop -----
const StepDnD = ({ track }) => {
  const slots = track === "swift" ? ["@State", "private", "var", "Bool"] : ["var", "by", "remember", "mutableStateOf"];
  const target = track === "swift"
    ? [{ pre: "" }, { slot: 0 }, { pre: " " }, { slot: 1 }, { pre: " " }, { slot: 2 }, { pre: " isExpanded: " }, { slot: 3 }, { pre: " = false" }]
    : [{ pre: "" }, { slot: 0 }, { pre: " isExpanded " }, { slot: 1 }, { pre: " " }, { slot: 2 }, { pre: " { " }, { slot: 3 }, { pre: "(false) }" }];

  const allTokens = track === "swift"
    ? ["var", "let", "private", "@State", "@Binding", "Bool", "Int"]
    : ["var", "val", "by", "=", "remember", "mutableStateOf", "stateOf"];
  const [filled, setFilled] = useSt({});  // slotIdx -> token
  const [picked, setPicked] = useSt(null);

  const onTokenClick = (tok) => {
    if (Object.values(filled).includes(tok)) return;
    setPicked(tok);
  };
  const onSlotClick = (slotIdx) => {
    if (picked) {
      setFilled({ ...filled, [slotIdx]: picked });
      setPicked(null);
    } else if (filled[slotIdx]) {
      const next = { ...filled }; delete next[slotIdx]; setFilled(next);
    }
  };

  const isCorrect = (idx) => filled[idx] === slots[idx];

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Build the syntax</div>
      <h2 className="h2" style={{ marginBottom: 28, textWrap: "pretty" }}>
        {track === "swift" ? <>Declare a private SwiftUI state property called <span className="mono" style={{ color: "var(--peacock-200)" }}>isExpanded</span>.</>
                           : <>Declare a Compose state property called <span className="mono" style={{ color: "var(--peacock-200)" }}>isExpanded</span>.</>}
      </h2>

      <div className="code-frame">
        <div className="code-frame-head">
          <div className="code-frame-tabs">
            <span className="code-tab active">{track === "swift" ? "ContentView.swift" : "MainScreen.kt"}</span>
          </div>
          <span className={"badge " + (track === "swift" ? "badge-iris" : "badge-amber")}>{track}</span>
        </div>
        <div className="code-frame-body">
          <pre className="mono" style={{ margin: 0, fontSize: "var(--t-base)", lineHeight: 2.2 }}>
            {target.map((part, i) => {
              if (part.pre !== undefined && part.slot === undefined) return <span key={i}>{part.pre}</span>;
              const token = filled[part.slot];
              const correct = isCorrect(part.slot);
              return (
                <span key={i}
                      onClick={() => onSlotClick(part.slot)}
                      className={"dnd-slot " + (token ? "filled" : "") + " " + (track === "swift" ? "swift" : "kotlin")}
                      style={{ margin: "0 4px", cursor: "pointer", borderColor: token && !correct ? "var(--danger-500)" : undefined }}>
                  {token || "drop"}
                </span>
              );
            })}
          </pre>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Available tokens {picked && <span className="mono" style={{ color: "var(--peacock-300)", textTransform: "none", marginLeft: 12 }}>→ tap a slot to drop</span>}</div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {allTokens.map((tok, i) => (
            <span key={i}
                  className={"dnd-token " + (Object.values(filled).includes(tok) ? "used" : "") + (picked === tok ? " active" : "")}
                  style={picked === tok ? { background: "var(--peacock-400)", color: "#02121a", borderColor: "var(--peacock-400)" } : {}}
                  onClick={() => onTokenClick(tok)}>{tok}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ----- Step 4: Code editor with run/test -----
const StepCode = ({ track }) => {
  const initial = track === "swift" ?
`func greet(_ name: String) -> String {
  // Return "Hello, BootCamp!"
  return ""
}

print(greet("BootCamp"))` :
`fun greet(name: String): String {
  // Return "Hello, BootCamp!"
  return ""
}

println(greet("BootCamp"))`;

  const solved = track === "swift" ?
`func greet(_ name: String) -> String {
  return "Hello, \\(name)!"
}

print(greet("BootCamp"))` :
`fun greet(name: String): String {
  return "Hello, \$name!"
}

println(greet("BootCamp"))`;

  const [code, setCode] = useSt(initial);
  const [output, setOutput] = useSt(null);
  const [tests, setTests] = useSt(null);

  const run = () => {
    const passed = code.includes("Hello,") && (code.includes('\\(name)') || code.includes('$name'));
    setOutput(passed ? "Hello, BootCamp!" : '""');
    setTests([
      { name: "greet returns 'Hello, BootCamp!'", pass: passed },
      { name: "handles empty string", pass: passed },
    ]);
  };

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Live coding</div>
      <h2 className="h2" style={{ marginBottom: 8 }}>Implement <span className="mono" style={{ color: "var(--peacock-200)" }}>greet(name:)</span></h2>
      <p className="muted" style={{ marginBottom: 24 }}>The function should return a greeting like <span className="mono">Hello, BootCamp!</span> using string interpolation.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 0, borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid var(--line-2)" }}>
        <div style={{ background: "var(--code-bg)", borderRight: "1px solid var(--line-1)" }}>
          <div className="code-frame-head" style={{ borderBottom: "1px solid var(--line-1)" }}>
            <div className="code-frame-tabs"><span className="code-tab active">{track === "swift" ? "main.swift" : "Main.kt"}</span></div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => { setCode(initial); setOutput(null); setTests(null); }}><Icon name="refresh" size={12} />Reset</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setCode(solved)}>Hint</button>
              <button className="btn btn-sm btn-primary" onClick={run}><Icon name="play" size={12} />Run</button>
            </div>
          </div>
          <textarea
            className="mono"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck="false"
            style={{
              width: "100%", minHeight: 280, border: 0, outline: 0,
              background: "transparent", color: "var(--code-fg)",
              padding: "16px 20px", fontSize: "var(--t-sm)",
              fontFamily: "var(--font-mono)", lineHeight: 1.7, resize: "vertical",
            }}
          />
        </div>
        <div style={{ background: "var(--bg-2)", display: "flex", flexDirection: "column", minHeight: 280 }}>
          <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--line-1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="eyebrow">Output &amp; tests</span>
            {tests && (
              <span className={"badge " + (tests.every(t => t.pass) ? "badge-success" : "")} style={!tests.every(t => t.pass) ? { color: "var(--danger-400)", borderColor: "color-mix(in oklch, var(--danger-400) 30%, transparent)", background: "color-mix(in oklch, var(--danger-400) 12%, transparent)" } : {}}>
                <span className="badge-dot"></span>{tests.every(t => t.pass) ? "passed" : "failed"}
              </span>
            )}
          </div>
          <div style={{ padding: "16px 18px", flex: 1, overflow: "auto" }}>
            {output === null ? (
              <div className="muted mono" style={{ fontSize: "var(--t-sm)" }}>Press Run to see the output.</div>
            ) : (
              <>
                <div className="eyebrow" style={{ marginBottom: 8 }}>stdout</div>
                <pre className="mono" style={{ margin: 0, fontSize: "var(--t-sm)", color: "var(--peacock-200)" }}>{output}</pre>
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px dashed var(--line-2)" }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Tests</div>
                  {tests.map((t, i) => (
                    <div key={i} className="row" style={{ gap: 8, marginBottom: 6, fontSize: "var(--t-sm)" }}>
                      <span style={{ color: t.pass ? "var(--success-400)" : "var(--danger-400)" }}>{t.pass ? "✓" : "✗"}</span>
                      <span className="mono" style={{ color: "var(--text-2)" }}>{t.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ----- Step 5: Visual playground (build a UI element) -----
const StepPlayground = ({ track }) => {
  const [bg, setBg] = useSt("peacock");
  const [radius, setRadius] = useSt(16);
  const [shadow, setShadow] = useSt(true);
  const [label, setLabel] = useSt("Tap me");

  const bgMap = {
    peacock: "var(--peacock-400)",
    iris: "var(--iris-400)",
    amber: "var(--amber-400)",
    royal: "var(--royal-400)",
  };

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Visual playground</div>
      <h2 className="h2" style={{ marginBottom: 8 }}>Build a button.</h2>
      <p className="muted" style={{ marginBottom: 28 }}>Tweak the modifiers on the right. Watch the {track === "swift" ? "SwiftUI" : "Compose"} code update in real time.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Canvas */}
        <div className="pg-canvas">
          <div className="pg-phone">
            <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
              <div style={{
                padding: "14px 28px",
                background: bgMap[bg],
                color: "#0a0a0a",
                fontWeight: 700,
                borderRadius: radius + "px",
                boxShadow: shadow ? `0 14px 30px -6px ${bgMap[bg]}` : "none",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--t-base)",
              }}>{label}</div>
            </div>
            <div className="mono" style={{ textAlign: "center", color: "var(--text-3)", fontSize: "var(--t-2xs)" }}>preview</div>
          </div>
        </div>

        {/* Controls + code */}
        <div className="stack">
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 14 }}>Modifiers</div>
            <div className="stack-tight">
              <div>
                <div className="row-between" style={{ marginBottom: 8 }}><span style={{ fontSize: "var(--t-sm)" }}>Label</span></div>
                <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div>
                <div className="row-between" style={{ marginBottom: 8 }}><span style={{ fontSize: "var(--t-sm)" }}>Background</span><span className="mono muted" style={{ fontSize: "var(--t-xs)" }}>{bg}</span></div>
                <div className="row" style={{ gap: 8 }}>
                  {Object.entries(bgMap).map(([k, v]) => (
                    <button key={k} onClick={() => setBg(k)} style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: v, border: bg === k ? "2px solid var(--text-1)" : "2px solid var(--line-2)",
                      cursor: "pointer",
                    }} aria-label={k}></button>
                  ))}
                </div>
              </div>
              <div>
                <div className="row-between" style={{ marginBottom: 8 }}><span style={{ fontSize: "var(--t-sm)" }}>Corner radius</span><span className="mono muted" style={{ fontSize: "var(--t-xs)" }}>{radius}pt</span></div>
                <input type="range" min="0" max="32" value={radius} onChange={(e) => setRadius(+e.target.value)} style={{ width: "100%", accentColor: "var(--peacock-400)" }} />
              </div>
              <div className="row-between">
                <span style={{ fontSize: "var(--t-sm)" }}>Shadow</span>
                <button className="btn btn-sm" onClick={() => setShadow(!shadow)} style={{ background: shadow ? "var(--peacock-400)" : "var(--bg-3)", color: shadow ? "#02121a" : "var(--text-2)" }}>{shadow ? "ON" : "OFF"}</button>
              </div>
            </div>
          </div>

          <div className="code-frame">
            <div className="code-frame-head">
              <div className="code-frame-tabs"><span className="code-tab active">{track === "swift" ? "Button.swift" : "MyButton.kt"}</span></div>
              <span className="badge badge-success"><span className="badge-dot"></span>live</span>
            </div>
            <div className="code-frame-body">
              {track === "swift" ? (
                <pre className="mono" style={{ margin: 0, fontSize: "var(--t-sm)", lineHeight: 1.7 }}>
<span className="tok-t">Button</span>(<span className="tok-s">"{label}"</span>) {'{ }'}
{'  '}.<span className="tok-f">padding</span>(.horizontal, <span className="tok-n">28</span>)
{'  '}.<span className="tok-f">background</span>(<span className="tok-t">Color</span>.<span className="tok-f">{bg}</span>)
{'  '}.<span className="tok-f">cornerRadius</span>(<span className="tok-n">{radius}</span>){shadow && <>{'\n  '}.<span className="tok-f">shadow</span>(radius: <span className="tok-n">8</span>)</>}
                </pre>
              ) : (
                <pre className="mono" style={{ margin: 0, fontSize: "var(--t-sm)", lineHeight: 1.7 }}>
<span className="tok-f">Button</span>(
{'  '}<span className="tok-k">onClick</span> = {'{ }'},
{'  '}<span className="tok-k">colors</span> = <span className="tok-t">ButtonDefaults</span>.<span className="tok-f">buttonColors</span>(<span className="tok-t">Color</span>.<span className="tok-f">{bg}</span>),
{'  '}<span className="tok-k">shape</span> = <span className="tok-t">RoundedCornerShape</span>(<span className="tok-n">{radius}</span>.dp){shadow && <>{',\n  '}<span className="tok-k">elevation</span> = <span className="tok-n">8</span>.dp</>}
) {'{'} <span className="tok-f">Text</span>(<span className="tok-s">"{label}"</span>) {'}'}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.LessonPlayer = LessonPlayer;
