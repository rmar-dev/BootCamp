# Interactive Coding Bootcamp Platform

_Started 2026-05-01 09:03 UTC_

---

## User

i dont have desing system i need to build an design system and an bootcamp for developing swift and kotlin skill 
an web application with an ui simmilar to brilliant and https://www.codecademy.com/ with the peacock nbcu color theme

## Assistant

I'll help you build this! Before I dive in, let me ask a few key questions to make sure I design the right thing. A bootcamp learning platform for Swift/Kotlin is a meaty project, and getting the direction right up front will save a lot of iteration.

A quick note on references: I'll draw inspiration from the *general patterns* common to learning platforms (lesson cards, progress tracking, interactive code exercises, skill trees) but I'll create an **original design system** rather than recreating any specific company's branded UI. For the color palette, I'll build something peacock-inspired (rich teals, deep blues, vibrant accents) as an original system rather than copying NBCU's brand assets directly.

_[tool: questions_v2]_

## User

Questions answered:
- scope: Full app: dashboard + lesson player + skill tree + profile
- primary_audience: Mixed — adaptive paths for all levels
- lesson_style: Video + exercise hybrid, Drag-and-drop code blocks / fill-in-the-blank, Visual playground (build a real UI element), Live code editor with run/test (Codecademy-style), Bite-sized concept cards with multiple choice (Brilliant-style)
- swift_kotlin_handling: Two separate tracks — pick your language up front
- gamification: Badges & achievements, Leaderboards
- peacock_intensity: Dark mode primary with peacock glow
- visual_personality: Clean, minimal, editorial, Technical, precise, IDE-like
- design_system_depth: Full kit (foundations + components + patterns + lesson primitives)
- design_system_format: Decide for me
- variations: Just one strong direction
- tweaks_focus: Density (compact / comfortable), Light/dark mode

## Assistant

I've got everything I need. Let me lay out the plan:

**Vision**: A dark-mode-first developer learning platform with peacock-inspired iridescent accents (deep teal, rich blue, vibrant magenta-orange highlights). Clean editorial typography meets IDE precision. Original design — not a clone of any specific brand.

**Deliverables**:
1. **Design System** (full kit) — single scrollable spec page with foundations, components, and lesson primitives
2. **App Prototype** — dashboard, skill tree, lesson player (with all 5 lesson types), profile

Let me build this.

_[tool: update_todos]_

_[tool: set_project_title]_

_[tool: write_file]_

_[tool: copy_starter_component]_

Now let me build the design system page and the app components. I'll keep individual files modest in size.

_[tool: write_file]_

Now the design system page:

_[tool: write_file]_

_[tool: snip]_

_[tool: update_todos]_

Now let me build the app. I'll split it across multiple JSX files to keep them manageable.

_[tool: write_file]_

_[tool: snip]_

_[tool: write_file]_

_[tool: snip]_

_[tool: write_file]_

_[tool: snip]_

_[tool: write_file]_

_[tool: snip]_

_[tool: write_file]_

_[tool: snip]_

_[tool: write_file]_

_[tool: snip]_

_[tool: write_file]_

_[tool: snip]_

_[tool: read_file]_

_[tool: snip]_

_[tool: grep]_

_[tool: snip]_

_[tool: read_file]_

_[tool: snip]_

I see — `TweakSection` uses `label` not `title`, and `TweakRadio` takes `options` as plain array. Let me fix App.html accordingly, and also `TweakRadio`'s options format.

_[tool: str_replace_edit]_

I also need to check the `useTweaks` return shape:

_[tool: snip]_

_[tool: grep]_

_[tool: snip]_

_[tool: str_replace_edit]_

_[tool: snip]_

_[tool: done]_

_[tool: snip]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

Built it — here's what you have:

**Design System** (`Design System.html`) — a full-kit style guide with sidebar nav covering:
- Foundations: peacock color spectrum, surfaces, track accents (Swift = iris/magenta, Kotlin = amber), typography (Inter Tight + JetBrains Mono), 4-pt spacing, radius, elevation, motion
- Components: buttons (incl. iridescent CTA), inputs, badges/chips, cards (incl. glow border), progress bars + rings, avatars, code blocks
- Lesson primitives: skill nodes (5 states), multiple choice, drag-and-drop blocks, live code editor
- Voice & tone do/don't

**App** (`App.html`) — full interactive prototype:
- **Sidebar + topbar** with Swift/Kotlin segmented track switcher (try toggling — content swaps)
- **Dashboard**: daily plan strip, up-next + recent lessons, paths progress, mini leaderboard
- **Skill tree**: sectioned, with completed/current/locked states and section badges
- **Lesson player**: 5-step flow — intro video, multiple choice, drag-and-drop syntax, live code editor with run/test, visual playground (build a button, code updates live)
- **Profile**: heatmap, mastery bars, badge collection
- **Leaderboard**: podium + ranked list
- **Tweaks**: dark/light theme + comfortable/compact density

Click around — the track toggle and the lesson-player playground are the most fun to poke at.

