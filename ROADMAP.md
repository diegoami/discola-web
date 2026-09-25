# Discola — roadmap to desktop and Android

Companion to [`SPEC.md`](SPEC.md). Where the spec describes what exists, this
describes what a native desktop build and an Android app would take, and
whether adopting the [Geoclick2027](https://github.com/diegoami/Geoclick2027)
stack is the way to get there.

## Status

Route A is built. The live state is in [`ANDROID.md`](ANDROID.md),
[`DESKTOP.md`](DESKTOP.md) and [`STORES.md`](STORES.md); what follows is the original reasoning, kept because
the route decision it argues for is what was taken.

| Iteration | State |
|---|---|
| 0 — Spike | Done; run 2026-09-22, recorded in `DESKTOP.md` |
| 1 — PWA and offline | Partly: fonts are self-hosted and nothing is fetched at runtime; no manifest or service worker |
| 2 — Extract the engine | Done: `public/engine.js`, tested by `tools/engine.test.mjs` (#13) |
| 3 — Desktop via Tauri | Done: `desktop/`, Windows only, first shipped in 1.0.4 (#22, #26) |
| 4 — Android via Capacitor | Done: `mobile/`, a signed APK, sideloaded. A Play listing (and itch.io) is planned in [`STORES.md`](STORES.md) (#48) |
| 5 — Geoclick stack | Not started (optional) |
| 6 — Releases | Done: `diegoami/discola-releases`, one release per version carrying the APK, the Windows exe and `SHA256SUMS.txt` |

---

## 1. The tension to resolve first

`SPEC.md` §2 lists "a framework or build step" as deliberately out of scope,
with this reason:

> A single HTML file with no toolchain still opens in ten years. A 2026 build
> pipeline will not.

Geoclick2027 is the opposite bet, and a well-made one: SvelteKit 2 on Svelte 5,
Vite 8, TypeScript 6, npm workspaces, Tauri 2 for desktop, Capacitor 8 for
Android, shared logic in `packages/*`, Vitest and Playwright, ESLint and
Prettier, gates in `scripts/task.mjs`.

Both bets are defensible because the projects differ. Geoclick renders vector
maps, runs a spaced-repetition scheduler and keeps a SQLite database; it needs
a real toolchain. Discola is a 40-card game whose rules have not changed since
1997 and never will.

**So do not answer "should Discola adopt the Geoclick stack?" as one question.
It is two, and they are independent:**

- **(a) How do we ship a desktop app and an Android app?**
- **(b) Should the UI be rewritten in SvelteKit?**

You can do (a) without (b). Both Tauri and Capacitor wrap a directory of static
files — which is exactly what Discola already is. That is the key finding of
this roadmap, and it changes the order of work.

## 2. What the code actually looks like

Relevant because it sets the cost of any rewrite.

| Part | Lines | Portable as-is? |
|---|---|---|
| Rules + opponent (`cards` … `finish`) | 374 | Yes — pure functions over a plain object, no DOM |
| UI, rendering, screens, storage | 495 | No — direct DOM, would be rewritten |
| CSS | 731 | Mostly no — a Svelte rewrite redistributes it into components |
| Markup | 233 | No |
| Sprite sheets | 2.2 MB | Yes, unchanged |
| `tools/check_ui.mjs` | 300 | Yes — it drives a browser, not a framework |

The engine is already a library in everything but packaging: no imports, no DOM
access, deterministic apart from `Math.random`. **Extracting it costs almost
nothing and is worth doing whatever else is decided** — it is the one piece
that would be shared with any future Discola client.

The UI is the expensive half, and rewriting it buys nothing a user can see.

## 3. Two routes

### Route A — wrap what exists

Keep the single file. Add a web app manifest and a service worker, then point
Capacitor and Tauri at the same directory Netlify serves.

- Desktop: Tauri 2 shell, `build.frontendDist` = `public/`.
- Android: Capacitor 8, `webDir` = `public/`.
- Neither needs a `beforeBuildCommand`. Geoclick2027 has one because it
  builds a SvelteKit app first; Discola has nothing to build.
- One codebase, three targets, no framework.
- Introduces a build step only for packaging, never for the web build.

**Cost:** roughly one day per target, mostly signing and store paperwork.
**Risk:** low. If Tauri or Capacitor is abandoned in five years, the web build
is untouched and still opens.

**What toolchain this does bring in**, to be exact about it: the Tauri CLI and
a Rust toolchain to produce desktop binaries, and the Capacitor CLI with a JDK,
the Android SDK and Gradle to produce an APK. That is real, and it is npm
tooling in the repo. But it is build-time tooling for *packaging only* — the
web build stays a directory of static files that opens with no toolchain at
all, and it is what the wrappers load. SPEC §2's longevity argument survives
because the artefact it protects is unchanged.

### Route B — adopt the Geoclick2027 stack

Move Discola into the same monorepo shape: `app/` SvelteKit, `packages/engine`,
`desktop/` Tauri, `mobile/` Capacitor, shared lint/test/gates config.

**What it buys:** one mental model across both projects; shared tooling,
release process and CI; components instead of 731 lines of global CSS; type
safety over the state object; Vitest unit tests on the engine.

**What it costs:** the single-file property, and with it the claim in SPEC §2.
A rewrite of the UI half — 1,459 lines of markup, CSS and DOM code — for no
user-visible change, with a real chance of re-introducing layout bugs that took
this project several rounds to find and now have assertions guarding them.

**Honest assessment:** Route B is the right call *if* Discola is going to keep
growing, or if maintaining two different stacks is the actual pain. It is the
wrong call if the goal is simply "I want it on my phone and my desktop".

## 4. Recommendation

**Do Route A first, then decide Route B with evidence.** Ship the apps, live
with them, and see whether the single-file architecture ever actually gets in
the way. If it does, Route B is still available and the engine extraction from
Iteration 2 has already done the hardest part of it.

The reverse order is expensive and irreversible: rewrite first, discover the
apps only needed a wrapper.

---

## Iterations

Each is independently shippable. Stop after any of them.

### Iteration 0 — Spike: does the wrapper actually work? (½ day)

**Goal.** Kill the plan early if the assumption is wrong.

Point a throwaway Tauri project and a throwaway Capacitor project at `public/`. Load the game. Check: do the sprite sheets load over the `file://`
or custom scheme the wrapper uses; does `localStorage` persist across restarts;
does the safe-area inset still work; does WebAudio play without a user gesture
prompt.

**Done when** the game is playable in both shells, or a blocker is written down
here.

**Risk.** The likely snag is asset paths — `decks/trevisane.png` is relative and
should be fine, but Capacitor's scheme and Tauri's asset protocol both need
checking. `localStorage` under Tauri is keyed by the app's origin and can be
wiped by an identifier change; note the origin in `tauri.conf.json`.

### Iteration 1 — PWA and offline (1 day, web only)

**Goal.** Installable and offline before any native packaging, because it is the
cheapest of the three and benefits the web build too.

- `manifest.webmanifest`: name, icons, `display: standalone`, portrait-primary,
  theme colour `#0d2620`.
- A service worker precaching `public/index.html` and the six sheets (~2.2 MB).
  Cache-first for `decks/*`, network-first for the page, matching the existing
  `netlify.toml` headers.
- Icons from the Trevisane back or the existing favicon.

**Done when** the game installs to a home screen and plays with the network off.

**Watch.** A stale service worker is the classic way to ship a page nobody can
update. Version the cache and claim clients on activate.

### Iteration 2 — Extract the engine (1 day)

**Goal.** The one structural change worth making regardless of route.

Move the rules and opponent — `valore`, `veroValore`, `piuAlta`, `buildDeck`,
`mescola`, `compGioca`, the profiles — into `packages/engine`, an ES module with
no dependencies and no DOM. `public/index.html` imports it; the wrappers get it for
free; a future SvelteKit app gets it for free.

Add Vitest unit tests: card ranking, trick resolution, the 120-point total, the
draw order, and a golden test that a fixed seed produces a fixed sequence of
plays per profile. That last one is what makes any later refactor safe.

**Done when** `public/index.html` has no game logic in it and the engine has tests.

**Note.** This is the first Geoclick-shaped thing in the repo — a `packages/*`
workspace — and it is worth having even if Route B is never taken.

**Done — with one deviation.** The engine is `public/engine.js`, a classic script
rather than `packages/engine` as an ES module: an ES-module import is blocked
over `file://`, and opening `public/index.html` from disk is supported and is how
the UI check loads the page. It still has no dependencies and no DOM, takes its
randomness and profiles as inputs, and is unit-tested — with Node's built-in
`node:test` instead of Vitest, to add no dependency at all. `index.html` now holds
only the view; the rules and the opponent are all in the engine.

### Iteration 3 — Desktop via Tauri (1–2 days)

**Goal.** A signed desktop build.

`desktop/src-tauri` mirroring Geoclick2027's layout, `build.frontendDist`
pointing at `public/`, window defaulting to a landscape size that suits the 3-row table
(1280 × 800 is comfortable; the layout check already covers it). No Tauri
plugins needed — there is no database, `localStorage` is enough.

**Done when** there is a build for at least one platform and the UI check
passes against the packaged app.

**Open question for the owner.** Which platforms? Windows is where the 1997
original lived and has the most sentimental claim. macOS notarisation costs an
Apple Developer account; Linux AppImage costs nothing.

**Decided (2026-09-22).** Tauri 2, Windows first, unsigned, published on
`diegoami/discola-releases`. The comparison and the pending Iteration 0 spike are
in [`DESKTOP.md`](DESKTOP.md), which supersedes the open question above.

### Iteration 4 — Android via Capacitor (2–3 days, mostly paperwork)

**Goal.** An APK, and optionally a Play listing.

**Written out in full in [`ANDROID.md`](ANDROID.md)**, which corrects this
iteration where the repo turned out not to match it: the page fetches its fonts
from Google at runtime, there is no icon anywhere, and this repo is private so
its release assets cannot be linked from the site.

`mobile/` with `capacitor.config.ts`, `webDir` at `public/`, Android
platform added. No plugins: no SQLite, no filesystem — `localStorage` covers
both storage keys.

Lock orientation to portrait, or handle both — the layout already supports both
and the check asserts landscape, so either is defensible.

**Done when** an APK installs and plays, and history survives a restart.

**Watch.** Play Store listings are the real work: signing key, privacy policy
(easy here — nothing leaves the device, which is worth stating plainly),
screenshots, content rating. Budget more time for this than for the code.

### Iteration 5 — Adopt the Geoclick stack (optional, 1–2 weeks)

Only if Iterations 0–4 showed the single-file architecture genuinely getting in
the way. Move to `app/` SvelteKit with `adapter-static`, components per screen,
TypeScript over the state object, and the shared lint/test/gates configuration.

Sequence it so the game is playable at every step: shell and routing first, then
the table, then the sheets, then the dialogs. Keep `tools/check_ui.mjs` running
against the built output the whole way — it is framework-agnostic and is the
only thing that will catch a layout regression during the port.

**Precondition.** Iteration 2 done, with the golden tests. Without them a
rewrite of this size cannot be shown to preserve the opponent's play.

### Iteration 6 — Releases

Follow Geoclick2027's pattern: a `geoclick-releases`-style public repo for
binaries, keeping `discola-web` source-only. Tag versions, attach desktop
builds and the APK, keep Netlify as the canonical web target.

---

## 5. What could be shared with Geoclick2027

Independently of whether Discola adopts SvelteKit:

- **`scripts/task.mjs gates`** — the four-gate runner. Discola has one gate
  (`tools/check_ui.mjs`) and would benefit from the same harness.
- **ESLint and Prettier config** — Discola has neither.
- **Release process and the releases repo pattern.**
- **The `.githooks` setup.**
- **UI-check ideas in both directions.** Discola's viewport matrix and its
  threshold-per-shipped-defect discipline would transfer to Geoclick; Geoclick's
  Vitest browser-mode setup would transfer here.

The thing *not* worth sharing is a component library. The two apps look nothing
alike and should not.

## 6. Open questions

Where these stand now: releases are sideloaded from `discola-releases` and no
Play listing has been pursued (1, and with it 4); desktop is Windows only for
now, per `DESKTOP.md` (2); Route A was taken (3); orientation is still open and
tracked in `ANDROID.md` §8 (5).

1. **What is the actual goal** — playing it on your own phone and desktop, or
   publishing it? Sideloading an APK skips Iteration 4's paperwork entirely.
2. **Which desktop platforms**, and is there an Apple Developer account?
3. **Is maintaining two stacks the pain**, or is it just the missing apps? This
   decides Route A versus Route B more than any technical argument here.
4. **Does the Play listing need a privacy policy** beyond "nothing leaves the
   device"? Worth checking current policy before committing to Iteration 4.
5. **Portrait-only on Android, or both orientations?**

## 7. Non-goals for this roadmap

- iOS. Capacitor would cover it, but it needs a Mac, a developer account and
  App Store review, and no one has asked.
- Cloud sync of match history. `SPEC.md` rules out a server; that stands.
- Changing the game. Every iteration here is packaging. The rules, the opponent
  and the art are untouched, and the fidelity contract in SPEC §3 still applies.
