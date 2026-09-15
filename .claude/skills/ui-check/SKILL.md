---
name: ui-check
description: Run Discola's UI checks across every screen, dialog and viewport. Use after any change to index.html's markup, CSS, screen flow or typography — and always before committing or publishing a UI change. Also use when a layout or readability bug is reported, to reproduce it and to confirm the fix.
---

# UI check

Discola is one HTML file with five screens and two dialogs, and it has to work
from a 360px phone to a 1920px desktop, in both orientations, with five decks
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

To check a file that is not `index.html` — an older revision, say — pass it as
an argument. That is how you confirm an assertion really catches the bug it
was written for:

```sh
git show <commit>:index.html > .old.html
node tools/check_ui.mjs "$PWD/.old.html"; rm .old.html
```

## What it covers

**Screens pass** — all five screens plus the confirm and end-of-match dialogs,
at five real device shapes. Asserts exactly one screen is visible, no sideways
scroll, no text below its size floor, no text clipped by a container that
cannot scroll, no tap target under 32px, and no script or console errors.

**Table pass** — the card table at all nineteen viewports in all five decks.
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
| inflated spacing | `--chrome` was hand-estimated three times and was wrong three times |

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
