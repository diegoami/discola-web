# Discola

A two-player Briscola game, ported to the web from the Delphi 3 original of
1997. `public/index.html` (the view) plus `public/engine.js` (the rules and the
opponent, loaded as a classic script so `file://` still works): five screens, two
dialogs, six card decks drawn from sprite sheets of the original bitmaps (five
PNG, one JPEG).

This is the one instructions file, for every tool. `CLAUDE.md` only imports it.

## How work flows

- **Propose first, when it is more than a fix.** Open an issue with the
  problem, the findings with `file:line` references, the design and the open
  questions, and get the owner's agreement before implementing. A small fix or
  a documentation change goes straight to a PR.
- **Branch from a fresh `origin/main`** (`git fetch origin` first), open a PR
  that references the issue, and verify it against the agreed design with the
  gates green (*Verification*). The owner merges.
- **After the owner merges**: in the main checkout,
  `git switch main && git pull --ff-only`, then `git branch -d <branch>`.
  Delete the remote branch too, unless GitHub already did. Nothing depends
  on the local `main` being current, since every branch starts from a fresh
  `origin/main`.
- **Worktrees are ad hoc**: use one only to work in parallel with another
  session. Make it with
  `git worktree add --no-track -b <branch> ../discola-web-work/<branch> origin/main`,
  and install the dependencies in it as CI does (`npm ci`, then
  `npx playwright-core install chromium`). Never link `node_modules`. On
  Windows, nested paths need `git config --global core.longpaths true`, which
  the owner sets. Remove the worktree after the merge.
- **No per-PR review.** The independent review runs once per release, below.

## Releases

A release is an annotated tag `vX.Y.Z` on `main`, on the exact commit the
published binaries are built from. Binaries go to `diegoami/discola-releases`,
the tag stays here, and `tools/publish_release.mjs` refuses anything else.
Nothing but a release is a milestone.

1. **Open `Milestone vX.Y.Z`**: the candidate SHA on `main`, the previous tag,
   the PRs merged since, and the gate results on the candidate.
2. **Get an independent review before the tag.** A model that implemented none
   of the release reviews `<previous tag>..<candidate>` in a fresh session.
   The `review-handoff` skill fills in the issue, and the owner starts the
   review with `opencode run -m <provider/model> --command review-release <issue>`.
   The reviewer follows `.opencode/agents/release-reviewer.md`: it opens one
   issue per reproduced finding and posts one verdict comment. On BLOCK, fix
   the MUST-FIX findings in ordinary PRs, move the candidate, and review
   again. After three rounds without AGREE, the owner decides. The owner may
   also tag without a review, and the issue records it.
3. **After AGREE**, package from exactly the reviewed SHA, smoke the packaged
   build, tag that SHA and publish (`DESKTOP.md` §Releasing). Work merged after
   the candidate waits for the next release.

When a review is in, reproduce each finding before acting on it. Then fix it in
a PR (`Fixes #n`) or rebut it on the issue with evidence.

## Principles

- Keep reviewer requirements separate from **owner decisions**, and put owner
  decisions to the human with a recommended default.
- Reproduce every finding before acting, and your own claims before publishing
  them. When a check fails, suspect your harness first.
- For each passing check, say what it would have caught had the code been wrong
  — never let implementer and reviewer share a blind spot.
- A passing test is not a working feature: assert what a person would notice.
- A threshold from one measurement is a coin toss.
- Flag out-of-scope defects rather than fixing them silently.
- Change the smallest thing: targeted reads and focused edits, and show diffs,
  not whole files.

## Verification

- Gates: `npm run check` (UI check), `npm test` (unit tests), `npm run verify`
  (the full suite: check then tests). CI runs both on every PR and every push
  to `main`.
- Run the full suite **3 times** before pushing anything that touches the primary
  logic (`public/engine.js`, `public/index.html`), and read the pass COUNT, not
  the absence of a FAIL.
- **After any UI change, run `node tools/check_ui.mjs`.** It is not optional,
  and not only when something looks wrong. Every UI defect this project shipped
  was invisible in the diff and threw no error: cards overlapping the hand, the
  player's own hand pushed below the fold, the table drifting apart until it
  stopped reading as one surface, body copy at 12.5px, and every screen
  rendering at once behind a click-eating overlay. Reading the diff caught none
  of them. The check catches all of them. The `ui-check` skill explains what it
  covers and how to read a failure.
- **After any engine change, run `npm test`.** The tests are deterministic
  (seeded RNG) and cover what the UI check cannot see: card ranking and
  briscola, the 120-point total, the trick winner drawing first, both leader
  paths, and a full hand. They live in `tools/engine.test.mjs`.

## What to read

Normally inspect: `public/index.html`, `public/engine.js`, `tools/*`, the root
`*.md`, `.github/workflows/*`, `.claude/skills/*`, `.opencode/*`. Normally ignore
`node_modules/`, `public/decks/`, `public/fonts/`, `public/icons/`, `assets/`,
`dist-release/`, Gradle wrapper files and any binary. Read `package-lock.json`
only when dependencies are the task, and open files under `mobile/android/` one
at a time. Ignoring a path does not mean it should be deleted or gitignored.

Never read or paste `mobile/android/keystore.properties` or `*.jks`.

## The card size is a budget

`--cw` is `(viewport height - --chrome) / --rows / --ratio`, clamped. `--chrome`
is **derived** from the spacing tokens next to it — never hard-code it. It was
hand-estimated three times and wrong three times, silently, because a card too
tall for its row does not error, it just lands on the hand below. `--rows` is 3
in landscape and 4 in portrait, where the trick and the tallone stack.

## The engine is a transcription, not a rewrite

The rules come from `UMazzo.pas` and the opponent from
`TGiocatore.CompGioca` in `UGiocatore.pas`, with the twelve tuned weights per
profile from `Global.pas`. They live in `public/engine.js`: keep it that way —
if the opponent's play needs changing, change the weights, not the scoring
formula. `index.html` is the view and holds no game logic.

One 1997 behaviour is preserved deliberately and marked in the source — Piero's
weights are rolled once per session, because `SetProfiles` ran from
`FormCreate`. It is not a bug.

## Conventions

- Player-facing text is Italian, with an English translation (`STORES.md` 1.3).
  New text goes in both: Italian in the markup with a `data-i18n*` key, and
  English in the `EN` table, or the `IT` and `EN` tables for strings the script
  builds. The UI check fails on a key in only one language and on Italian left
  on an English screen. Card, suit and deck names stay Italian in both.
  Comments and commit messages are English.
- No build step and no runtime dependencies. `playwright-core` is for the check
  only and is gitignored.
- The card art is the original 1997 bitmaps. Do not redraw it. `tools/pack_cards.py`
  repacks it from the BMPs in `diegoami/briscola-JS`.
- Write every GitHub issue or comment body to a file as UTF-8 without a
  byte-order mark, and pass it with `--body-file`.
