# Discola — the desktop build

The recorded decision for packaging `public/` as a desktop application, and the
comparison it was made from. Companion to [`ANDROID.md`](ANDROID.md), which does
the same for the APK, and to [`ROADMAP.md`](ROADMAP.md) Iteration 3.

**Status.** Decisions recorded. The Iteration 0 Tauri spike was **run on
2026-09-22** (Windows; Tauri 2.11.6, CLI 2.11.5, WebView2 153) and all six checks
passed. The [`desktop/`](desktop/README.md) wrapper is **built and smoke-tested**,
and 1.0.4 ships it: packaging and publishing run locally for both targets (see
[Releasing](#releasing)). Installers and code signing remain deferred.

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

## Wrapper smoke — run 2026-09-22

The wrapper in [`desktop/`](desktop/README.md) was built
(`npm ci && npm run build`, Tauri CLI 2.11.5, runtime 2.11.6) against the real
`public/` (`frontendDist` `../../public`) and smoke-tested the same way as the
Iteration 0 spike: a transient probe was injected into the built app to report
from inside the WebView, then removed and the app rebuilt, so the committed
source carries no test code.

| Check | Result |
|---|---|
| Origin / protocol | `http://tauri.localhost`, `http:` |
| Sprite sheet over the asset protocol | `decks/trevisane.png` loaded, 660 × 500 |
| `localStorage` across restarts | run counter read back as `"1"` on the second launch |
| Safe-area inset | `0px` top/left/bottom |
| WebAudio without a gesture | `AudioContext` state `running`, 48 kHz |
| Game renders | 3 + 3 cards dealt, briscola named, window 1280 × 800 |

## Releasing

Both targets ship as one GitHub Release on
[`diegoami/discola-releases`](https://github.com/diegoami/discola-releases),
numbered on the shared version line (1.0.4 is the first). The process is local
by design, for the reasons in [`ANDROID.md`](ANDROID.md) §5 — the machine doing
a release holds the Android signing key and the Rust toolchain.

A release is a milestone (`CLAUDE.md`). The version bump merges to `main` like
any other PR. The candidate is a commit on `main`, and it is reviewed on its
milestone issue before anything is tagged. After AGREE:

```sh
git fetch origin && git checkout <candidate-sha>   # detached, clean tree
node tools/package_release.mjs    # builds both from the candidate, stages dist-release/vX.Y.Z/
# manual smoke of both packaged builds (see "UI check against the packaged app")
git tag -a vX.Y.Z <candidate-sha> -m "Discola X.Y.Z"
git push origin vX.Y.Z
node tools/publish_release.mjs    # dry run: checks, prints the notes
node tools/publish_release.mjs --confirm
```

The build is packaged and smoke-tested before the tag, because a build that
fails its smoke must not leave a tag behind. The tag then goes on the same
commit, so the published binaries are built from exactly the tagged commit.
The publisher proves it.

The tag is what ties a published binary to its source, since
`diegoami/discola-releases` holds binaries only.

- **`package_release.mjs`** refuses a working tree whose content differs from
  `HEAD`: modified or staged files, untracked files, and ignored files under
  `public/`, which the build bundles. Line-ending differences alone don't
  count. Before building, it records `HEAD`'s commit and tree in
  `dist-release/vX.Y.Z.source`.
- **`publish_release.mjs`** refuses, dry run included, unless `vX.Y.Z` is on
  `origin`, on `origin/main`, at the very commit that was packaged. The release
  notes name that commit.

v1.0.1–v1.0.4 were tagged after the fact. v1.0.0 was built from uncommitted
source and has no tag (#32).

`package_release.mjs` fails unless every version declaration — Android's
`versionName`, `tauri.conf.json`, `Cargo.toml`, `desktop/package.json` and both
lockfiles — agrees, and stages `Discola-X.Y.Z-android.apk`,
`Discola-X.Y.Z-windows-x64.exe` and `SHA256SUMS.txt`. `publish_release.mjs`
re-verifies the staged set and publishes nothing without `--confirm`. A version
bump touches all of those declarations in one change; the packager is what
catches a missed one.

The Windows executable is **unsigned** (the decision recorded above), so
SmartScreen warns on first run. The warning is documented where a user meets it
— the release notes — and reads:

> L'eseguibile non è firmato digitalmente, quindi Windows mostrerà l'avviso
> «Windows ha protetto il PC»: clicca «Ulteriori informazioni», poi «Esegui
> comunque». È portabile, senza installer: mettilo dove preferisci.

Signing and installers would remove the warning and add a Start-menu entry;
both stay deferred until a broader distribution is wanted.

## Out of scope

CI for a desktop matrix: releases stay local ([`ANDROID.md`](ANDROID.md) §5),
and a CI build would put the signing key in a secret to save a command. A CI
job is worth adding only if the matrix grows. Installers/bundling and code
signing are likewise deferred (`DESKTOP.md:24`).

## Next

1. Add a `desktop/` job to CI only if the matrix grows.
2. Revisit installers and code signing if a broader distribution is wanted.
