# Discola — web port

A two-player Briscola game, originally written in Delphi 3 in 1997. This is a
port to a single self-contained HTML page, so it runs on any modern computer
without an installer.

**Play it:** <https://discola.netlify.app>

Or open `public/index.html` locally, or serve `public/` with any static web
server — it is plain static files with no build step.

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

## Checking the UI

`tools/check_ui.mjs` drives every screen and dialog across nineteen viewports
and all five decks, asserting the things that break silently: overlapping
cards, a hand below the fold, rows drifting apart, text below its size floor,
tap targets under 32px, more than one screen visible at once, script errors.

```sh
npm i playwright-core && npx playwright install chromium
node tools/check_ui.mjs
```

Run it after any UI change. Every threshold in it is calibrated against a
defect that actually shipped; the file says which.

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
