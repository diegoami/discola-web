---
name: ui-check
description: Run Discola's UI checks across every screen, dialog and viewport. Use after any change to public/index.html's markup, CSS, screen flow or typography — and always before committing or publishing a UI change. Also use when a layout or readability bug is reported, to reproduce it and to confirm the fix.
---

# UI check

Discola is one HTML page plus a plain-JS engine file, with five screens and two dialogs, and it has to work
from a 360px phone to a 1920px desktop, in both orientations, with six decks
whose cards have different aspect ratios. Nearly every UI defect this project
shipped was invisible to code review and threw no error. This check exists
because reading the diff was repeatedly not enough.

## Run it

```sh
node tools/check_ui.mjs
```

Exit code 0 means clean. It takes a few minutes; let it finish rather than
interrupting it.

It needs `playwright-core` and a Chromium binary:

```sh
npm i playwright-core && npx playwright install chromium
CHROME=/path/to/chrome node tools/check_ui.mjs      # if Chromium is elsewhere
```

To check a file that is not `public/index.html` — an older revision, say — pass
it as an argument. That is how you confirm an assertion really catches the bug
it was written for:

```sh
git show <commit>:public/index.html > public/.old.html
node tools/check_ui.mjs "$PWD/public/.old.html"; rm public/.old.html
```

## What it covers

**Screens pass** — all five screens plus the confirm and end-of-match dialogs,
at five real device shapes. Asserts exactly one screen is visible, no sideways
scroll, no text below its size floor, no text clipped by a container that
cannot scroll, no tap target under 32px, and no script or console errors. It also
requires an opaque background under every `select` and `option`, and that the
deck picker stays on one row.

**Languages** — every page is opened with an explicit locale. The game follows
the device language, and headless Chromium reports `en-US`, so without it the
Italian passes would silently become English ones. The screens pass runs in
`it-IT` at five shapes, then again in `en-US` at three. There, the English audit
fails on `<html lang>` not being `en`, or on an Italian UI word left in visible
text or in a label. The document pass checks that the Italian and English tables
cover exactly the same keys.

**Table pass** — the card table at all nineteen viewports in all six decks.
Asserts the trick never overlaps either hand, your hand is never below the
fold, nothing overflows the table, and the rows never drift apart. Then it
repeats the tightest viewports with the spacing tokens inflated, which fails if
anyone replaces the derived `--chrome` with a hard-coded number.

## Reading a failure

Each line names the screen, the viewport and the element. Fix the page, not the
threshold. Every threshold is calibrated against a defect that actually
shipped:

| assertion | the bug it was written for |
|---|---|
| one screen visible | `.view` and `.scrim` declare `display`, which beats the UA `[hidden]{display:none}`; every screen rendered at once behind a click-eating scrim |
| text floors, 12.5px label / 14.5px body | opponent descriptions ran at 12.5px and deck labels at 11.5px |
| your hand above the fold | a portrait tablet pushed the player's own hand off screen |
| trick vs hands | a phone in landscape collapsed the middle row and the played cards landed on top of the hand |
| rows drift apart | cards hit their cap, and the grid handed the leftover height to the gaps until a third of the table was empty |
| opaque select/option | the deck dropdown opened as light text on a white Windows system menu |
| one deck row | a hard-coded column count wrapped the sixth deck onto a second row, moving the controls below it |
| inflated spacing | `--chrome` was hand-estimated three times and was wrong three times |
| swatch inside its tile | a deck stretched to the tallest deck's height took its width from its aspect ratio and spilled over its neighbours, at every viewport (#44) |
| end screen covers the table | the end of the match was a popup over the page; it is a screen over the table, with its actions in view and the covered table inert (#42) |
| android back | Capacitor's core closes the app on Back from any screen; the stand-in plugin proves Back backs out of sheets and minimises elsewhere (`STORES.md` 1.1) |
| privacy page | Play needs a reachable policy; the link must open the public URL in a new tab, and the page must carry no script and fetch nothing (`STORES.md` 1.2) |
| same keys in both languages, no Italian on the English page | a string added in one language only, or left untagged, shows up as Italian in the English UI (`STORES.md` 1.3) |

If you believe a threshold is genuinely wrong, change it — then run the check
against the commit that introduced the bug it names and confirm it still fails
there. A threshold that no longer catches its own bug is worse than none.

## Extending it

Add a screen to `SCREENS` with a function that navigates to it. Add a device to
`VIEWPORTS`, and to `SCREEN_VIEWPORTS` if that shape can break a sheet rather
than only the table.

When adding an assertion, first make it fail on the broken version. An
assertion written against already-correct code tends to encode what the code
happens to do rather than what it should do — the gap metric here was written
that way once and passed the broken layout while failing every good one.
