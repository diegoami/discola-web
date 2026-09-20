# Discola

A two-player Briscola game, ported to the web from the Delphi 3 original of
1997. One self-contained `public/index.html`: five screens, two dialogs, six card
decks drawn from sprite sheets of the original bitmaps (five PNG, one JPEG).

## After any UI change, run the UI check

```sh
node tools/check_ui.mjs
```

Not optional, and not only when something looks wrong. Every UI defect this
project shipped was invisible in the diff and threw no error: cards overlapping
the hand, the player's own hand pushed below the fold, the table drifting apart
until it stopped reading as one surface, body copy at 12.5px, and every screen
rendering at once behind a click-eating overlay. Reading the diff caught none of
them; the check catches all of them.

The `ui-check` skill explains what it covers and how to read a failure.

## The card size is a budget

`--cw` is `(viewport height - --chrome) / --rows / --ratio`, clamped. `--chrome`
is **derived** from the spacing tokens next to it — never hard-code it. It was
hand-estimated three times and wrong three times, silently, because a card too
tall for its row does not error, it just lands on the hand below. `--rows` is 3
in landscape and 4 in portrait, where the trick and the tallone stack.

## The engine is a transcription, not a rewrite

The rules come from `UMazzo.pas` and the opponent from
`TGiocatore.CompGioca` in `UGiocatore.pas`, with the twelve tuned weights per
profile from `Global.pas`. Keep it that way: if the opponent's play needs
changing, change the weights, not the scoring formula.

One 1997 behaviour is preserved deliberately and marked in the source — Piero's
weights are rolled once per session, because `SetProfiles` ran from
`FormCreate`. It is not a bug.

## Conventions

- Player-facing text is Italian. Comments and commit messages are English.
- No build step and no runtime dependencies. `playwright-core` is for the check
  only and is gitignored.
- The card art is the original 1997 bitmaps. Do not redraw it. `tools/pack_cards.py`
  repacks it from the BMPs in `diegoami/briscola-JS`.
