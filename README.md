# Discola — web port

A two-player Briscola game, originally written in Delphi 3 in 1997. This is a
port to the web — one HTML page and one plain-JS engine file — so it runs on any
modern computer without an installer.

**Play it:** <https://discola.netlify.app>

Or open `public/index.html` locally, or serve `public/` with any static web
server — it is plain static files with no build step. `engine.js` is loaded as a
classic script rather than an ES module, so opening the page from `file://`
keeps working.

## What is faithful to the original

The rules engine is a direct transcription of `UMazzo.pas`, and the opponent is
a transcription of `TGiocatore.CompGioca` in `UGiocatore.pas` — the same scoring
formula with the same tuned weights from `Global.pas`:

| Opponent | Character |
|----------|-----------|
| Valerio  | The house standard, and the original default. |
| Graziano | The loosest of the four — cheapest with his briscole. |
| Piero    | Weights randomised once per session, exactly as `SetProfiles` did. |
| Franco   | The tightest: highest penalties across the board. |

Also carried over:

- The bottom card of the shuffled deck names the trump suit, and is drawn last.
- The winner of a trick draws first; whoever did not lead a hand leads the next.
- The shuffle is the original's 200 + `Random(100)` random swaps.
- The deck, felt colour, animation speed and show-points options from the
  `Opzioni` record, persisted to `localStorage` instead of `Discola.ini`.
- The `6winouj64ie` keystroke easter egg, which turns the opponent's hand face up.

`Piero`'s randomised temperament is rolled once at startup rather than per hand,
because that is where `SetProfiles` sat — called from `FormCreate`. It is not a
bug, just where the randomisation lives, and it gives Piero one personality per
sitting instead of fresh noise every deal.

## What changed

- The card bitmaps are the originals, repacked into one PNG sprite sheet per
  deck (see `tools/`). Nothing was redrawn.
- The MIDI soundtrack (`macarena_2.mid`) is gone; card sounds are synthesised
  with WebAudio instead.
- `SemiAndati` and `CountCarte` walked the seen-cards list from index 1 rather
  than 0 — a `TList` is zero-based — so the opponent never counted the first
  card it was dealt. Fixed. It was worth almost nothing: over 40,000 simulated
  hands per profile the win rate moved by at most 0.56 percentage points and the
  mean score by at most 0.2 of 120, both inside the noise floor. One forgotten
  card out of the twenty-odd tracked rarely flips a comparison that briscola and
  card values already dominate.
- `Discola.dpr` never called `Application.CreateForm` for `DifficultyDlg` and
  `OKRightDlg`, so the difficulty and release-notes dialogs would fault in that
  project — `Briscolino.dpr` was the complete one. Neither dialog is ported: the
  difficulty setting (`Opzioni.Difficolta`) was never read by the game logic.

## Provenance

- Delphi 3 source: [`diegoami/discola-PAS`](https://github.com/diegoami/discola-PAS)
- Card bitmaps (211 BMPs, five decks): [`diegoami/briscola-JS`](https://github.com/diegoami/briscola-JS)

The original release installer cannot be run on a modern computer: its
`SETUP.EXE` is a 16-bit NE executable, and 64-bit Windows has no 16-bit
subsystem. That is what this port is for.

## Running it locally

```sh
npm start          # http://localhost:8080
```

Or open `public/index.html` straight from disk. The server exists because a
service worker, a web app manifest and the Android wrapper all need a real
origin rather than `file://`, and because it binds `0.0.0.0`, so the portrait
layout can be opened on a phone on the same network.

## Checking the UI

`tools/check_ui.mjs` drives every screen and dialog across nineteen viewports
and all six decks, asserting the things that break silently: overlapping
cards, a hand below the fold, rows drifting apart, text below its size floor,
tap targets under 32px, more than one screen visible at once, script errors, and
a page that would have needed the network to look right.

```sh
npm run setup     # once: playwright-core and a Chromium binary
npm run check
```

Run it after any UI change. Every threshold in it is calibrated against a
defect that actually shipped; the file says which.

## The fonts

Bodoni Moda, Barlow and Barlow Condensed are served from `public/fonts/` —
172 KB of `latin`-subset woff2 — not from Google. The page has no external
subresources at all, which is what lets it work with the network off and is
what makes "nothing leaves the device" true rather than nearly true.

`tools/check_ui.mjs` asserts all three of those: every character in the source
is inside the shipped subset, every `@font-face` loads with the network cut,
and nothing is fetched from the network. Adding a character outside the subset
or a CDN link fails the check.

## The app icon

The icon is the fante di spade of the Trevisane deck — *la vecia*, in Veneto,
moustache notwithstanding. `tools/make_icons.py` crops its top half out of the
sprite sheet and writes the web sizes into `public/icons/` and the 1024px
sources for `@capacitor/assets` into `assets/`:

```sh
python3 tools/make_icons.py
```

Pure standard library, and nearest-neighbour throughout — the source is a 50x50
patch of 1997 bitmap, and smoothing it would be redrawing the art.

## Rebuilding the sprite sheets

`tools/pack_cards.py` reads the original 8-bit Windows BMPs and writes one RGBA
PNG per deck on an 11x4 grid — columns 0-9 are card numbers 1-10, rows 0-3 are
the suits in `TSeme` order (Denari, Coppe, Spade, Bastoni), and column 10 row 0
is the card back. Cards within a deck are not all the same size, so each cell is
the deck's maximum and every card is centred in it over transparent padding.

Pure standard library, no dependencies:

```sh
python3 tools/pack_cards.py /path/to/briscola-JS public/decks/
```

## The Bresciane deck

The five original decks are the 1997 bitmaps. A sixth, **Bresciane**, is imported
from [`mhamilt/Italian-decks`](https://github.com/mhamilt/Italian-decks) by
`tools/import_bresciane.mjs`, which composes the source's per-card images into
the same 11x4 sheet and writes `public/decks/bresciane.jpg` (JPEG, not PNG: the
source is photographic and lossless PNG of it runs to ~12 MB).

Provenance and licence, plainly: the source repo is labelled GPLv3, but the
images are a scan of a commercial Teodomiro Dal Negro deck — the Asso di denari
carries the maker's stamp. That is the same copyright grey area as the original
decks, not a cleanly-licensed set. Noted so it is a deliberate choice, not a
surprise.

```sh
node tools/import_bresciane.mjs
```
