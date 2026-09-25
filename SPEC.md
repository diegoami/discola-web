# Discola — specification and handover

A two-player Briscola game for the browser, ported from a Delphi 3 original
written in 1997. This document is meant to be enough to take the project over
without talking to anyone who worked on it.

Live at <https://discola.netlify.app>. Source at
[`diegoami/discola-web`](https://github.com/diegoami/discola-web). The 1997
Delphi source is archived separately at
[`diegoami/discola-PAS`](https://github.com/diegoami/discola-PAS).

---

## 1. Why this exists

Discola shipped in 1997 as an InstallShield Express package. That installer
cannot be run on a modern machine: its `SETUP.EXE` is a 16-bit NE executable,
and 64-bit Windows has no 16-bit subsystem. The game was not lost — the Pascal
sources survived, and the card bitmaps survived in a later, abandoned
JavaScript port — but it was unplayable.

The port exists to make it playable again, on anything with a browser, without
an installer, indefinitely. That framing drives most of the decisions below:
longevity and zero operational surface beat features.

## 2. Scope

**In scope.** Two-player Briscola against the computer. The four original
opponents. The five original card decks, plus an imported Bresciane deck (§10).
Settings that existed in 1997 (deck, felt colour, animation speed, show-points,
sound). Match history kept on the device. Five screens, two dialogs. Italian UI, with English (§7, `STORES.md` 1.3).
The web build is also packaged as an Android app (§12).

**Out of scope, deliberately.**

| Not built | Why |
|---|---|
| Multiplayer, accounts, server | Any server is an operational liability that outlives interest in the project. It must keep working untouched for years. |
| A framework or build step *for the web build* | Plain HTML and JS with no build step still opens in ten years. A 2026 build pipeline will not. Packaging tooling exists for the native apps only (Capacitor for Android, Tauri for desktop), and it wraps `public/` unchanged — the web build stays a directory of static files that opens with no toolchain. See [`ANDROID.md`](ANDROID.md). |
| Four-player Briscola, other variants | The original was two-player. Scope is fidelity, not a card-game suite. |
| Difficulty slider | `Opzioni.Difficolta` existed in the Pascal but nothing ever read it. Porting a dead setting would be inventing behaviour. |
| Localisation | The game is Italian and its terms of art are Italian. Translating *briscola*, *tallone*, *carico* loses more than it gains. |
| MIDI soundtrack | The original played `macarena_2.mid`. Not shipped; card sounds are synthesised instead. |

**Non-goals.** Making the opponent stronger. Modernising the AI. Redrawing the
card art. Each would make it a different game wearing this one's name.

## 3. Provenance and the fidelity contract

The rules engine is a transcription of `UMazzo.pas`. The opponent is a
transcription of `TGiocatore.CompGioca` in `UGiocatore.pas`, using the twelve
tuned weights per profile from `Global.pas`. The card images are the original
8-bit Windows bitmaps, repacked but not redrawn.

**The contract: if the opponent's play needs changing, change a weight, not the
scoring formula.** The formula is the artefact. The weights are its parameters
and were tuned by the original author against human play.

Two 1997 quirks were examined explicitly.

- **The seen-cards off-by-one.** `SemiAndati` and `CountCarte` walked
  `CarteViste` from index 1, not 0 — a `TList` is zero-based — so the opponent
  never counted the first card it was dealt. **Fixed.** It was safe to fix
  because it was worth almost nothing: across 40,000 simulated hands per
  profile, with both seats playing `CompGioca` and only the start index
  varying, win rate moved by at most 0.56 percentage points against a noise
  floor of about 0.35, and mean score by at most 0.2 of 120.
- **Piero's randomisation.** `SetProfiles` ran from `FormCreate`, so Piero's
  weights are drawn once per session rather than per hand. **Kept.** It is not
  a bug, only where the randomisation lives, and it gives Piero one personality
  per sitting instead of fresh noise every deal.

## 4. Architecture

### 4.1 One file

`public/index.html` (~1850 lines) contains the markup, the stylesheet and the script.
No build step, no runtime dependencies, no imports. Deployment is copying files
to a static host.

The cost is a long file. It is mitigated by hard section banners in both the
CSS and the JS, in the order below, and by the fact that nothing is
tree-shaken, minified or transformed between what you read and what runs — the
file you debug in the browser is the file in the repository.

### 4.2 Map of `public/index.html`

```
<title>, font link
<style>
  :root                tokens: palette, spacing, layout budget, type scale
  screens              .view, one visible at a time
  the icon bar         .topbar and its four tools
  the table            .table grid, seats, cards, trick, tallone, plates
  sheets               start / settings / history / about chrome
  controls             buttons, fields, toggles, prose
  match history        tally, log rows
  end of match         the confirm modal, and the end screen over the table
  portrait             --rows: 4, stacked middle
  short landscape      reclaimed chrome
  phone-shaped         the whole type scale re-expressed in vw
  reduced motion
markup                 5 .view blocks (the end screen inside the table), then the confirm .scrim
<script>
  cards                UMazzo.pas: value, ranking, deck, shuffle
  opponent profiles    Global.pas: the twelve weights x four
  game state           the single `state` object
  dealing              pop / pesca / newHand
  the opponent         CompGioca
  turns                humanPlay / computerPlay / resolve / finish
  sound                WebAudio card flick
  rendering            el map, faceOf, render, sweep
  screens              show / back / abandon
  match history        localStorage
  settings             deck, felt, opponent, weights table
  persistence          localStorage
  input                keyboard, buttons, the cheat code
  boot                 start()
```

### 4.3 State

One mutable object, `state`. There is no store, no reducer, no observer. Every
mutation is followed by an explicit `render()`.

```js
cards[40]       the shuffled deck; cards[39] is the briscola
next            index of the next card to draw (Pascal's Tallone - 1)
briscola        suit index 0..3
hands[2][3]     BASSO = 0 (you), ALTO = 1 (opponent); null = empty slot
played[2]       the two cards on the table, or null
scores[2]       points taken, 0..120
seen[]          what the opponent has seen: its own draws, plus your plays
perPrimo        who leads the current trick
deveGiocare     whose turn it is
partitaPrimo    who leads the next hand; alternates
over            the hand has finished
dealt           a hand has been dealt at least once this session
cheat           the opponent's hand is face up
opponent, deck, felt, speed, showPoints, sound   settings
```

`render()` reads `state` and writes the DOM. It is idempotent and cheap: three
hand slots per player are created once at boot and reused, so there is no
reconciliation and no list diffing.

### 4.4 Turn flow

Timers drive the opponent, as in the original. Every scheduled callback goes
through `later()`, which captures an `epoch`; `newHand()` and `abandon()`
increment the epoch, which makes anything already queued a no-op. Without that,
an abandoned hand keeps playing itself out behind the start screen and writes a
phantom result into history — this happened, and the epoch guard is the fix.

```
newHand ──► render ──► (if opponent leads) computerPlay
humanPlay ──► trick complete? ──► resolve ──► draw ──► computerPlay
                      └── no ──► computerPlay
resolve ──► hands empty? ──► finish ──► record ──► end screen
```

## 5. Game rules as implemented

Forty cards: four suits (denari, coppe, spade, bastoni) numbered 1–10.

| Card | Number | Points | Rank |
|---|---|---|---|
| Asso | 1 | 11 | highest |
| Tre | 3 | 10 | 2nd |
| Re | 10 | 4 | 3rd |
| Cavallo | 9 | 3 | 4th |
| Fante | 8 | 2 | 5th |
| 7 down to 2 | 7…2 | 0 | by number |

120 points in the deck; 61 wins; 60–60 is a draw.

- The deck is shuffled by 200 + `Random(100)` random position swaps — the
  original's algorithm, kept.
- `cards[39]`, the bottom card, names the trump suit and is drawn last.
- You are dealt cards 0–2, the opponent 3–5. Nobody sees the other's hand.
- A trick: the leader plays, the follower answers. Following suit is not
  required. A briscola beats any non-briscola; between two of the same suit the
  higher rank wins; between two different non-briscola suits the leader wins.
- The winner takes both cards' points, leads the next trick, and draws first.
- "Ultima mano" shows when two cards remain in the stock.
- The hand ends when both hands are empty; the result is recorded.
- Whoever did not lead a hand leads the next one.

## 6. The opponent

`compGioca(against)` scores each card in hand and plays the highest, ties going
to the lowest slot. `P` is the chosen profile's weights, `pointsSeen(s)` is the
point value of seen cards in suit `s`, `countSeen(s)` their count.

**Leading** — shed the cheapest card that is neither a briscola nor worth
points:

```
v = value(c)
if suit(c) is briscola:  score = 100 − FIXED_BRISCOLA_PENALTY − v×VARIANT_BRISCOLA_PENALTY
else:                    score = 100 − v×(1 − VARIANT_CARICO_PENALTY×countSeen(briscola))
                         if v < 10: score += pointsSeen(suit(c))×VARIANT_STROZZO_PENALTY
if v == 10:              score −= FIXED_TRE_PENALTY
```

**Following** — weigh what the trick is worth against what taking it costs:

```
takes = beats(c, lead, iLed);  L = value(lead);  v = value(c)
score = takes ?  L + v×VARIANT_WINNING_CARD_PENALTY
              : −L×VARIANT_WINNING_CARD_PENALTY − v
if suit(c) is briscola:
    score −= takes ? v×VARIANT_WINNER_BRISCOLA_PENALTY + FIXED_WINNER_BRISCOLA_PENALTY
                   : v×VARIANT_LOSER_BRISCOLA_PENALTY  + FIXED_LOSER_BRISCOLA_PENALTY
else if v < 10:
    score −= pointsSeen(suit(c)) × VARIANT_PASSIVE_STROZZO_PENALTY
if two cards remain and takes:          # taking would hand over the face-up briscola
    score −= value(briscolaCard)×VARIANT_WINNER_BRISCOLA_PENALTY + FIXED_WINNER_BRISCOLA_PENALTY
if v == 11:  score −= ASSO_PENALTY
```

### The four profiles

| Weight | Valerio | Graziano | Franco | Piero |
|---|---|---|---|---|
| FIXED_BRISCOLA_PENALTY | 3 | 2 | 4.5 | 2 + rand(3) |
| VARIANT_BRISCOLA_PENALTY | 0.7 | 0.8 | 0.5 | 0.5 + rand/3 |
| VARIANT_CARICO_PENALTY | 0.045 | 0.065 | 0.085 | 0.045 + rand/20 |
| VARIANT_STROZZO_PENALTY | 0.45 | 0.30 | 0.50 | 0.3 + rand/5 |
| FIXED_TRE_PENALTY | 2.5 | 1.5 | 3.0 | 1 + rand(2) |
| VARIANT_WINNING_CARD_PENALTY | 0.6 | 0.5 | 0.7 | 0.5 + rand/4 |
| FIXED_WINNER_BRISCOLA_PENALTY | 4 | 3 | 5 | 3 + rand(2) |
| VARIANT_WINNER_BRISCOLA_PENALTY | 1.2 | 1.1 | 1.0 | 0.9 + rand |
| FIXED_LOSER_BRISCOLA_PENALTY | 5.5 | 4.5 | 6.0 | 5 + rand(2) |
| VARIANT_LOSER_BRISCOLA_PENALTY | 1.6 | 1.4 | 1.2 | 0.8 + rand/2 |
| VARIANT_PASSIVE_STROZZO_PENALTY | 0.18 | 0.10 | 0.23 | 0.15 + rand/10 |
| ASSO_PENALTY | 1.5 | 1.0 | 2.0 | 1 + rand |

`rand(n)` is an integer in 0…n−1, `rand` a real in [0,1) — Pascal's `Random`
semantics. Valerio is the default and the original's.

The profiles differ only in these numbers; they share one formula. Higher
penalties mean a more conservative player, so Franco holds briscole and Graziano
spends them.

## 7. Screens

Five `.view` blocks, exactly one visible. Two dialogs: the confirm overlays the
page, and the end screen covers the table (and only the table).

```
start ──Gioca──► table ──┬─ reload icon ─► confirm ─► start
                         ├─ history icon ─► history ─back─► table
                         ├─ settings icon ─► settings ─back─► table
                         └─ about icon ────► about ───back─► table
table ──hand empty──► result ──┬─ Ancora ───────► table (new hand)
                               └─ Impostazioni ─► settings ─back─► result
```

- **start** — pick opponent and deck, then play. Nothing is dealt until Gioca.
  The four opponents are names; the chosen one's description is shown. Gioca is
  a pinned footer, so it is never below the fold.
- **table** — the game, with a four-icon bar: new game, history, settings, about.
- **settings** — deck, felt colour, rhythm, show points, sound, change opponent,
  and a disclosure showing the chosen profile's twelve raw weights.
- **history** — tally, record against each opponent, the last hundred matches,
  and a clear button. Empty state when there is nothing yet.
- **about** — what the game is and where it came from.
- **confirm** — guards abandoning a hand in progress. Skipped once the hand is over.
- **result** — end of the match, a screen over the table rather than a popup (#42),
  in Tressette's and Scopetta's shape: the score, the note, and the opponent and
  deck pickers, which scroll, above two pinned actions, Ancora and Impostazioni.
  The covered table and its icon bar are inert while it is up. No Escape.

Escape backs out of a sheet or dismisses the confirm. Keys `1`, `2`, `3` play a
card. Typing `6winouj64ie` turns the opponent's hand face up — the original's
easter egg, kept.

## 8. Layout

Two things here are load-bearing and easy to break. Both have failed in
production and both are asserted by the UI check.

### 8.1 The card size is a budget

```css
--chrome: calc(--topbar + 2×--pad-block + 2×--step + 2×--trick-pad
               + --extra-gap + --slack);
--cw: clamp(32px, min(9vw,  (100dvh − --chrome) / --rows / --ratio), 156px);  /* landscape */
--cw: clamp(40px, min(22vw, (100dvh − --chrome) / --rows / --ratio), 168px);  /* portrait  */
--ch: calc(--cw × --ratio);
```

`--rows` is the number of card rows down the table: **3** in landscape, where
the trick and the tallone sit side by side, and **4** in portrait, where they
stack. `--ratio` is the deck's own aspect, which differs per deck. Portrait gets
a wider `vw` term and a higher cap because the table has the full width there;
the caps exist only to stop a card growing absurdly on a very large screen, and
both were raised once already when they started binding before the height budget
did, which is what made the table drift apart.

**`--chrome` must stay derived.** It is the vertical space spent on things that
are not cards, and it is computed from the spacing tokens declared beside it. It
was hand-estimated three times and wrong three times, silently: a card too tall
for its row does not throw, it just lands on the hand below.

Two supporting rules:

- The table's rows are `auto` with `align-content: safe center`, so leftover
  height sits above and below the group rather than being shared out between the
  rows. With a `1fr` middle row the table drifted apart once the cards hit their
  cap — a third of the screen was gaps.
- `overflow: hidden auto` on the table. If the budget is ever exceeded the table
  scrolls rather than stacking cards on top of each other.

### 8.2 Type is sized against the viewport on phones

Some Android browsers report 700–1000 CSS px for a six-inch screen. Absolute
`rem` sizes therefore render at roughly half their physical size on such a
device: 18px at a reported 770px is physically smaller than 18px at a reported
393px, on the same glass. Raising the numbers cannot fix it, because the problem
is the unit.

A type scale lives in `:root` (`--t-title`, `--t-body`, `--t-name`, `--t-label`,
`--t-pick`, `--t-cta`, `--t-btn`, `--t-tiny`, `--deck-sw`). A phone-shaped media
query re-expresses the whole scale in `vw`:

```css
@media (orientation: portrait) and (max-aspect-ratio: 3/5) { … }
```

**Aspect ratio is the discriminator, not width.** A phone is 0.45–0.52
wide-over-tall; a portrait tablet is 0.70–0.75. Inside that query the content
column also stops being capped at 620px, and the opponent chips stay two per row.

## 9. Persistence

`localStorage`, on the device, never leaving it. Both reads and writes are
wrapped in `try`/`catch`: a private window or blocked storage degrades to
settings that do not stick, never to an error.

| Key | Shape |
|---|---|
| `discola.settings` | `{opponent, deck, felt, speed, showPoints, sound}` |
| `discola.history` | `[{t, o, d, y, a}, …]` newest first, capped at 100 |

`t` epoch ms, `o` opponent, `d` deck, `y` your score, `a` theirs. The original
wrote the same settings to `Discola.ini`.

## 10. Assets

Six sprite sheets in `public/decks/`, ~2.8 MB total, one per deck. Each is an
11 × 4 grid: **column = card number − 1**, **row = suit** in `TSeme` order
(denari, coppe, spade, bastoni), and **column 10, row 0 is the card back**.

The five original decks are PNG; the sixth, **Bresciane**, is a JPEG (~0.6 MB) —
photographic scans compress poorly as lossless PNG (~12 MB), so `DECK_EXT` in
`public/index.html` marks it JPEG and `deckSheet()` builds the right URL.

Cell sizes differ per deck because the 1997 bitmaps do:

| Deck | Cell | Sheet |
|---|---|---|
| Trevisane | 60 × 125 | 660 × 500 |
| Romagnole | 71 × 112 | 781 × 448 |
| Napoletane | 78 × 128 | 858 × 512 |
| Piacentine | 74 × 128 | 814 × 512 |
| Francesi | 75 × 128 | 825 × 512 |

Cards within a deck are not all the same size, so each is centred in its cell
over transparent padding. `tools/pack_cards.py` rebuilds the five original sheets
from the BMPs in `diegoami/briscola-JS`; `tools/import_bresciane.mjs` builds the
Bresciane sheet from `mhamilt/Italian-decks` (see [`ANDROID.md`](ANDROID.md) and
the README for its provenance and licence caveat). Both are pure standard
library plus, for the JPEG, the Chromium the UI check already uses.

```sh
python3 tools/pack_cards.py /path/to/briscola-JS public/decks/
node tools/import_bresciane.mjs
```

A card is rendered as a `background-position` offset into the sheet, so the
whole deck is one HTTP request and swapping decks is a variable change.

**Fonts.** Bodoni Moda, Barlow and Barlow Condensed are self-hosted in
`public/fonts/` (latin subset, ~0.2 MB), not fetched from Google. The page has
no external subresources at all, which is what lets the Android app run offline
and makes "nothing leaves the device" literally true. The UI check asserts it.

## 11. Testing

`node tools/check_ui.mjs`. Needs `playwright-core` and a Chromium binary; it is
a local command, not CI. The `ui-check` skill in `.claude/skills/` documents it.

Passes: a document/head check; a **fonts** pass (every character is in the
shipped subset, every `@font-face` loads with the network cut, and nothing is
fetched from the network); every screen and dialog at five device shapes; the
card table at nineteen viewports in all **six** decks; then the table again with
spacing tokens inflated.

Every threshold is calibrated against a defect that shipped:

| Assertion | The bug |
|---|---|
| exactly one screen visible | `.view` and `.scrim` declare `display`, which beats the UA `[hidden]{display:none}` — every screen rendered at once behind a click-eating scrim |
| text floors, 12.5px label / 14.5px body | descriptions at 12.5px, deck labels at 11.5px |
| hand above the fold | a portrait tablet pushed the player's own hand off screen |
| trick vs hands | landscape collapsed the middle row and the played cards landed on the hand |
| rows drift apart | cards hit their cap and the grid gave the leftover to the gaps |
| Gioca on screen | readable type pushed the primary action past the fold |
| inflated spacing | `--chrome` was hand-estimated and wrong, three times |
| fonts load offline / no network subresources | the three faces were a `<link>` to Google; offline the wordmark fell back to a generic serif 12% narrower than every threshold was calibrated against, and each launch leaked the device IP |

**The rule: fix the page, not the threshold.** If a threshold is genuinely
wrong, change it and then confirm it still fails the commit that introduced the
bug it names. And write new assertions against the broken version first — the
gap metric here was once written against correct code and passed the broken
layout while failing every good one.

## 12. Deployment

Netlify, site `discola`, linked to this repository. Every push to `main`
redeploys; there is no build step. `netlify.toml` publishes `public/` — and only
`public/`, so the docs, the tooling and netlify.toml itself are never served —
caches `decks/*` and `fonts/*` for a year (they never change once built) and
revalidates `index.html` on every load so a deploy reaches players immediately.
It also redirects `/android` to the latest GitHub release.

**Android.** The same `public/` is packaged as an APK with Capacitor (`mobile/`),
signed and published as a GitHub release on the public `diegoami/discola-releases`
repo; the website links to it. The build, signing and release scripts are in
[`ANDROID.md`](ANDROID.md). The web build is unchanged by any of this.

## 13. Known gaps

- **The UI check cannot see physical size.** Its font floors are absolute, so
  18px passes everywhere — including on a device where 18px is physically tiny.
  Nothing in the DOM says how big the screen is. The practical mitigation is a
  viewport in the list that mimics a phone reporting a wide CSS width, plus a
  rule that phone-shaped viewports must scale their type.
- **No CI.** The check needs a Chromium binary and runs locally. A GitHub Action
  would enforce it on push.
- **Timers run behind sheets.** Opening settings mid-hand does not pause the
  opponent. This matches the 1997 behaviour and is deliberate, but it is a
  reasonable thing to change.
- **Sound is synthesised.** The original's MIDI soundtrack is gone.
- **`public/decks/` is committed.** ~2.8 MB of sheets in the repository, so the
  site works standalone rather than depending on `briscola-JS` at build time.
- **Every deck sheet loads on the start screen**, because the picker previews all
  of them. Adding decks grows that eager load; the Bresciane JPEG adds ~0.6 MB.
  Lazy-loading the previews is the fix if it ever bites.
- **The Bresciane deck is not cleanly licensed.** It is a scan of a commercial
  Dal Negro deck — the same copyright grey area as the original art, a deliberate
  choice, documented in the README and the import script.
- **History is per-device.** No export, no sync. Clearing site data loses it.

## 14. Glossary

| Italian | Meaning |
|---|---|
| briscola | the trump suit, and a card of it |
| tallone | the stock, the undealt pile |
| seme | suit |
| presa | a trick |
| carico | a point-heavy card, asso or tre |
| liscio | a worthless card, 2 through 7 |
| strozzo | leading a suit the opponent has run out of, to bleed their briscole |
| mano | a hand, one deal of forty cards |
| partita | a match, here the same as a hand |
| avversario | opponent |
| mazzo | deck |
