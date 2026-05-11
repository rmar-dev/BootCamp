# Spec #13 (draft) — Swift Capstone Curriculum (Weeks 2–4) & Mini Peacock MVP

**Date:** 2026-04-22
**Status:** DRAFT — pre-brainstorm staging material. Not a formal approved spec yet.
**Depends on:** Spec #11 (adaptive content engine) landed; Spec #12 (Week 1 Swift fundamentals) expected to land before this. Plus Specs #1, #2, #3, #5, #7, #8, #9, #10.
**Out of scope / deferred:** Kotlin port (separate later spec); 3-month depth extensions (Spec #14).

> **About this file.** Originally drafted as Spec #11 bundling curriculum with cohort-adaptation, then rescoped as Spec #12 after the engine was split out. During Spec #12's brainstorm (2026-04-23) we further narrowed Spec #12 to Week 1 Swift fundamentals only — this file is now reference material for **Spec #13: Weeks 2–4 + Mini Peacock capstone**, to be brainstormed formally after Spec #12 ships and the first Week-1 cohort runs.
>
> When Spec #13 is brainstormed formally:
> - Ignore Week 1 inventory (now covered by Spec #12)
> - Keep Mini Peacock MVP scope (rails + PDP + UIKit player stub; Search + My List as stretch)
> - Keep milestone mapping (5 capstone_submission lessons)
> - Expand each concept lesson's exercise set to an 8-exercise pool (smaller than Week 1's 10 because SwiftUI/UIKit exercises are multiple-choice / predict-output heavy)
> - Add starter repo scaffolding, hosted catalog endpoint, asset sourcing

## Summary

Author the actual curriculum content and starter repo that turn an empty BootCamp platform into a working 4-week intern bootcamp. Swift only in this first cut — Kotlin mirrors the outline in a later spec. Learners are computing-engineering graduates: experienced programmers new to Swift and to the Peacock codebase, not absolute beginners.

End state: ~33 authored lessons across two tracks (Swift Fundamentals + Swift Mini Peacock Capstone), a GitHub template starter repo, and a hosted catalog endpoint. No new platform features required; this spec fills the platform with content.

## Audience & framing

- **Who:** Computing-engineering grads hired as iOS engineers, onboarding onto the Peacock stack. Fluent in at least one of Python / JS / Java / C++. No prior Swift, no prior iOS.
- **What "zero to hero" means here:** zero Swift → capable of shipping the Mini Peacock capstone and navigating a mixed SwiftUI/UIKit production codebase.
- **Content density:** terse, comparative, assumes fluency in programming. Lessons lead with *how Swift differs from what the learner already knows*, not definitions of variables and loops.
- **Mixed stack reality:** real Peacock is still partly UIKit, so the capstone includes a deliberate UIKit bridging module (§3, §4 milestone 4).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language scope (this spec) | Swift only | Authoring parallel languages dilutes both; Swift is the higher-volume production language at Peacock |
| Cohort length target | 4-week intensive | Matches "MVP simple to do in one month". 3-month cohort handled in a later depth-modules spec |
| Curriculum shape | Hybrid (Approach C) | Week 1 language fundamentals in browser IDE, weeks 2–4 app-driven in Xcode. Isolates language learning from toolchain learning |
| Mini Peacock feature set | Rails + PDP + UIKit player stub (core); Search + My List (stretch) | Player stub makes it feel like a streaming app; UIKit bridge matches production reality; stretch extras are droppable if cohort slips |
| Data source strategy | Bundled JSON week 2, hosted JSON endpoint week 3 | Lets week 2 focus on SwiftUI without blocking on networking; introduces URLSession as a refactor, not a cold start |
| Starter repo distribution | GitHub template repo | Spec #10 already assumes this; no GitHub API integration needed |
| Hosted catalog endpoint | Static JSON committed to a public GitHub repo, served via `raw.githubusercontent.com` | Zero infrastructure, swappable later for GitHub Pages if variants needed |
| Artwork | CC0 stills first, TMDb posters only if UI feels lifeless | Avoids TMDb licensing entanglement unless visibly needed |
| Sample video streams | Apple public HLS test streams | Well-known, stable, no hosting cost. Non-playable titles use `streamURL: nil` which becomes a teaching moment |
| Recap pattern | Every lesson ends with `## What you learned` (Concepts / Swift-specific / What's next) | Enforces narrative continuity; curriculum compiler fails the build if missing |
| Tooltip pattern | Blockquote callouts titled `**What's going on here**` under non-obvious snippets | 1–3 per lesson; targets Swift idioms that trip experienced programmers |

## The 4-week arc

| Week | Mode | Deliverable | Day split |
|------|------|-------------|-----------|
| **1. Swift Language** | Browser IDE (platform) | Pass diagnostic quiz | D1–2 syntax & types · D3 optionals & errors · D4 closures & collections · D5 protocols / generics / async-await |
| **2. SwiftUI + App Scaffold** | Xcode (local) | Static tile grid on simulator, Milestone 1 submitted | D1 Xcode tour & project setup · D2 Views, modifiers, state · D3 Lists/Grids/NavigationStack · D4 build the tile grid from bundled JSON · D5 polish + milestone submit |
| **3. Networking, PDP, Rails** | Xcode | PDP working, data over network, Milestones 2 & 3 submitted | D1 Codable deep-dive · D2 URLSession + async fetch · D3 refactor to rails layout · D4 build PDP screen · D5 milestone submits |
| **4. Player, Polish, Ship** | Xcode | Working Mini Peacock, final milestone, optional stretch | D1 UIKit primer + Auto Layout · D2 Bridging + UIKit player + Milestone 4 · D3 stretch (Search OR My List) · D4 bug bash + code review · D5 final submission + demo |

**Rhythm:** mornings ≈ lessons + platform exercises, afternoons ≈ Xcode/capstone work. Week 1 is the only heavy-platform week; weeks 2–4 the platform shifts to reference lessons + milestone submissions.

**Safety valve:** if the cohort slips, week-4 stretch extras drop first, then polish day. The UIKit player milestone is non-negotiable — it's what makes the app feel real and it's the only production-reality UIKit touch in the curriculum.

## Lesson inventory (~33 lessons)

Each lesson: 20–40 min, 3–6 exercises, ends with `## What you learned`, 1–3 tooltip callouts on complex snippets, and a "Coming from..." framing line for at least one other language.

### Week 1 — Track `swift-fundamentals` (11 lessons)

1. Intro & toolchain — `let` vs `var`, type inference, playground model
2. Types & value vs reference — Int/Double/String/Bool, tuples, `struct` vs `class`, identity vs equality
3. Optionals — `?`/`!`, `if let`, `guard let`, `??`, optional chaining
4. Collections — Array/Dictionary/Set, map/filter/reduce the Swift way
5. Control flow & pattern matching — `switch` exhaustiveness, `where`, ranges, `for-in`
6. Functions & closures — trailing closure syntax, capture lists, `@escaping`
7. Protocols & extensions — conformance, default implementations, protocol-oriented mindset
8. Generics — generic functions, `where` constraints, associated types (skim)
9. Error handling — `throws`, `try`/`try?`/`try!`, `do/catch`, `Result`
10. Async/await — `async` functions, `await`, `Task`, structured concurrency basics
11. Week-1 diagnostic — 15-exercise quiz across all above. Gates entry to week 2. Proposed passing threshold 70%, validated against first cohort.

### Week 2 — Track `swift-mini-peacock-capstone` (7 lessons)

1. Xcode tour — project structure, targets, scheme, simulator, previews
2. **SwiftUI and UIKit — why both** — framing lesson: how a real Peacock-style codebase is split, what "reading UIKit fluently" means for a new hire
3. Your first SwiftUI view — `View` protocol, `body`, modifiers, composition
4. State & data flow — `@State`, `@Binding`, `@Observable` (iOS 17+), one-way data flow
5. Layout primitives — `VStack`/`HStack`/`ZStack`/`Grid`/`LazyVGrid`, alignment, spacing
6. Images & async images — `AsyncImage`, placeholders, aspect ratios
7. **Milestone 1: Static tile grid** *(capstone_submission)* — bundled JSON → `LazyVGrid` of tiles on simulator

### Week 3 — Track `swift-mini-peacock-capstone` (7 lessons)

1. Codable deep-dive — `Decodable`, `CodingKeys`, nested structures, date strategies
2. URLSession & async fetch — `URLSession.shared.data(from:)`, error handling, tasks
3. **Milestone 2: Data over the network** *(capstone_submission)* — swap bundled JSON for hosted endpoint
4. Rails layout — nested `LazyHStack` inside `LazyVStack`, paging feel, row headers
5. Product Detail Page — hero image, metadata section, actions row (Play, +My List)
6. Loading & error states — skeletons, redaction, retry patterns
7. **Milestone 3: Rails + PDP shipping** *(capstone_submission)*

### Week 4 — Track `swift-mini-peacock-capstone` (8 lessons)

1. UIKit primer — `UIViewController` lifecycle (`viewDidLoad`, `viewWillAppear`), `UIView` hierarchy, code-only controller
2. Auto Layout basics — anchors, `NSLayoutConstraint`, the `translatesAutoresizingMaskIntoConstraints` gotcha
3. Bridging UIKit ↔ SwiftUI — `UIViewControllerRepresentable`, `UIHostingController`
4. AVKit crash course — `AVPlayer`, `AVPlayerViewController`, HLS sample streams
5. **Milestone 4: UIKit player screen** *(capstone_submission)* — write `PlayerViewController: UIViewController` wrapping `AVPlayerViewController`, wrap in `UIViewControllerRepresentable`, launched from PDP
6. App polish — navigation transitions, empty states, tab bar
7. Optional stretch — Search (`.searchable` + debouncing) OR My List (SwiftData persistence + second tab)
8. **Milestone 5: Final submission** *(capstone_submission)* — everything 1–4 plus any stretch, polished states, README updated

Totals: **~33 lessons, 5 capstone milestone submissions.**

## Mini Peacock MVP app spec

### Screens & navigation

```
TabView (root)
├── BrowseTab (NavigationStack)
│   ├── BrowseView          — rails of tiles
│   └── PDPView             — pushed on tile tap
│       └── PlayerScreen    — full-screen, UIKit via UIViewControllerRepresentable
├── [Stretch] MyListTab     — persisted favorites
└── [Stretch] SearchTab     — .searchable across all content
```

Tab bar is present from day 1 with just Browse; stretch extras slot in as additional tabs without reshaping the app.

### Data model

```swift
struct Title: Identifiable, Decodable, Hashable {
    let id: String
    let name: String
    let kind: Kind              // .series | .movie
    let shortSynopsis: String
    let longSynopsis: String
    let tileImageURL: URL
    let heroImageURL: URL
    let runtimeMinutes: Int?    // movies
    let seasonCount: Int?       // series
    let genres: [String]
    let rating: String          // "TV-14", "PG-13"
    let streamURL: URL?         // HLS sample; nil means not-playable
}

struct Rail: Identifiable, Decodable {
    let id: String
    let title: String           // "Trending Now", "New on Peacock"
    let titleIDs: [String]      // references into Title catalog
}

struct Catalog: Decodable {
    let titles: [Title]
    let rails: [Rail]
}
```

Hero vs tile image are separate URLs so tiles stay fast-loading and PDP hero can be higher-res / different aspect.

### Starter repo layout — `projects/mini-peacock-starter-swift/`

```
MiniPeacock/
├── MiniPeacock.xcodeproj
├── MiniPeacock/
│   ├── MiniPeacockApp.swift           — @main entry
│   ├── ContentView.swift              — TabView root
│   ├── Models/
│   │   ├── Title.swift                — empty stub, student fills in week 2 D4
│   │   ├── Rail.swift                 — empty stub
│   │   └── Catalog.swift              — empty stub
│   ├── Services/
│   │   ├── CatalogService.swift       — protocol + two impls (Bundled, Remote)
│   │   └── BundledCatalog.swift       — loads catalog.json from bundle
│   ├── Features/
│   │   ├── Browse/
│   │   │   ├── BrowseView.swift       — empty, student fills in week 2
│   │   │   ├── RailRow.swift          — week 3
│   │   │   └── TileCard.swift         — week 2
│   │   ├── PDP/
│   │   │   └── PDPView.swift          — week 3
│   │   └── Player/
│   │       ├── PlayerViewController.swift  — UIKit, week 4
│   │       └── PlayerScreen.swift          — SwiftUI wrapper, week 4
│   └── Resources/
│       └── catalog.json               — ~20 titles, ~4 rails
├── MiniPeacockTests/
│   └── CatalogDecodingTests.swift     — one passing test as example
└── README.md                          — clone/build/run + "you've got this"
```

**Starter delivers:**
- App scaffold compiles and runs on simulator
- Empty tabs visible
- `catalog.json` bundled and valid
- `CatalogService` protocol defined, `BundledCatalog` implemented (teaches the pattern by example)

**Students build:**
- All views (Browse, Rails, Tile, PDP, Player)
- Data models (Title, Rail, Catalog)
- Remote service implementation
- Navigation wiring
- UIKit player + bridge

Day 1 of week 2 the app compiles and runs on simulator — high-motivation starting point. Every meaningful file still ends up as the student's work.

### Content library

- ~20 titles, ~4 rails, no visible repetition
- 3–4 titles have `streamURL` pointing to Apple's public HLS streams (`developer.apple.com/streaming/examples`)
- Remaining titles have `streamURL: nil` → Play button shows "Not available" state (deliberate teaching moment about optionals and UI states)
- Artwork: CC0 stills in `Resources/art/` with attribution in README. Swap to TMDb posters only if UI feels lifeless (decision deferred until first asset pass)

## Milestone ↔ lesson mapping

| # | Milestone lesson | End of... | Repo state at that commit | Instructor checks |
|---|------------------|-----------|---------------------------|-------------------|
| **1** | *Tiles on screen* | Week 2 | `Title` model decodes bundle JSON; `BrowseView` shows `LazyVGrid` of tiles; taps non-functional | Compiles, grid renders, `Title` matches JSON |
| **2** | *Data over the network* | Week 3 mid | `RemoteCatalogService` implements protocol; `URLSession` fetch; loading/error states | Network works, error state renders offline, bundled service still tests-green |
| **3** | *Rails + PDP* | Week 3 end | Browse swapped to rails (LazyVStack of LazyHStack); tile tap pushes PDP with hero + metadata + actions | Navigation works, PDP shows correct title, ≥3 rails render |
| **4** | *UIKit player screen* | Week 4 mid | `PlayerViewController` wraps `AVPlayerViewController`; `PlayerScreen` is `UIViewControllerRepresentable`; Play button launches with `streamURL` | UIKit lifecycle correct, representable bridges correctly, HLS plays |
| **5** | *Final submission* | Week 4 end | All of 1–4 plus any stretch attempted; polished states; README updated | Full walkthrough — code quality, SwiftUI idioms, any shipped extras |

**Gating:** milestones 1–3 are gates (instructor approval required to consider the student on-track); 4–5 are summative. If a student hasn't hit milestone 1 by end of week 2, the instructor is pinged via the review queue to intervene.

**Platform flow (already built by specs #5/#7/#8/#10):**
1. Student completes preceding lessons → reaches `capstone_submission` lesson in sidebar
2. `CapstoneSubmissionExercise` renders the submission form (repo URL, commit SHA, notes)
3. Submit → attempt enters `pending_review`, appears in instructor queue
4. Instructor reviews repo externally, writes notes, clicks "Approve Milestone"
5. Student sees pass + points + review notes inline via `InstructorReview` component

## Pedagogical patterns

### Pattern 1 — Module recap at the end of every lesson

Every lesson ends with:

```markdown
## What you learned

**Concepts:** Optionals as first-class values · `guard let` for early-exit unwrapping · nil-coalescing with `??`

**Swift-specific vs other languages:** In JS/Python you check `if (x == null)`; in Swift the compiler forces nil handling at the type level — a `String?` is a different type from `String` and can't be used interchangeably.

**What's next:** Week 2 starts using optionals constantly in SwiftUI state (`@State private var selected: Title? = nil`).
```

- **Concepts:** bulleted list of 3–6 items
- **Swift-specific:** 1–2 sentences comparing to languages grads already know
- **What's next:** 1 sentence pointing forward in the curriculum

The curriculum compiler (spec #9) fails the build if any lesson is missing `## What you learned` with all three subheadings.

### Pattern 2 — Tooltip callouts under complex code

Under any snippet with non-obvious Swift idioms, a blockquote callout:

```markdown
> **What's going on here**
> - `try await` — call is both async and throwing. `await` suspends until ready; `try` propagates thrown errors.
> - Trailing closure chaining — `.filter { }` and `.sorted { }` are closures on Array.
> - `$0` — shorthand for first argument. Equivalent to `(title) in title.kind == .series`.
```

- Only where a specific Swift-ism warrants flagging (trailing closures, `$0`, `try await`, property wrappers, result builders)
- 1–3 per lesson target
- Web renderer (spec #2) may later style these blockquotes distinctively (possibly collapsible); markdown works as-is today

## Authoring deliverables

1. **Curriculum markdown** — ~33 lessons across two tracks in `curriculum/swift-fundamentals/` and `curriculum/swift-mini-peacock-capstone/`, following spec #9 frontmatter + the recap/tooltip conventions above
2. **Mini Peacock starter repo** — `projects/mini-peacock-starter-swift/` as a separate git repo, hosted as a GitHub **template repo** so students use "Use this template"
3. **Hosted catalog endpoint** — `catalog.json` committed to a public GitHub repo `main` branch, served via `raw.githubusercontent.com/...`
4. **Asset library** — tile + hero artwork for ~20 titles in the starter's `Resources/art/`
5. **Track metadata** — two tracks registered via spec #1/#9 (capstone track has `kind: capstone` + `starterRepoUrl`)

### Rough authoring order

- Phase A: tracks metadata + starter repo scaffold + `catalog.json`
- Phase B: week-1 curriculum (highest volume, parallelizable)
- Phase C: weeks 2–4 curriculum, paired with starter-repo checkpoint commits that verify each milestone is achievable as written
- Phase D: polish, diagnostic quiz, instructor runbook, dry-run each milestone

Authoring is the bulk of the work; the platform is already built.

## Known unknowns (non-blocking, flagged for plan phase)

- **Artwork sourcing** — CC0 vs TMDb. Start CC0, swap if UI feels lifeless.
- **Sample HLS streams** — confirm Apple's test-stream URLs are still live and haven't rotated.
- **Day-by-day pacing in week 1** — 11 lessons / 5 days = ~2/day. May need merging or splitting once drafted.
- **Diagnostic passing threshold** — 70% is the proposed gate; validate against first cohort.
- **Stretch-extra choice** — Search vs My List vs both. Cohort-dependent; leave flexible in the curriculum and let the instructor call it in week 4 D3 based on pace.

## Out of scope

- Kotlin track (mirrored port in a separate spec)
- 3-month extended-cohort depth modules (networking edge cases, architecture deep dives, testing, performance, accessibility) — separate spec
- UIKit depth beyond bridging: `UITableView`/`UICollectionView`, storyboards/xibs, Combine↔UIKit, custom transitions, container view controllers
- Curriculum-authoring UI changes beyond what spec #9 already delivers
- GitHub API integration, automated builds/CI on submissions, deadline enforcement, peer review, capstone demo scheduling
