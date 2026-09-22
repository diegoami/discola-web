# Discola — the desktop build

The recorded decision for packaging `public/` as a desktop application, and the
comparison it was made from. Companion to [`ANDROID.md`](ANDROID.md), which does
the same for the APK, and to [`ROADMAP.md`](ROADMAP.md) Iteration 3.

**Status.** The shell, platform, distribution and signing decisions are recorded
below. The **Iteration 0 Tauri spike has not been run yet** — the acceptance
criteria in issue #18 are therefore only partly met, and issue #18 stays open
until the spike result is written into the "Spike" section.

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

## Spike (pending)

The Iteration 0 spike (`ROADMAP.md:128-143`) is a kill-early check. Android is out
of scope here because its Capacitor packaging evidence already exists
(`ANDROID.md:194-204`); only the **Tauri half** remains:

- [ ] the game playable in a throwaway Tauri 2 shell pointed at `public/`;
- [ ] sprite sheets loading over the Tauri asset protocol;
- [ ] `localStorage` persisting **across restarts**;
- [ ] the safe-area inset surviving;
- [ ] WebAudio playing **without a user-gesture prompt**;
- [ ] the Tauri identifier/origin recorded (`ROADMAP.md:142-143`).

A blocker in any of these is written down here rather than worked around.

## UI check against the packaged app

`tools/check_ui.mjs` loads the page over `file://` (`tools/check_ui.mjs:36-40`),
while the packaged app uses the asset protocol. Proposed method, to be confirmed
by the spike:

1. keep running the check against `public/` unchanged — it is the same bytes the
   wrapper loads, and it guards the layout regressions the check exists for; and
2. add a short **manual smoke of the packaged build** for the things the check
   cannot see over `file://`: asset loading, storage origin and persistence.

If the spike shows the check can target the wrapper's scheme directly, prefer
that instead and record it here.

## Out of scope

CI and release automation for a desktop matrix: `ANDROID.md:359-362` defers that
until desktop builds arrive and the matrix grows.

## Next

1. Run the Tauri half of the Iteration 0 spike and fill in the "Spike" section.
2. Decide the UI-check method from the spike result.
3. Open an implementation issue for a `desktop/` wrapper, mirroring `mobile/`'s
   conventions, referencing #18.
