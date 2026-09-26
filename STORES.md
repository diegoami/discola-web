# Discola — itch.io and Google Play

How Discola gets onto itch.io and Google Play, and **the playbook Tressette and
Scopetta follow after it**. Companion to [`ANDROID.md`](ANDROID.md) (the APK) and
[`DESKTOP.md`](DESKTOP.md) (the Windows build). The proposal, the research and
the owner's decisions are on #48.

**Status (2026-09-25).** Phase 1 is merged for Discola (#49–#53). Nothing is
listed on either store yet.
- **Open before any store build (owner):** the device checks for 1.1 (Back) and
  1.4 (edge-to-edge), and approval of the draft listing text in 1.5.
- **The first release that can go to a store is the next milestone, v1.0.6.**
  v1.0.5 (`e46c254`) predates Phase 1: it has no English, no privacy link and
  no Back handling. v1.0.6 is reviewed on its candidate and tagged like any
  other release (`CLAUDE.md`), and its build is what Phase 2 uploads.
- **Next:** Phase 2 (itch.io). Tressette and Scopetta have not started Phase 1.

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
| 1.3 | English, switchable, Italian by default | done (Discola) |
| 1.4 | Edge-to-edge on Android 15/16 (device check) | analysed; device check pending (owner) |
| 1.5 | Store assets: feature graphic, screenshots, itch.io cover | done (Discola) |

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
- **Back is standard Android: it always goes one level up** (owner decision,
  #55, replacing #50's minimise):

  | Where | Back |
  |---|---|
  | the confirm dialog | closes it, as Escape does |
  | Impostazioni, Storico, Informazioni | the previous screen |
  | the table, hand in progress | "Abbandonare la partita?"; Abbandona goes to the start screen |
  | the end screen | the start screen |
  | the start screen | **exits the app**, after asking if a hand is still in progress |

- **An Exit button** (#55): a door icon in the start screen's top bar, "Esci" /
  "Exit", `hidden` unless `window.Capacitor.Plugins.App` exists. So it is
  **Android only**: a web page cannot close its tab, and the desktop window has
  its own close button. It calls `exitApp()`.
- **A hand can still be in progress on the start screen:** "Cambia avversario"
  opens it without ending the hand. So Exit and Back there ask first. The
  confirm dialog takes what "yes" does (`askConfirm(then)`): abandon for the
  start screen, or exit. Its copy is true of both.

**The check** (`tools/check_ui.mjs`):
- **`android back`** (`native: true`) installs a stand-in
  `window.Capacitor.Plugins.App` before the page loads. It captures the Back
  handler and counts `exitApp` calls, then walks the table above: settings →
  table, hand → confirm → dismissed → confirm → Abbandona → start, end screen →
  start, start → exit. Each press is recorded as the screen left showing, plus
  the exit count.
- **`android exit`:**
  - the button shows with the plugin;
  - it exits at once with no hand in progress;
  - after "Cambia avversario" it asks first, Back cancels, and confirming exits.
- **The ordinary `start` pass:** `#btnExit` stays hidden without the plugin.
- **Proven to fail:**
  - without the handler: "the page registered no backButton handler";
  - with the old minimise behaviour, with Exit shown on the web, and with Exit
    skipping the question mid-hand: each reported, at all eight screen passes.

**Verified:** `assembleDebug` builds with the plugin (its classes are in the dex).
Pressing a real Back on a device is the owner's smoke item.

**Gotchas:**
- `gradlew` needs `ANDROID_HOME` (and `JAVA_HOME`, JDK 21) set. The packager sets
  them itself; a bare `gradlew` run does not.
- **A click that depends on the behaviour under test must not wait.** When the
  behaviour is broken the element never appears, and the run times out instead
  of reporting. Such clicks go through `tap()` (click only if visible), and a
  scenario returns as soon as the screen it needs is not there. This bit twice.
- `npm audit` in `mobile/` reports 3 moderate findings. They were there before the
  plugin, and come from the dev-only `@capacitor/cli` (via `xcode` and `uuid`,
  which is iOS tooling), so nothing shipped carries them.

**For Tressette and Scopetta:**
- The same moves, including the Exit button.
- Map the Back table onto each game's own `back()`, confirm dialog and end
  screen. Scopetta's `back()` returns to `cameFrom`; Tressette's end-of-hand
  screen goes to the start screen, as Discola's end screen does.
- Check whether the game has a path to the start screen that keeps the hand
  alive, as Discola's "Cambia avversario" does; if so, Exit and Back there must
  ask first.
- Copy `android back`, `android exit`, `tap()` and the `start` pass's hidden-Exit
  assertion, and change the expected trails to that game's screens.

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

#### 1.3 English

**What changed** (Discola, all in `public/index.html`):
- **The markup stays Italian,** and each string gets a key:
  - `data-i18n` for text;
  - `data-i18n-html` for paragraphs that carry `<code>`, `<strong>` or a link;
  - `data-i18n-label` for a tool's `title` plus `aria-label`;
  - `data-i18n-aria` for `aria-label` alone.
  Labels that wrap a control get their text in a `<span data-i18n>`, so
  translating them can't remove the control.
- **Two tables:**
  - `EN` holds every markup key plus the strings the script builds (verdicts,
    notes, dossiers, card labels, history labels, the date locale);
  - `IT` holds only the script-built strings, **because `snapshotItalian()`
    reads the markup's Italian into `IT` at boot**, so no Italian sentence is
    written twice.
  - `t(key, …args)` picks the current language. Entries can be functions for
    strings with a name or a score in them.
- **`applyLang(lang)`** retranslates the tagged markup, sets `<html lang>` and
  `#langSel`, then redoes what the script built: deck labels, the dossier,
  `render()`, the last result, Storico if open, and the end screen's verdict.
  `finish()` keeps `{you, opp, opponent}`, so a switch while the end screen is
  up re-renders it.
- **The choice:**
  - Italian unless `navigator.language` isn't Italian;
  - a selector in Impostazioni labelled **"Lingua · Language"**, never
    translated so it can be found from either language;
  - saved **only once chosen** (`state.langPicked`), so until then the
    language follows the device.
  - `start()` decides the language **before** `selectOpponent()`, which saves,
    or a chosen language would be overwritten at boot.
- **Game terms stay Italian in both:** Denari, Coppe, the deck names, Briscola.
  In English the trump line reads "trumps: spade".
- **The privacy policy** gained "the language, if you choose one" in its list of
  stored settings, and the English button name.

**The check:**
- **Every page is opened with an explicit locale.** Headless Chromium reports
  `en-US`, so once the game followed the device, the existing passes would
  silently have run in English.
- The screens pass runs in `it-IT` at five shapes, then in `en-US` at three
  (`EN_VIEWPORTS`), with `englishAudit`:
  - `<html lang="en">`;
  - no Italian UI word in visible text or in a label, outside `[lang="it"]` and
    the bilingual language label.
- The document pass has **"both languages cover the same keys"** (`IT` and `EN`
  key sets equal, and every tagged key in `EN`), and re-reads `#privacyLink`
  after switching to English, since that paragraph is rebuilt.
- **Proven to fail:** with "Ancora" untagged and `EN.felt` deleted, it reported
  "no English for: felt", "English strings nothing uses: again", and "Italian
  left on the English page: Ancora" on every end-screen scenario.

**Gotchas:**
- The locale pin above is the one that would cost a week: nothing fails, the
  Italian coverage just disappears.
- An Italian-word list is a heuristic. Game terms must stay off it, and an
  element deliberately in Italian can be marked `lang="it"`.
- `innerHTML` from `data-i18n-html` only ever comes from the two tables, never
  from input.

**For Tressette and Scopetta:**
- Same shape. Grep each game's `index.html` for `textContent =` and template
  strings to find what the script builds. Tressette's counting grid is the big
  item there.
- **Parts are already bilingual.** Scopetta's rules screen (`viewRules`) shows
  both languages one after the other. Tressette's Informazioni ends with an
  English section (`<section lang="en">`, "The rules"). Keep them as they are,
  or show only the current language's section, but leave the Italian one marked
  `lang="it"`, so the English audit skips it.
- Copy `englishAudit`, the locale pin and the key-parity check, then extend
  the Italian-word list with each game's own terms that are *not* game terms.

#### 1.4 Edge-to-edge

**Analysis, no code change.** Targeting API 36 makes Android 15+ draw the app
edge to edge. Capacitor 8 handles this through its built-in `SystemBars`
plugin (`Bridge.java` registers it), whose default `insetsHandling` is
`"css"`:
- on WebView/Chromium ≥ 140 the web view honours the page's `viewport-fit`;
- on older versions it pads the web view.

Discola's viewport meta is `width=device-width, initial-scale=1`, **without**
`viewport-fit=cover`, so the page is laid out inside the safe area and the top
bar should not sit under the status bar. The page already uses
`env(safe-area-inset-bottom)` for the start footer. It is 0 here, and would
matter only if the page asked for `cover`.

**Device check (owner, next smoke):** install on an Android 15 or 16 phone.
The top bar clears the status bar, and the start footer and the end screen's
actions clear the navigation bar, in portrait and in landscape.

**For Tressette and Scopetta:** both viewport metas are
`width=device-width, initial-scale=1`, without `viewport-fit=cover` (checked
2026-09-25), so the same reasoning and the same device check apply. If either
ever adds `cover`, its top bar and pinned footers need
`env(safe-area-inset-*)` padding.

#### 1.5 Store assets

**What changed:** `tools/store_assets.mjs` renders everything from `public/`
into `dist-store/` (gitignored), so the assets can be regenerated from any
tagged commit:

| File | Size | For |
|---|---|---|
| `play/{it,en}/01-start … 04-history.png` | 1080×2160 | Play phone screenshots; **Bresciane hidden**, as the Play build leaves it out |
| `itch/{it,en}/…` | 1080×2160 | itch.io screenshots, all six decks |
| `feature-graphic-{it,en}.png` | 1024×500 | Play feature graphic |
| `itch-cover.png` | 630×500 | itch.io cover |
| `icon-512.png` | 512×512 | Play hi-res icon (`public/icons`) |

- **The deal is seeded** (mulberry32, installed before the page's script), so
  the same commit renders the same screenshots. The table shot plays two real
  tricks first.
- **Every PNG is read back and its size checked,** and a script or console error
  during capture fails the run.
- **Checked by looking, not only by size.** Three defects showed only in the
  images:
  - the cards in the graphics were blurry, and bled the neighbouring cells'
    edges;
  - the cover's fan covered the wordmark;
  - at 1080×1920 the start screen cropped the deck row under the pinned
    footer.

**Gotchas:**
- **The card art is 60×125 per sprite cell.** Scale it by a whole number with
  `image-rendering: pixelated`, as `tools/make_icons.py` does for the icon;
  smoothing blurs it and bleeds the neighbouring cells in. Scale the corner
  radius with the card, or the bitmaps' green corners show.
- **Play's tallest screenshot shape is 2:1.** 360×720 at 3× gives 1080×2160.
- **No price, rank or "free" in the graphics or the title** (Play's metadata
  policy).

**Listing text (draft, for the owner):**

| | Italiano | English |
|---|---|---|
| Title (≤30) | Discola – Briscola a due | Discola – Two-player Briscola |
| Short (≤80) | Briscola a due contro il computer. Offline, senza pubblicità, senza account. | Two-player Briscola against the computer. Offline, no ads, no account. |

Full description, Italiano:
> Discola è la briscola a due del 1997, riportata sul telefono. Giochi contro
> quattro avversari con il loro carattere — Valerio, Graziano, Piero e Franco —
> con i mazzi regionali: Trevisane, Piacentine, Napoletane, Romagnole e
> Francesi. Funziona senza connessione, non ha pubblicità, non chiede account e
> non raccoglie dati: lo storico delle partite resta sul dispositivo. In
> italiano e in inglese.

Full description, English:
> Discola is the two-player Briscola of 1997, back on your phone. Play four
> opponents with characters of their own — Valerio, Graziano, Piero and Franco
> — with the regional Italian decks: Trevisane, Piacentine, Napoletane,
> Romagnole and Francesi. It works offline, has no ads, asks for no account and
> collects no data: your match history stays on the device. In Italian and
> English.

The itch.io page takes the same text, with Bresciane added to the decks.

**For Tressette and Scopetta:** copy the script and change the shot list: each
game's screens, its end-of-hand or counting screen, and a mid-game table. Also
change the history seed's keys, the deck the graphics fan out, the wordmark and
the lines, and the decks the Play set hides.

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
