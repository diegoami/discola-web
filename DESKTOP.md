# Discola — the desktop build

The recorded decision for packaging `public/` as a desktop application, and the
comparison it was made from. Companion to [`ANDROID.md`](ANDROID.md), which does
the same for the APK, and to [`ROADMAP.md`](ROADMAP.md) Iteration 3.

**Status.** Decisions recorded, and the Iteration 0 Tauri spike **run on
2026-09-22** (Windows; Tauri 2.11.6, CLI 2.11.5, WebView2 153). All six checks
pass; results below. Issue #18's acceptance criteria are met.

Repository facts are cited as `file:line`. Statements about Electron are marked
**(general)** because they are not sourced from this repository.

## Recorded decision

Chosen by the owner on 2026-09-22; recorded on issue #18.

| Decision | Value | Note |
|---|---|---|
| Shell | **Tauri 2** | wraps `public/` unchanged |
| Platforms | **Windows only** | first release; Linux AppImage and macOS are later options |
| Goal | **Personal use + GitHub Releases** | matching Android, not app stores |
| Binary hosting | **`diegoami/discola-releases`** | the existing public repo (`ANDROID.md:122-131`) |
| Code signing | **Unsigned first** | document the SmartScreen warning; departs from `ROADMAP.md:190` ("a signed desktop build") |

## Comparison

Route A ("wrap what exists", `ROADMAP.md:70-92`) is already the route taken for
Android, which is built and shipping (`ANDROID.md:194-204`, `SPEC.md:425-428`).
The desktop question is which shell wraps `public/`, or whether to adopt the full
Geoclick stack instead.

| Dimension | Tauri 2 (Route A) | Electron (general) | Route B — full Geoclick stack |
|---|---|---|---|
| How it packages | native binary; the OS WebView renders the page | Node + bundled Chromium; an installer with a large runtime | Tauri for desktop, inside the Geoclick repo shape (`ROADMAP.md:96-97`) |
| Distribution | GitHub release asset, like the APK | same | same, plus a rewritten web build |
| Toolchain cost | Tauri CLI + a Rust toolchain (`ROADMAP.md:86-88`); Rust 1.98.1 and MSVC build tools are already present on this machine | Node only; no Rust | SvelteKit 2, Vite 8, TypeScript 6, npm workspaces, Vitest, Playwright, ESLint (`ROADMAP.md:28-31`) |
| Static assets / origin | asset protocol; the identifier sets the origin, and changing it can wipe `localStorage` (`ROADMAP.md:140-143`) | `file://` or a custom protocol; similar origin caveat (general) | inherits Tauri's behaviour |
| Code signing | Windows signing; owner chose unsigned first | Windows signing; same | inherits Tauri |
| Maintenance / security | relies on the OS WebView2 runtime, updated by Windows | Chromium is bundled, so Electron security updates ship with the app (general) | inherits Tauri, plus framework updates |
| Reuse of `public/` | unchanged | unchanged | **rewritten**: 1,459 lines of markup, CSS and DOM (`ROADMAP.md:104-106`) |
| Web build impact | none; stays toolchain-free (`SPEC.md:39`, `ROADMAP.md:83-84`) | none | the single-file web build is given up (`ROADMAP.md:103-104`) |

**Why Tauri 2.** It wraps `public/` unchanged, keeps the web build a no-toolchain
directory (`SPEC.md:39`), and the Rust toolchain it needs is already installed
here. Electron is the fallback if a Node-only toolchain becomes a hard
requirement; it trades a smaller toolchain for a larger runtime and a bigger
security-update surface. Route B is not warranted for a 40-card game whose UI
would be rewritten for no user-visible change, and its regression risk is real
(`ROADMAP.md:104-106`).

## Spike — run 2026-09-22

Iteration 0 (`ROADMAP.md:128-143`) is a kill-early check. Android is out of scope
because its Capacitor packaging evidence already exists (`ANDROID.md:194-204`);
only the **Tauri half** was run.

**Method.** A throwaway Tauri 2 project (`net.discoa.spike`, `frontendDist`
pointed at a copy of `public/` at commit `a050e93`), plus a spike-only probe
script that reports from inside the WebView. The project is not in the repository
and nothing was changed in `public/`.

| Check | Result |
|---|---|
| Playable in the shell | **yes** — a hand deals and renders (3 + 3 cards, briscola named) |
| Sprite sheets over the asset protocol | **yes** — `decks/trevisane.png` loaded, 660 × 500, from `http://tauri.localhost/decks/trevisane.png` |
| `localStorage` across restarts | **yes** — a sentinel written on launch 1 read back as `"1"` on launch 2 |
| Safe-area inset | `0px` top/left/bottom; layout unaffected |
| WebAudio without a gesture | `AudioContext` constructed with no user gesture, state `running`, 48 kHz |
| Identifier / origin recorded | identifier `net.discoa.spike`; origin `http://tauri.localhost` (protocol `http:`) |

Fonts: the faces the rendered screen uses loaded over the asset protocol; declared
but unused weights stayed lazily unloaded, as expected. No blockers.

Two observations for the wrapper work, neither blocking:

- The window defaulted to 1280 × 800, a size `tools/check_ui.mjs` does not
  currently include (its nearest are 1180 × 820 and 1440 × 900). Add it alongside
  the wrapper.
- The Tauri origin is `http://tauri.localhost` on Windows, so `localStorage` is
  keyed to that origin and the **identifier must not change** (`ROADMAP.md:142-143`).

## UI check against the packaged app

`tools/check_ui.mjs` loads the page over `file://` (`tools/check_ui.mjs:36-40`),
while the packaged app runs from `http://tauri.localhost`. The spike confirmed
the check cannot target the running wrapper (the WebView is embedded, not a
server), so the method is:

1. keep running the check against `public/` unchanged — the wrapper embeds those
   same bytes, and the check guards the layout regressions it exists for; and
2. add a short **manual smoke of the packaged build** for the things the check
   cannot see: asset loading over the asset protocol, the storage origin, and
   persistence across restarts.

## Out of scope

CI and release automation for a desktop matrix: `ANDROID.md:359-362` defers that
until desktop builds arrive and the matrix grows.

## Next

1. Open an implementation issue for a `desktop/` wrapper, mirroring `mobile/`'s
   conventions, recording: the `net.discoa.spike` identifier must be replaced by
   a permanent one before the first release (it keys `localStorage`), the
   1280 × 800 viewport added to `tools/check_ui.mjs`, and the manual packaged-app
   smoke above.
