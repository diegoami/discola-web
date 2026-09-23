> Guidance for Claude Code. The OpenCode review process lives in AGENTS.md.

# Discola

A two-player Briscola game, ported to the web from the Delphi 3 original of
1997. `public/index.html` (the view) plus `public/engine.js` (the rules and the
opponent, loaded as a classic script so `file://` still works): five screens, two
dialogs, six card decks drawn from sprite sheets of the original bitmaps (five
PNG, one JPEG).

## Process (tool-agnostic)

Design first: write the proposal — problem, findings with `file:line`
references, the design and open questions — and get it agreed before
implementing. Implement on a branch, open a PR that references the issue, and
review it against the agreed design. The owner merges. This file does not spawn a
separate reviewer model; that mechanism is OpenCode-specific and lives in
`AGENTS.md`.

### Independent review (Claude Code only)

OpenCode: skip this section, your review process is in `AGENTS.md`.

Claude does the work itself, the design and the implementation, and does not
spawn its own reviewer. At each milestone it stops and gives the owner a prompt
to paste into an independent model, which reviews the repository and reports
issues. The milestones are:

1. a design proposal is written, before implementing it;
2. a PR is open with the gates green, before the owner merges;
3. a release is staged, before it is published.

Write the prompt with the `review-handoff` skill; it holds the template. When
the owner pastes the review back, reproduce each finding before acting on it.
Fix it, or rebut it with evidence, and record what happened to each finding on
the PR or the issue. Findings that are owner decisions go to the owner with a
recommended default, not into the code.

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
- Show diffs, not whole files.

## Verification

- Gates: `npm run check` (UI check), `npm test` (unit tests), `npm run verify`
  (the full suite: check then tests).
- Run the full suite **3 times** before pushing anything that touches the primary
  logic (`public/engine.js`, `public/index.html`), and read the pass COUNT, not
  the absence of a FAIL.

## Read this much, and no more

Normally inspect: `public/index.html`, `public/engine.js`, `tools/*`, the root
`*.md`, `.github/workflows/*`, `.claude/skills/*`.

Normally ignore: `node_modules/`, `.git/`, `public/decks/`, `public/fonts/`,
`public/icons/`, `assets/`, `dist-release/`, Gradle wrapper files, and any
binary. Read `package-lock.json` only when dependencies are the task, and open
files under `mobile/android/` individually instead of walking the tree.

Never read or paste `mobile/android/keystore.properties` or `*.jks`.

Ignoring a path here does not mean it should be deleted or gitignored.

## Change the smallest thing

Prefer targeted reads and diffs to repeating whole files: search first, then read
the range you need, and show changes as a diff (`git diff -- <path>`,
`git show HEAD:<path>`) rather than reprinting a file. Make edits with focused
replacements instead of rewriting a file to change a few lines.

## Keep command output short

Prefer the repository's own commands over ad-hoc exploration, and cap their
output. On PowerShell:

```powershell
npm run check 2>&1 | Select-Object -Last 40
npm test 2>&1 | Select-Object -Last 20
git diff --stat
gh pr view <n> --json title,state --jq .
```

On bash, `| tail -40` instead of `Select-Object -Last 40`. Use `node --check
<file>` for a syntax check instead of running a script, and scope file searches
to source directories rather than searching from the repository root.

## Sessions and handoff

Start a fresh session after a completed logical unit -- a merged PR, a finished
fix, a documentation pass -- or when a thread has grown long. Carry forward a
short handoff:

- **Completed:** what is now true (and any verification that ran).
- **Files / decisions:** the paths touched and the decisions made, with reasons.
- **Next:** the next task, or "nothing open".

Durable facts belong in the repository (this file, the docs, the PR body), not
in the conversation.

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

## After any engine change, run the unit tests

```sh
npm test
```

They are deterministic (seeded RNG) and cover what the UI check cannot see:
card ranking and briscola, the 120-point total, the trick winner drawing first,
both leader paths, and a full hand. They live in `tools/engine.test.mjs`. Both
this and the UI check run in CI on every pull request and push to `main`.

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

- Player-facing text is Italian. Comments and commit messages are English.
- No build step and no runtime dependencies. `playwright-core` is for the check
  only and is gitignored.
- The card art is the original 1997 bitmaps. Do not redraw it. `tools/pack_cards.py`
  repacks it from the BMPs in `diegoami/briscola-JS`.
