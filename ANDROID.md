# Discola — the Android APK

How to turn `public/` into an APK, publish it as a GitHub release, and link it
from <https://discola.netlify.app>. This is [`ROADMAP.md`](ROADMAP.md)'s
Iteration 4 written out in full, with the parts that turned out to be wrong or
missing corrected against what is actually in the repo today.

Almost all of this is built and verified on this machine, and releases have
been cut from it. Where a part is still a plan, it says so where it appears.

---

## 1. Testing locally — done

```sh
npm run setup     # npm install + npx playwright install chromium (once)
npm start         # http://localhost:8080
npm run check     # the UI check, ~2 minutes
```

Verified on this machine: the check runs clean (document, fonts, screens, table,
table with inflated spacing), and the game deals and plays over http.

Three things had to change to get there, all of them small:

- **`tools/check_ui.mjs` could not run on Windows.** It defaulted `CHROME` to a
  hard-coded Linux path, and built its `file://` URL with `URL.pathname`, which
  on Windows yields `/C:/...` and made `path.resolve` produce `C:\C:\...`. It
  now asks `playwright-core` where Chromium is and uses `pathToFileURL`. The
  `CHROME` environment override still works.
- **`tools/serve.mjs`** — a static server for `public/`, Node standard library
  only. `file://` is enough for the check but not for what comes next: a
  service worker and a web app manifest only load over http, and Capacitor
  serves the same directory over a real origin rather than from disk. It binds
  `0.0.0.0` so the portrait layout can be opened on a phone on the same network.
- **`package.json`** — so the three commands above exist and `playwright-core`
  is pinned. No runtime dependencies; `playwright-core` is dev-only and
  `node_modules` stays gitignored, as `CLAUDE.md` requires.

`.gitignore`'s comment pointed at `tools/check_layout.mjs`, which was renamed to
`check_ui.mjs`; corrected.

---

## 2. Three things blocked packaging — all three are cleared

### 2.1 The fonts — done

The page used to pull Bodoni Moda, Barlow and Barlow Condensed from
`fonts.googleapis.com` with a `<link>`. Fine on the web, wrong in an APK, and
the measurements said so. At 393×852, rendering `Discola Briscola` at
`700 48px`:

| | webfonts loaded | Bodoni Moda | Barlow |
|---|---|---|---|
| before, with network | 5 | 373px | 374px |
| before, network blocked | 0 | **329px** | 374px |
| after, either way | 6 | 373px | 374px |

Bodoni Moda is the display face — the wordmark, the headings, the score
numerals — and without it the wordmark set 12% narrower in a generic serif.
`check_ui.mjs` had never seen that, because it had always run with the network
up, so every text-floor and overflow threshold in it was calibrated against
metrics an offline APK would not have had. It also made `ROADMAP.md` §4’s
"nothing leaves the device" untrue: every cold start told Google’s CDN the
device’s IP.

**What was done.** The eight `latin` faces the page asks for are in
`public/fonts/`, declared with `@font-face`. **172 KB**, against the 2.2 MB the
sheets already cost. Bodoni Moda turned out to be a single variable file — the
400, 600 and 700 downloads were byte-identical — so it is one file declared
over `font-weight: 400 700` and the wght axis does the rest, which saved 90 KB.

Only the `latin` subset is shipped, because every character the page can render
is inside it. That is not a judgement call that can rot: the check asserts it.

**No `<link rel="preload">`.** A font preload must carry `crossorigin`, which
makes it a CORS fetch; over `file://` the origin is `null` and the browser
blocks it, erroring on every load. Opening `public/index.html` from disk is a
supported way to play, so the preload was removed.

**The check gained a `fonts` pass** — three assertions, run with every
non-`file://` request aborted:

1. every character in the source is inside the latin subset,
2. every declared `@font-face` loads with the network down,
3. nothing at all is fetched from the network.

Assertion 2 calls `load()` on each face rather than reading `.status` after the
page settles. The first version did the latter and reported two Barlow weights
as missing when the files were fine — a browser only fetches a face something
on screen actually uses, so `.status` describes the start screen, not the
shipped files.

### 2.2 The icon — done

