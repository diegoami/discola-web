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
| 1.1 | Android Back button goes back a screen | todo |
| 1.2 | Privacy policy page, linked from Informazioni | todo |
| 1.3 | English, switchable, Italian by default | todo |
| 1.4 | Edge-to-edge on Android 15/16 (device check) | todo |
| 1.5 | Store assets: feature graphic, screenshots, itch.io cover | todo |

Each step gets its own section below when it lands: what changed, the check
that guards it, and the gotchas, written for the next game.

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
