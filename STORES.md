# Discola — itch.io and Google Play

How Discola gets onto itch.io and Google Play, and **the playbook Tressette and
Scopetta follow after it**. Companion to [`ANDROID.md`](ANDROID.md) (the APK) and
[`DESKTOP.md`](DESKTOP.md) (the Windows build). The proposal, the research and
the owner's decisions are on #48.

**Status.** Phase 1 in progress. Nothing is listed on either store yet.

## Decisions

Chosen by the owner on 2026-09-25 (#48), all of them the recommended defaults.

| Decision | Value | Why |
|---|---|---|
| Play developer account | **Personal** (if none exists) | Its creation date decides the closed-test gate below: confirm it when the account is made |
| Play signing key | **The existing `discola-release.jks` uploaded as the app signing key** | One signature everywhere: GitHub APKs and Play installs update each other |
| Card art | **All six decks on itch.io; Bresciane left out of the Play build** | Bresciane is a scan of a commercial Dal Negro deck with the maker's stamp (`README.md`) |
| itch.io price | **Free** | Same as the site and GitHub |
| Languages | **Italian and English**; card and suit names stay Italian | Italian by default, English when the device language is not Italian, switchable in Impostazioni |
| Play target audience | **13+** | Avoids the Families policy, which a card game gains nothing from |
| Order | **Web and itch.io first, then Play** | itch.io has no gate and brings the first players, who are the best Play testers |

## Requirements that shape the plan

Checked on 2026-09-25; re-check before each phase, because they move.

- **Target API.** New apps and updates must target API 36 from 2026-08-31. All
  three games already do (`mobile/android/variables.gradle`).
- **App Bundle.** Play takes AABs, and `tools/package_release.mjs` builds an APK.
- **Play App Signing** is mandatory for new apps.
- **Privacy policy.** Required for every app, even one that collects nothing.
  It must be linked in the Console and reachable from inside the app, and the
  Data safety form must be filled in.
- **Closed test.** A *personal* account created after 2023-11-13 needs at least
  12 testers opted in for 14 consecutive days, and Google checks that they
  actually played.
- **Developer verification.** From 2027 worldwide (September 2026 in four
  countries), certified devices install apps, **sideloaded ones included**,
  only from verified developers. Each package (`com.discola.app`,
  `com.tressette.app`, `com.scopetta.app`) needs registering whatever happens
  with Play.
- **itch.io HTML5.** A zip with `index.html` at its root, relative paths, and
  "played in the browser" ticked. The page runs in an iframe.

## The playbook

Each step is an ordinary PR, verified per `CLAUDE.md`. None is a milestone. A
store release is a milestone like any other: reviewed on its candidate, tagged,
built from the tag, and published by the owner. **For Tressette and Scopetta**,
each step says what carries over. The three games share their page structure,
their tooling and their Android setup, so most of it is a transplant rather than
a redesign.

### Phase 1: readiness shared by both stores

| # | Step | Status |
|---|---|---|
| 1.1 | Android Back button goes back a screen | done (Discola) |
| 1.2 | Privacy policy page, linked from Informazioni | done (Discola) |
| 1.3 | English, switchable, Italian by default | todo |
| 1.4 | Edge-to-edge on Android 15/16 (device check) | todo |
| 1.5 | Store assets: feature graphic, screenshots, itch.io cover | todo |

Each step gets its own section below when it lands: what changed, the check
that guards it, and the gotchas, written for the next game.

#### 1.1 Android Back button

**Problem.** Capacitor's core has no Back handling, so Android's default
applies: Back *finishes the activity* from any screen, and Impostazioni, Storico
and Informazioni all close the app. Pushing `history` entries does not help:
nothing asks the WebView to go back.

**What changed** (Discola):
- **`mobile/`:** `npm install @capacitor/app@^8.1.1`, then `npx cap sync android`.
  The sync rewrites `capacitor.build.gradle` and `capacitor.settings.gradle`;
  commit both.
- **`public/index.html`:** `androidBack()` next to the Escape handling, and
  `window.Capacitor?.Plugins?.App?.addListener("backButton", androidBack)`.
  Capacitor exports native plugins to the page as `window.Capacitor.Plugins.<Id>`
  (`JSExport.getPluginJS`), so no bundler and no `@capacitor/core` import are
  needed. Where the plugin is absent (web, itch.io, desktop) the line does
  nothing.
- **The behaviour mirrors Escape:** Back dismisses the confirmation and backs out
  of a sheet. On the table, the end screen and the start screen it calls
  `minimizeApp()` rather than exiting, so a hand in progress survives.

**The check** (`tools/check_ui.mjs`, `android back`):
- A `native: true` scenario installs a stand-in `window.Capacitor.Plugins.App`
  before the page loads. It captures the handler and counts `minimizeApp`.
- It presses Back through settings → table → minimise → confirm → end screen →
  settings → end screen → start, and compares the screens left showing.
- **Without the handler it fails** ("the page registered no backButton handler")
  at all five sizes.

**Verified:** `assembleDebug` builds with the plugin (its classes are in the dex).
Pressing a real Back on a device is the owner's smoke item.

**Gotchas:**
- `gradlew` needs `ANDROID_HOME` (and `JAVA_HOME`, JDK 21) set. The packager sets
  them itself; a bare `gradlew` run does not.
- A scenario whose later clicks depend on Back having worked must stop at the
  first failed press, or it times out instead of reporting.
- `npm audit` in `mobile/` reports 3 moderate findings. They were there before the
  plugin, and come from the dev-only `@capacitor/cli` (via `xcode` and `uuid`,
  which is iOS tooling), so nothing shipped carries them.

**For Tressette and Scopetta:** the same three moves. Map `androidBack()` onto
each game's own `back()` and confirm dialog: Scopetta's `back()` returns to
`cameFrom`, and Tressette has an end-of-hand screen where Back should minimise,
as it does on Discola's end screen. Copy the `android back` scenario and change
the expected trail to that game's screens.

#### 1.2 Privacy policy

**Problem.** Google Play requires a privacy policy for every app, even one that
collects nothing. It must be linked in the Play Console and reachable from
inside the app.

**What changed** (Discola):
- **`public/privacy.html`:** a standalone page with the full policy, Italian
  first and then English (`lang="en"` section), in the game's palette and
  faces, with no script. Its URL on the site,
  `https://discola.netlify.app/privacy.html`, is the one for the Play Console.
- **Informazioni** (`index.html`): a short "Privacy." paragraph and
  `#privacyLink` to that **public URL, in a new tab**. The relative
  `privacy.html` would navigate the app's own view away from a hand in progress,
  onto a page with no Back handler (step 1.1).
- **Every claim was checked against the code:**
  - no `fetch`, `XMLHttpRequest`, beacon or socket in `index.html` or
    `engine.js`;
  - storage is only `discola.history` and the settings key (opponent, deck,
    felt, speed, show-points, sound);
  - `android:allowBackup="false"`;
  - the wipe button is labelled "Cancella lo storico".
- **The contact is the public releases repo's issues,** not a personal email.
- **Backup and transfer rules** (a gap this step found): Discola had only
  `android:allowBackup="false"`. On Android 12 and later some manufacturers don't
  disable device-to-device transfer from that alone, so the manifest comment and
  the v1.0.3 notes promised more than the app did. Ported from Tressette#24:
  `res/xml/data_extraction_rules.xml` (Android 12+) and `res/xml/backup_rules.xml`
  (older), wired in through `android:dataExtractionRules` and
  `android:fullBackupContent`. `aapt2 dump xmltree` on the built APK shows all
  three attributes.

**The check** (`tools/check_ui.mjs`, document pass, `privacy page`):
- `#privacyLink` points at the public URL and opens a new tab;
- `privacy.html` loads with `lang="it"` and an English section, a viewport
  meta, UTF-8 and **no script**;
- no paragraph is below 15px;
- nothing is fetched from the network.
- **Proven to fail:** with the new-tab target dropped, and a script fetching a
  remote URL added, it reported all three.

**Gotcha:** the policy has to stay true. If a game ever sends anything
anywhere (analytics, crash reports, an online mode), its policy changes in the
same PR, and so does the Play Data safety form.

**For Tressette and Scopetta:**
- Copy `privacy.html` and change the game name, the stored keys and the settings
  it lists (grep `localStorage` in that game's `index.html`), the wipe button's
  label, and the site URL.
- Both already have the backup and transfer rules (Tressette#24, and the same
  in Scopetta), so the backup sentence holds as written. Check it anyway if a
  manifest changes.
- Add the Informazioni paragraph and copy the `privacy page` check.

### Phase 2: itch.io

1. `tools/package_itch.mjs`: zip `public/` with `index.html` at the root. The
   exe and the APK come from `dist-release/vX.Y.Z/` as downloads.
2. The owner creates the page:
   - "This file will be played in the browser", mobile friendly, a fullscreen
     button, an embed size of 1280×800;
   - the cover, screenshots and tags (`card-game`, `italian`, `singleplayer`,
     `offline`, `retro`, `browser`);
   - free.
3. A "Carte italiane" itch.io collection holding the three games,
   cross-linked from each page.
4. Upload by hand, or with `butler` once there are regular updates.

### Phase 3: Google Play

1. `package_release.mjs` also runs `bundleRelease`, and stages and checksums
   the AAB. The Play build leaves Bresciane out.
2. The owner creates the app in the Play Console:
   - Play App Signing with the existing key;
   - content rating (IARC), target audience 13+, Data safety ("no data
     collected"), the privacy URL;
   - an Italian listing first ("Discola – Briscola a due"), then English.
3. An internal test, then the closed test (12 testers for 14 days if the
   account needs it), then production.

## Testers and audience

The research is on #48; in short:

- **Testers:** real Briscola players the owner knows first, recruited over
  WhatsApp. They are the only testers who will genuinely play for two weeks.
  **One pool of 15–20 for all three games**, since the same people can join
  each closed test. Tester exchanges (*Testers Community*, r/AndroidClosedTesting)
  only top up. Ready-to-send messages in Italian and English are on #48.
- **Positioning:** the category is served by online, feature-rich apps
  (Briscola Più, Briscola Dal Negro). Lead with what they lack: **offline, no
  ads, no account, no data, and opponents from 1997**.
- **Channels:**
  - Facebook card-game groups and tournament pages;
  - local groups by regional deck;
  - Svilupparty, and IIDEA's Indie Dungeon at Milan Games Week;
  - the "1997 Delphi game, transcribed" story, for tech and retro audiences;
  - Briškula (Croatia, Slovenia) and Brisca players abroad, once English is in;
  - pagat.com's Briscola page.