`public/` had `index.html` and five deck sheets and nothing else: no favicon,
no apple-touch-icon, no manifest, which is why a local run logged a 404 for the
browser’s implicit `/favicon.ico`.

The icon is the **fante di spade of the Trevisane deck** — column 7, row 2 on
`pack_cards.py`’s grid — cropped to its top half, the half with the face. In
Veneto that card is *la vecia*, which it is regardless of the moustache; see
the About screen, where the story is now written down.

`tools/make_icons.py` cuts it:

```sh
python3 tools/make_icons.py
```

Pure standard library, like `pack_cards.py` — no browser and no Pillow, so it
can run in a release script. It writes `assets/icon-{only,foreground,background}.png`
at 1024 for `@capacitor/assets` to expand into every Android density, and the
web sizes into `public/icons/`. The scale is nearest-neighbour on purpose: the
source is a 50x50 patch of 1997 bitmap, and interpolation is redrawing by
another name, which `CLAUDE.md` rules out.

It also writes the desktop icons into `desktop/src-tauri/icons/`, including a
multi-size `icon.ico`.

Re-run it only if the crop should change. The constants at the top of the file
are the card, the crop rectangle and the adaptive-icon safe zone.

**Compare by pixel, not by byte.** PNG bytes are not portable between machines:
the same pixels compressed by different zlib builds (this repo's CI, and this
machine's `zlib-ng`, disagree) produce different files. So there is a check that
decodes what is committed and compares it to a fresh generation, rather than
diffing bytes:

```sh
python3 tools/make_icons.py --check
```

It runs in CI. If it fails, either the crop changed on purpose — re-run the
script and commit — or a committed icon was edited or corrupted.

### 2.3 The releases repo — done

`diegoami/discola-web` is private, and release assets on a private repo are not
publicly downloadable, so "publish as a release and link it from the website"
could not work from this repo.

**`diegoami/discola-releases` now exists and is public** — the same split
`ROADMAP.md` §Iteration 6 proposed, and the same one `geoclick-releases` already
uses against a private `Geoclick2027`. Source stays private; binaries are
public. `tools/publish_release.mjs` (§5) targets it.

The alternative — making `discola-web` itself public — would also have worked,
but it publishes `SPEC.md` and `ROADMAP.md`, and `netlify.toml`'s publish
setting exists precisely because those were not meant to be public.

---

## 3. The build: Capacitor 8

`ROADMAP.md` picked Capacitor and it is still the right call. `@capacitor/cli`
and `@capacitor/android` are at **8.5.2** on npm, which is what Geoclick2027
pins, so the two projects would stay on one version.

Capacitor bundles `webDir` into the APK's assets and serves it from a local
origin. That gives a genuinely offline app — assuming §2.1 is fixed — with no
server, no network permission needed, and `localStorage` intact across restarts.

The one real difference from Geoclick2027: **Discola has nothing to build.**
Geoclick's `capacitor.config.ts` points `webDir` at `app/build`, the output of a
SvelteKit build. Discola's points at `public/`, which is the source. There is no
`beforeBuildCommand` and no build step — `cap sync` copies the directory Netlify
already serves. That is the whole argument of `ROADMAP.md` §1 paying off.

```
mobile/
  capacitor.config.json   appId com.discola.app, appName Discola, webDir ../public   [done]
  package.json            @capacitor/{core,android,cli} ^8.5.2                        [done]
  .gitignore              keystore.properties, *.jks, Gradle outputs                  [done]
  README.md               what appId means and why it cannot change                   [done]
  android/                generated by `cap add android`; needs the SDK
    keystore.properties.example
```

JSON, not Geoclick2027’s `capacitor.config.ts`: Discola has no TypeScript
toolchain and this file does not justify introducing one.

**The `appId` is `com.discola.app`** — decided, and permanent from the first
publish: changing it later produces a different app that cannot upgrade the
installed one. It matches how Geoclick2027 did it (`com.geoclick.mobile`), so
the two projects stay shaped the same. `appName` is what shows under the icon,
and that is exactly `Discola`; the `appId` could not be, because Android wants
reverse-DNS with at least two lowercase dot-separated segments.

Lock the orientation to `portrait` or leave both — the layout supports both and
the check asserts landscape, so either is defensible. `ROADMAP.md` left this
open; see §7.

**What this drags in:** the Capacitor CLI, a JDK, the Android SDK and Gradle.
Real, and it is npm tooling in a repo that has had none. But it is packaging
tooling only: `public/` stays a directory of static files that opens with no
toolchain, which is the property `SPEC.md` §2 is protecting.

Both are installed here now: JDK 21 (Gradle needs ≤ 24; this machine's is at
`%USERPROFILE%\.jdks\jbr-21.0.11`) and the Android SDK at
`%LOCALAPPDATA%\Android\Sdk` — command-line tools `15859902`, `platform-tools`,
`platforms;android-35`, `build-tools;35.0.0`, licences accepted. Android Studio
is installed now, GUI only — its bundled JBR is Java 25, too new for the
project's Gradle 8.14.3, so packaging must point `JAVA_HOME` at JDK 21.


### Status: the project is generated and builds

Done on this machine, past tense:

- `mobile/` has its Capacitor deps installed and `npx cap add android` has
  generated `mobile/android/` (committed; its `build/`, `.gradle/` and
  `local.properties` are gitignored, as is the regenerated
  `capacitor-cordova-android-plugins/`).
- Identity in the generated project is `com.discola.app` / `Discola`, matching
  `capacitor.config.json`. `versionName` started at `1.0.0`, `versionCode 1`;
  both have moved with each release since (§5).
- Launcher icons generated at every density from `assets/` by
  `@capacitor/assets` — la vecia on the felt.
- **A debug APK builds** (`gradlew assembleDebug`, 6.5 MB) and, loaded in a
  mobile WebView with the network cut, deals a hand and renders the table with
  zero external requests and no console errors. The toolchain works end to end.
- Signing is wired: `app/build.gradle` reads `keystore.properties` when present
  and stays unsigned when absent, so a debug build and a fresh clone still work.
  The release key exists at `C:\Users\diego\discola-release.jks`.

Signed releases have been cut this way since v1.0.0 (2026-09-19): with
`mobile/android/keystore.properties` in place, `node tools/package_release.mjs`
builds and verifies the signed APK and `node tools/publish_release.mjs --confirm`
releases it (§5).

## 4. Signing

An unsigned APK does not install. Generate a release key once:

```sh
keytool -genkeypair -v -keystore discola-release.jks \
        -keyalg RSA -keysize 2048 -validity 10000 -alias discola
```

`keytool` ships with the JDK — here, under
`%USERPROFILE%\.jdks\jbr-21.0.11\bin\`. It asks for a
keystore password, then certificate details nobody checks for a sideloaded
game, then a key password. Give both the **same password** — on JDK 21 keytool
writes PKCS12, which has no separate key password at all, so a different one is
accepted with a warning and then ignored. One secret, not two.

Android identifies the app by this signature forever. An update installs over
an existing copy only if it is signed with the same key.

### If the password is lost

It cannot be recovered. The key is encrypted with a key derived from the
password: there is no reset, no backdoor and nobody to ask. `keytool
-storepasswd` changes a password, but it needs the current one first.

What that costs Discola is smaller than the usual warning implies, because
these APKs are sideloaded:

| situation | consequence |
|---|---|
| **Sideloaded — this plan** | A new key means a new signature, so an update will not install over the old app. Players uninstall and reinstall, and uninstalling wipes app data — here that is `localStorage`: their match history and settings. Annoying, not fatal. |
| **Play Store, not enrolled in Play App Signing** | The listing is stuck. A new key needs a new `applicationId`, which means a new listing, with no installs and no reviews. |
| **Play Store, enrolled in Play App Signing** | Google holds the app signing key and you hold only an upload key; lose the upload key and you request a reset. The only real safety net, and only if enrolled at first publish. |

So the honest ranking: back the key up properly, but if it does go missing
before there is a Play listing, the recovery is "everyone reinstalls and loses
their history", not "the project is over".

### Checking that a password is right

```sh
keytool -list -keystore discola-release.jks
```

It prompts, then either prints the `discola` entry and its SHA-256 fingerprint
and exits **0**, or prints

```
Keytool-Fehler: java.io.IOException: keystore password was incorrect
```

and exits **1**. That is the whole test, and the exit code makes it scriptable.
Run it against the *backup* copy, not the working one — verifying the file you
already use proves nothing about the file you are relying on.

Two things worth knowing, both established by trying them here:

- **There is only one password.** On JDK 21 `keytool` writes **PKCS12**, whatever
  the file is called — `.jks` is just an extension now. PKCS12 does not support
  a separate key password: pass `-keypass` and keytool says so and ignores it.
  So `-list` succeeding means the key is reachable too, and the advice to use
  the same password for both is not a convention but the only option.
- **The error text is English even when the JDK is not.** This machine's keytool
  is localised to German, but `keystore password was incorrect` comes through
  untranslated, so grepping for it is safe. For readable output everywhere else,
  `keytool -J-Duser.language=en -list ...`.

Prefer the prompt to `-storepass` on the command line: an argument is visible in
the process list while it runs and lands in shell history afterwards. Use
`-storepass` only inside a script that reads the value from
`keystore.properties`.

Once an APK exists, the other direction is worth checking too — that the thing
you shipped carries the signature you meant:

```sh
apksigner verify --print-certs app-release.apk
```

Compare its SHA-256 against the fingerprint `keytool -list` printed. Equal means
that APK will install as an upgrade over the last one; different means it will
not, and you want to know before publishing rather than from a player.

To make that automatic, record the fingerprint once in
`mobile/android/cert.sha256` (the SHA-256 as `apksigner` prints it; colons are
ignored). `tools/package_release.mjs` then refuses any APK signed by a different
key before staging it, instead of publishing one that cannot update an installed
copy. Until the file exists the script prints the fingerprint to record.

### Not losing it

- Put the password in a password manager **at the moment the key is created**,
  not afterwards. That is the whole mitigation; the rest is footnotes.
- Back `discola-release.jks` up somewhere that outlives this laptop. The file
  and the password are equally required — a backup of one alone is worth
  nothing.
- Check the backup actually opens, rather than assuming:

  ```sh
  keytool -list -keystore discola-release.jks
  ```

  It prompts, and lists the `discola` entry if the password is right. Do that
  once against the backup copy, not the working one.
- `mobile/android/keystore.properties` holds the password in plain text for
  Gradle to read. It is gitignored — and it is also a second copy of the secret
  sitting on this disk, which is useful, and the reason that file must never be
  committed or synced anywhere public.
- If it is only half-remembered, password recovery tools for your own keystore
  do exist (`android-keystore-password-recover` and similar) and work when the
  search space is small. A long shot, not a plan.

### Wiring it up

Mirror Geoclick: `mobile/android/keystore.properties` (gitignored) read by
`build.gradle`, with a committed `keystore.properties.example` beside it.

Then verify, every time, before publishing:

```sh
apksigner verify --print-certs app-release.apk
```

Geoclick's `package-release.mjs` fails the build outright if Gradle emitted
`app-release-unsigned.apk`, on the reasoning that a silently unsigned artifact
is worse than a failed build. Copy that check.


## 5. Publishing

Two scripts, both modelled on `Geoclick2027/scripts/`, which have four shipped
releases behind them. Since 1.0.4 they package **both targets as one release**,
on the shared version line (`DESKTOP.md`):

**`tools/package_release.mjs`** — cross-check every version declaration, then
`cap sync`, `gradlew assembleRelease`, refuse an unsigned APK, `apksigner
verify`; then `npm ci` + `tauri build --no-bundle` for the desktop executable,
refusing a missing or non-PE artifact; then stage `dist-release/vX.Y.Z/` with
`Discola-X.Y.Z-android.apk`, `Discola-X.Y.Z-windows-x64.exe` and
`SHA256SUMS.txt`, verified by reading it back.

Gradle needs `JAVA_HOME` set to JDK 21 here
(`%USERPROFILE%\.jdks\jbr-21.0.11`); Android Studio's bundled JBR is Java 25
and Gradle 8.14.3 rejects it.

**Tag the source.** A release is a milestone (`CLAUDE.md`), reviewed on its
candidate commit on `main` before it is tagged. After AGREE:

1. Package from exactly that commit. The packager refuses a working tree that
   differs from `HEAD` (untracked files count, and so do ignored ones under
   `public/`), and it records the commit before building.
2. Run the smoke on the packaged builds.
3. Run `git tag -a vX.Y.Z <candidate-sha> -m "Discola X.Y.Z"` and
   `git push origin vX.Y.Z`.

The publisher refuses unless that tag is on `origin/main` at the packaged
commit (`DESKTOP.md` §Releasing).

**`tools/publish_release.mjs`** — verify the staged set against
`SHA256SUMS.txt` (a missing or unlisted file fails the run), check the source
tag, then `gh release create` on `diegoami/discola-releases`, attaching every
asset. Dry run by default, `--confirm` to actually publish; this is
outward-facing and irreversible enough to deserve the extra word.

Release notes should say, in Italian to match the game: what changed, that
Android will warn about installing from an unknown source (and, since 1.0.4,
that Windows SmartScreen will warn about the unsigned executable), and that the
match history stays on the device.

**Build locally, not in CI.** Geoclick2027 has no release workflow — it packages
on a developer machine and uploads. For one target, on a repo with no CI today,
adding GitHub Actions means putting the signing key in a secret to save a
command. Desktop builds arrived in 1.0.4 and the revisit kept this: the packager
now builds both targets locally, and only the CI-matrix question stays open.

## 6. Linking it from the website — and the Netlify plugin question

**A Netlify build plugin is the wrong tool here, and is not needed.** Plugins
run inside the Netlify build, which has no Android SDK, is time-limited, and —
the point that matters — would introduce a build step into a site that
deliberately has none, on every deploy, to produce an artifact that changes only
at release time. The APK is built on a developer machine and hosted by GitHub
Releases. Netlify's job is to point at it.

That needs no plugin, only a redirect in `netlify.toml`:

```toml
[[redirects]]
  from = "/android"
  to = "https://github.com/diegoami/discola-releases/releases/latest"
  status = 302
  force = true
```

`/releases/latest` rather than a direct asset URL, because a direct link has the
version in the filename and breaks on every release. The releases page also puts
the notes and the checksum in front of someone about to sideload an APK, which
is where they belong. If a one-tap download is wanted later, upload a second
unversioned copy and redirect `/discola.apk` at
`/releases/latest/download/Discola-android.apk`.

Then one line in the About screen, next to the two source links that are already
there (`public/index.html` ~line 948):

```html
<a href="/android">Scarica l&rsquo;app per Android</a>
```

Relative, so it works through the redirect on Netlify and is simply absent when
the page is opened from disk — and so the APK never advertises a link to itself.
**Editing the About screen is a UI change: run `npm run check` after it.**

## 7. Order of work

| # | Step | Effort | Blocks |
|---|---|---|---|
| 1 | ~~Fonts~~ — done: self-hosted, 172 KB, `fonts` pass in the check | — | — |
| 2 | ~~Icons~~ — done: `tools/make_icons.py`, wired into the page | — | — |
| 3 | ~~Create `diegoami/discola-releases`~~ — done, public | — | — |
| 4 | ~~Android SDK, `cap add android`, debug APK builds & runs offline~~ — done | — | — |
| 5 | ~~Release key, `keystore.properties`, signed build~~ — done | — | — |
| 6 | ~~`package_release.mjs` and `publish_release.mjs`; cut v1.0.0~~ — done, v1.0.0–v1.0.4 released | — | — |
| 7 | ~~Netlify `/android` redirect + the About-screen link~~ — done | — | — |

All seven steps are done. A Play Store listing is not in this table: the owner
decided on 2026-09-25 to publish (#48), and the plan, the decisions and the
progress live in [`STORES.md`](STORES.md).

## 8. Still open

1. **Portrait-only, or both orientations?** Both work today and the check covers
   both; portrait-only is one line and removes a class of bug from a device
   nobody is going to rotate mid-trick.
2. ~~**Version numbering.**~~ Settled: one version line across Android and
   desktop, cross-checked by `tools/package_release.mjs` before anything builds,
   with `versionCode` required to be a positive integer (5 at 1.0.4). There is
   still no `CHANGELOG.md`; what changed is in each GitHub release's notes.
3. **Does the easter egg survive?** `6winouj64ie` needs a hardware keyboard.
   Harmless, but it is the one feature the Android build silently loses.
