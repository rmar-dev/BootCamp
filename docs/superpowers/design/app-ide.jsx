/* global React */
const { useState: useIde } = React;

// ===== Full IDE — for class-style lesson work =====
const IDE = ({ track, setRoute }) => {
  const isSwift = track === "swift";
  const project = isSwift ? "TipCalculator.swiftpm" : "TipCalculator (Compose)";

  const tree = isSwift ? [
    { type: "folder", name: "TipCalculator", open: true, children: [
      { type: "folder", name: "Sources", open: true, children: [
        { type: "file", name: "ContentView.swift", icon: "swift", active: true, modified: true },
        { type: "file", name: "BillModel.swift", icon: "swift" },
        { type: "file", name: "TipPickerView.swift", icon: "swift" },
        { type: "file", name: "App.swift", icon: "swift" },
      ]},
      { type: "folder", name: "Tests", children: [
        { type: "file", name: "BillModelTests.swift", icon: "swift-test" },
      ]},
      { type: "folder", name: "Resources", children: [
        { type: "file", name: "Assets.xcassets", icon: "asset" },
      ]},
      { type: "file", name: "Package.swift", icon: "config" },
      { type: "file", name: "README.md", icon: "md" },
    ]},
  ] : [
    { type: "folder", name: "tipcalculator", open: true, children: [
      { type: "folder", name: "src/main/kotlin", open: true, children: [
        { type: "file", name: "MainActivity.kt", icon: "kotlin", active: true, modified: true },
        { type: "file", name: "BillModel.kt", icon: "kotlin" },
        { type: "file", name: "TipPicker.kt", icon: "kotlin" },
        { type: "file", name: "TipCalcApp.kt", icon: "kotlin" },
      ]},
      { type: "folder", name: "src/test/kotlin", children: [
        { type: "file", name: "BillModelTest.kt", icon: "kotlin-test" },
      ]},
      { type: "folder", name: "res", children: [
        { type: "file", name: "themes.xml", icon: "config" },
      ]},
      { type: "file", name: "build.gradle.kts", icon: "config" },
      { type: "file", name: "README.md", icon: "md" },
    ]},
  ];

  const fileColor = (icon) => ({
    swift: "var(--iris-300)",
    "swift-test": "var(--success-400)",
    kotlin: "var(--amber-300)",
    "kotlin-test": "var(--success-400)",
    config: "var(--royal-300)",
    md: "var(--text-2)",
    asset: "var(--peacock-300)",
  }[icon] || "var(--text-3)");

  const swiftCode = [
    { ln: 1, html: <><span className="tok-k">import</span> <span className="tok-t">SwiftUI</span></> },
    { ln: 2, html: <></> },
    { ln: 3, html: <><span className="tok-k">struct</span> <span className="tok-t">ContentView</span>: <span className="tok-t">View</span> {"{"}</> },
    { ln: 4, html: <>{"  "}<span className="tok-a">@State</span> <span className="tok-k">private var</span> bill: <span className="tok-t">Double</span> = <span className="tok-n">42.50</span></> },
    { ln: 5, html: <>{"  "}<span className="tok-a">@State</span> <span className="tok-k">private var</span> tipPercent: <span className="tok-t">Int</span> = <span className="tok-n">18</span></> },
    { ln: 6, html: <></> },
    { ln: 7, html: <>{"  "}<span className="tok-k">var</span> total: <span className="tok-t">Double</span> {"{"}</> },
    { ln: 8, html: <>{"    "}bill * (<span className="tok-n">1</span> + <span className="tok-t">Double</span>(tipPercent) / <span className="tok-n">100</span>)</> },
    { ln: 9, html: <>{"  "}{"}"}</> },
    { ln: 10, html: <></> },
    { ln: 11, html: <>{"  "}<span className="tok-k">var</span> body: <span className="tok-k">some</span> <span className="tok-t">View</span> {"{"}</>, breakpoint: true },
    { ln: 12, html: <>{"    "}<span className="tok-t">VStack</span>(spacing: <span className="tok-n">20</span>) {"{"}</> },
    { ln: 13, html: <>{"      "}<span className="tok-t">Text</span>(<span className="tok-s">"Bill Total"</span>).<span className="tok-f">font</span>(.headline)</> },
    { ln: 14, html: <>{"      "}<span className="tok-t">TextField</span>(<span className="tok-s">"$0.00"</span>, value: $bill, format: .number)</> },
    { ln: 15, html: <>{"      "}<span className="tok-t">TipPickerView</span>(percent: $tipPercent)</> },
    { ln: 16, html: <>{"      "}<span className="tok-t">Text</span>(<span className="tok-s">"Total: \\(total, format: .currency(code: \"USD\"))"</span>)</>, current: true },
    { ln: 17, html: <>{"        "}.<span className="tok-f">font</span>(.system(.title, design: .rounded))</> },
    { ln: 18, html: <>{"        "}.<span className="tok-f">foregroundStyle</span>(.tint)</> },
    { ln: 19, html: <>{"    "}{"}"}</> },
    { ln: 20, html: <>{"    "}.<span className="tok-f">padding</span>()</> },
    { ln: 21, html: <>{"  "}{"}"}</> },
    { ln: 22, html: <>{"}"}</> },
  ];

  const kotlinCode = [
    { ln: 1, html: <><span className="tok-k">package</span> <span className="tok-p">com.bootcamp.tipcalc</span></> },
    { ln: 2, html: <></> },
    { ln: 3, html: <><span className="tok-k">import</span> <span className="tok-p">androidx.compose.material3.*</span></> },
    { ln: 4, html: <><span className="tok-k">import</span> <span className="tok-p">androidx.compose.runtime.*</span></> },
    { ln: 5, html: <></> },
    { ln: 6, html: <><span className="tok-a">@Composable</span></> },
    { ln: 7, html: <><span className="tok-k">fun</span> <span className="tok-f">TipCalculator</span>() {"{"}</> },
    { ln: 8, html: <>{"  "}<span className="tok-k">var</span> bill <span className="tok-k">by</span> <span className="tok-f">remember</span> {"{"} <span className="tok-f">mutableStateOf</span>(<span className="tok-n">42.50</span>) {"}"}</> },
    { ln: 9, html: <>{"  "}<span className="tok-k">var</span> tipPercent <span className="tok-k">by</span> <span className="tok-f">remember</span> {"{"} <span className="tok-f">mutableStateOf</span>(<span className="tok-n">18</span>) {"}"}</> },
    { ln: 10, html: <>{"  "}<span className="tok-k">val</span> total = bill * (<span className="tok-n">1</span> + tipPercent / <span className="tok-n">100.0</span>)</> },
    { ln: 11, html: <></> },
    { ln: 12, html: <>{"  "}<span className="tok-f">Column</span>(verticalArrangement = <span className="tok-t">Arrangement</span>.<span className="tok-f">spacedBy</span>(<span className="tok-n">20</span>.dp)) {"{"}</>, breakpoint: true },
    { ln: 13, html: <>{"    "}<span className="tok-f">Text</span>(<span className="tok-s">"Bill Total"</span>, style = <span className="tok-t">MaterialTheme</span>.typography.headlineSmall)</> },
    { ln: 14, html: <>{"    "}<span className="tok-f">TextField</span>(</> },
    { ln: 15, html: <>{"      "}value = bill.<span className="tok-f">toString</span>(),</> },
    { ln: 16, html: <>{"      "}onValueChange = {"{"} bill = it.<span className="tok-f">toDoubleOrNull</span>() ?: <span className="tok-n">0.0</span> {"}"}</> },
    { ln: 17, html: <>{"    "})</> },
    { ln: 18, html: <>{"    "}<span className="tok-f">TipPicker</span>(percent = tipPercent, onChange = {"{"} tipPercent = it {"}"})</> },
    { ln: 19, html: <>{"    "}<span className="tok-f">Text</span>(<span className="tok-s">"Total: $%.2f"</span>.<span className="tok-f">format</span>(total))</>, current: true },
    { ln: 20, html: <>{"  "}{"}"}</> },
    { ln: 21, html: <>{"}"}</> },
  ];

  const code = isSwift ? swiftCode : kotlinCode;
  const tabs = isSwift
    ? [{ name: "ContentView.swift", active: true, modified: true }, { name: "BillModel.swift" }, { name: "TipPickerView.swift" }]
    : [{ name: "MainActivity.kt", active: true, modified: true }, { name: "BillModel.kt" }, { name: "TipPicker.kt" }];

  const problems = [
    { sev: "warn", file: isSwift ? "ContentView.swift" : "MainActivity.kt", line: isSwift ? 16 : 19, msg: isSwift ? "String interpolation lacks fallback for nil currency code" : "Consider using NumberFormat.getCurrencyInstance() for localization" },
  ];

  const [activeTab, setActiveTab] = useIde("editor");

  const renderTree = (nodes, depth = 0) => nodes.map((n, i) => {
    if (n.type === "folder") return (
      <div key={i}>
        <div className="ide-tree-row" style={{ paddingLeft: 8 + depth * 14 }}>
          <Icon name="chevR" size={12} style={{ transform: n.open ? "rotate(90deg)" : "none", color: "var(--text-3)" }} />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--peacock-400)" strokeWidth="2"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
          <span>{n.name}</span>
        </div>
        {n.open && n.children && renderTree(n.children, depth + 1)}
      </div>
    );
    return (
      <div key={i} className={"ide-tree-row file " + (n.active ? "active" : "")} style={{ paddingLeft: 8 + depth * 14 + 14 }}>
        <span className="ide-file-glyph mono" style={{ color: fileColor(n.icon) }}>
          {n.icon === "swift" || n.icon === "swift-test" ? "𝓢" : n.icon === "kotlin" || n.icon === "kotlin-test" ? "𝓚" : n.icon === "md" ? "M" : "•"}
        </span>
        <span>{n.name}</span>
        {n.modified && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "var(--peacock-300)" }}></span>}
      </div>
    );
  });

  return (
    <div className="main" style={{ maxWidth: "none", padding: "0 24px 24px" }}>
      <div className="page-head" style={{ paddingTop: 24 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Class · Project lab · {isSwift ? "Swift" : "Kotlin"}</div>
          <h1 className="h-display" style={{ fontSize: "var(--t-3xl)" }}>Build a tip calculator</h1>
          <p className="muted" style={{ marginTop: 6, fontSize: "var(--t-md)" }}>
            Edit the source, run on the simulator, watch the tests pass. Estimated 25 min.
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm"><Icon name="refresh" size={12} />Reset project</button>
          <button className="btn btn-outline btn-sm">Submit for review</button>
          <button className="btn btn-iridescent"><Icon name="play" size={14} />Run on simulator</button>
        </div>
      </div>

      <div className="ide">
        {/* Activity bar */}
        <div className="ide-activity">
          {[
            { id: "files", icon: "grid", label: "Files" },
            { id: "search", icon: "search", label: "Search" },
            { id: "git", icon: "code", label: "Source control" },
            { id: "test", icon: "target", label: "Tests" },
            { id: "lesson", icon: "book", label: "Lesson" },
          ].map((a, i) => (
            <button key={a.id} className={"ide-activity-btn " + (i === 0 ? "active" : "")} title={a.label}>
              <Icon name={a.icon} size={20} />
            </button>
          ))}
          <div style={{ marginTop: "auto" }}></div>
          <button className="ide-activity-btn" title="Settings"><Icon name="settings" size={20} /></button>
        </div>

        {/* File tree */}
        <div className="ide-explorer">
          <div className="ide-side-head">
            <span>Explorer</span>
            <button className="btn btn-icon btn-sm" style={{ background: "transparent" }} aria-label="New file"><Icon name="plus" size={12} /></button>
          </div>
          <div className="ide-tree">{renderTree(tree)}</div>

          <div className="ide-side-section">Outline</div>
          <div className="ide-tree">
            <div className="ide-tree-row" style={{ paddingLeft: 12 }}><span className="mono" style={{ color: "var(--code-keyword)", fontSize: 11 }}>S</span><span>{isSwift ? "ContentView" : "TipCalculator"}</span></div>
            <div className="ide-tree-row" style={{ paddingLeft: 28, color: "var(--text-3)" }}><span className="mono" style={{ color: "var(--code-fn)", fontSize: 11 }}>f</span><span>total</span></div>
            <div className="ide-tree-row active" style={{ paddingLeft: 28 }}><span className="mono" style={{ color: "var(--code-fn)", fontSize: 11 }}>f</span><span>body</span></div>
          </div>
        </div>

        {/* Editor area */}
        <div className="ide-editor-col">
          <div className="ide-tabs">
            {tabs.map((t, i) => (
              <div key={i} className={"ide-tab " + (t.active ? "active" : "")}>
                <span className="ide-file-glyph mono" style={{ color: isSwift ? "var(--iris-300)" : "var(--amber-300)" }}>{isSwift ? "𝓢" : "𝓚"}</span>
                <span>{t.name}</span>
                {t.modified && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--peacock-300)" }}></span>}
                <span className="ide-tab-x">×</span>
              </div>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: 4, padding: "0 8px", alignItems: "center" }}>
              <button className="btn btn-icon btn-sm" style={{ background: "transparent" }} aria-label="Split"><Icon name="grid" size={12} /></button>
            </div>
          </div>

          <div className="ide-breadcrumb">
            <span>{project}</span>
            <Icon name="chevR" size={10} />
            <span>Sources</span>
            <Icon name="chevR" size={10} />
            <span style={{ color: "var(--text-2)" }}>{tabs[0].name}</span>
            <Icon name="chevR" size={10} />
            <span style={{ color: "var(--code-keyword)" }} className="mono">{isSwift ? "ContentView" : "TipCalculator"}</span>
            <Icon name="chevR" size={10} />
            <span style={{ color: "var(--code-fn)" }} className="mono">body</span>
          </div>

          <div className="ide-editor">
            <pre className="mono" style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>
              {code.map((l, i) => (
                <div key={i} className={"ide-line " + (l.current ? "current" : "")}>
                  <span className="ide-bp" style={{ background: l.breakpoint ? "var(--danger-500)" : "transparent" }}></span>
                  <span className="ide-ln">{l.ln}</span>
                  <span className="ide-code">{l.html}{l.current && <span className="ide-cursor"></span>}</span>
                </div>
              ))}
            </pre>

            {/* Inline suggestion popover */}
            <div className="ide-suggest">
              <div className="ide-suggest-head">
                <span className="badge badge-brand"><span className="badge-dot"></span>Suggestion · BootCamp AI</span>
                <span className="muted mono" style={{ fontSize: 10 }}>⌘ + .</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>
                Format the total as a localized currency string instead.
              </div>
              <pre className="mono" style={{ margin: 0, fontSize: 12, color: "var(--peacock-200)", background: "rgba(10,166,196,0.08)", padding: "8px 10px", borderRadius: 6, border: "1px dashed color-mix(in oklch, var(--peacock-400) 30%, transparent)" }}>
                {isSwift ? '+ .formatted(.currency(code: "USD"))' : '+ NumberFormat.getCurrencyInstance().format(total)'}
              </pre>
              <div className="row" style={{ gap: 6, marginTop: 10 }}>
                <button className="btn btn-sm btn-primary">Apply</button>
                <button className="btn btn-sm btn-ghost">Dismiss</button>
              </div>
            </div>
          </div>

          {/* Bottom panel — terminal / problems / tests */}
          <div className="ide-panel">
            <div className="ide-panel-tabs">
              {[
                { id: "editor", label: "Output", count: null },
                { id: "problems", label: "Problems", count: 1 },
                { id: "tests", label: "Tests", count: 4 },
                { id: "terminal", label: "Terminal", count: null },
              ].map(t => (
                <button key={t.id} className={"ide-panel-tab " + (activeTab === t.id ? "active" : "")} onClick={() => setActiveTab(t.id)}>
                  <span>{t.label}</span>
                  {t.count != null && <span className="ide-panel-count">{t.count}</span>}
                </button>
              ))}
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", padding: "0 10px" }}>
                <button className="btn btn-icon btn-sm" style={{ background: "transparent" }} aria-label="Clear"><Icon name="refresh" size={12} /></button>
              </div>
            </div>
            <div className="ide-panel-body">
              {activeTab === "editor" && (
                <pre className="mono" style={{ margin: 0, fontSize: 12, lineHeight: 1.75 }}>
<span style={{ color: "var(--text-3)" }}>[12:04:11] </span><span style={{ color: "var(--peacock-300)" }}>{isSwift ? "swift build" : "./gradlew build"}</span>{"\n"}
<span style={{ color: "var(--text-3)" }}>[12:04:12] </span>Building for development…{"\n"}
<span style={{ color: "var(--text-3)" }}>[12:04:14] </span><span style={{ color: "var(--success-400)" }}>✓ Build succeeded</span> in 2.4s{"\n"}
<span style={{ color: "var(--text-3)" }}>[12:04:14] </span>Launching simulator (iPhone 15 Pro)…{"\n"}
<span style={{ color: "var(--text-3)" }}>[12:04:17] </span><span style={{ color: "var(--peacock-300)" }}>App ready.</span> bill=42.50 tip=18 total=50.15{"\n"}
                </pre>
              )}
              {activeTab === "problems" && (
                <div>
                  {problems.map((p, i) => (
                    <div key={i} className="ide-problem">
                      <span className="ide-problem-icon" style={{ color: p.sev === "warn" ? "var(--warning-400)" : "var(--danger-400)" }}>⚠</span>
                      <span className="mono" style={{ color: "var(--text-2)", fontSize: 12 }}>{p.file}:{p.line}</span>
                      <span style={{ fontSize: 12, color: "var(--text-2)" }}>{p.msg}</span>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === "tests" && (
                <div className="stack-tight">
                  {[
                    { name: "BillModel · computes total with 18% tip", pass: true, dur: "2 ms" },
                    { name: "BillModel · handles zero bill", pass: true, dur: "1 ms" },
                    { name: "BillModel · handles 0% tip", pass: true, dur: "1 ms" },
                    { name: "BillModel · negative bill clamps to zero", pass: false, dur: "3 ms" },
                  ].map((t, i) => (
                    <div key={i} className="row" style={{ gap: 10, padding: "6px 10px", borderRadius: 6, background: t.pass ? "transparent" : "color-mix(in oklch, var(--danger-400) 8%, transparent)" }}>
                      <span style={{ color: t.pass ? "var(--success-400)" : "var(--danger-400)", fontWeight: 700 }}>{t.pass ? "✓" : "✗"}</span>
                      <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>{t.name}</span>
                      <span className="mono muted" style={{ fontSize: 11, marginLeft: "auto" }}>{t.dur}</span>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === "terminal" && (
                <pre className="mono" style={{ margin: 0, fontSize: 12, lineHeight: 1.75 }}>
<span style={{ color: "var(--peacock-300)" }}>jordan@bootcamp</span> <span style={{ color: "var(--text-3)" }}>~/projects/{project}</span>{"\n"}
<span style={{ color: "var(--iris-300)" }}>$</span> {isSwift ? "swift test --filter BillModelTests" : "./gradlew test --tests BillModelTest"}{"\n"}
Test Suite 'BillModelTests' started at 12:05:02{"\n"}
<span style={{ color: "var(--success-400)" }}>Test Case 'testTotalWith18Percent' passed (0.002s)</span>{"\n"}
<span style={{ color: "var(--success-400)" }}>Test Case 'testZeroBill' passed (0.001s)</span>{"\n"}
<span style={{ color: "var(--text-3)" }}>▮</span>
                </pre>
              )}
            </div>
          </div>

          {/* Status bar */}
          <div className="ide-status">
            <div className="row" style={{ gap: 14 }}>
              <span><Icon name="code" size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />main</span>
              <span style={{ color: "var(--success-400)" }}>✓ 0 errors</span>
              <span style={{ color: "var(--warning-400)" }}>⚠ 1 warning</span>
            </div>
            <div className="row" style={{ gap: 14, marginLeft: "auto" }}>
              <span>Ln 16, Col 42</span>
              <span>Spaces: 2</span>
              <span>UTF-8</span>
              <span>{isSwift ? "Swift 5.9" : "Kotlin 1.9.22"}</span>
              <span style={{ color: "var(--peacock-300)" }}>● BootCamp AI</span>
            </div>
          </div>
        </div>

        {/* Right rail — preview + lesson context */}
        <div className="ide-rail">
          <div className="ide-side-head">
            <span>Live preview</span>
            <span className="badge badge-success"><span className="badge-dot"></span>Synced</span>
          </div>
          <div style={{ padding: 14 }}>
            <div className="pg-phone" style={{ width: "100%", margin: "0 auto" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, paddingTop: 24, color: "#fff" }}>
                <div style={{ fontSize: 13, fontWeight: 600, textAlign: "center" }}>Tip Calculator</div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: "#9aa4b6", marginBottom: 4 }}>BILL TOTAL</div>
                  <div style={{ fontSize: 22, fontFamily: "var(--font-mono)", fontWeight: 700 }}>$42.50</div>
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  {[10, 15, 18, 20].map(p => (
                    <div key={p} style={{
                      flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 10, textAlign: "center",
                      background: p === 18 ? "var(--peacock-400)" : "rgba(255,255,255,0.06)",
                      color: p === 18 ? "#02121a" : "#aab4c4",
                      fontWeight: p === 18 ? 700 : 500,
                    }}>{p}%</div>
                  ))}
                </div>
                <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10, color: "#9aa4b6" }}>TOTAL</div>
                  <div style={{ fontSize: 24, fontFamily: "var(--font-mono)", fontWeight: 700, background: "var(--grad-peacock)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>$50.15</div>
                </div>
              </div>
            </div>
          </div>

          <div className="ide-side-section">Class brief</div>
          <div style={{ padding: "0 14px 14px", color: "var(--text-2)", fontSize: 12, lineHeight: 1.6 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Step 3 of 5</div>
            <p style={{ marginTop: 0 }}>You've wired up <span className="mono" style={{ color: "var(--peacock-200)" }}>{isSwift ? "@State" : "remember"}</span> for both inputs. Now format the total as currency and verify the failing test passes.</p>
            <div className="stack-tight" style={{ marginTop: 12 }}>
              <div className="row" style={{ gap: 8 }}><span style={{ color: "var(--success-400)" }}>✓</span><span style={{ textDecoration: "line-through", color: "var(--text-3)" }}>Add bill state</span></div>
              <div className="row" style={{ gap: 8 }}><span style={{ color: "var(--success-400)" }}>✓</span><span style={{ textDecoration: "line-through", color: "var(--text-3)" }}>Add tip percent state</span></div>
              <div className="row" style={{ gap: 8 }}><span className="mono" style={{ color: "var(--peacock-300)", fontSize: 12 }}>▶</span><span style={{ color: "var(--text-1)", fontWeight: 500 }}>Format total as currency</span></div>
              <div className="row" style={{ gap: 8 }}><span style={{ color: "var(--text-4)" }}>○</span><span>Handle negative input</span></div>
              <div className="row" style={{ gap: 8 }}><span style={{ color: "var(--text-4)" }}>○</span><span>Submit for review</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.IDE = IDE;
