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

### Independent review (when Claude implements)

OpenCode implementing: skip this section, your review process is in
`AGENTS.md`. Any tool given a review-handoff prompt: the prompt is your job,
and this section is only context.

Claude does the work itself, the design and the implementation, and does not
spawn its own reviewer. At each milestone it gives the owner a prompt for the
**independent reviewer**: a different model, in whatever tool the owner picks
(Codex, DeepSeek, or another), in a fresh session every time.
The review is **offered, never waited on**: the owner may not be able to run
it, so the owner's agreement starts a branch and the owner's decision merges
or publishes, reviewed or not. When a review does run, it is recorded on the
thread the milestone already has:

| Milestone | Thread | Offer the prompt |
|---|---|---|
| Design written | the proposal issue | with the proposal |
| PR implementing a design, gates green | the PR | when the PR is ready to merge |
| Release staged | the `release/X.Y.Z` PR, with the staged checksums in its body | before publishing; after merge, tag `vX.Y.Z` on the merge commit, then publish |

A review costs the owner a round, so it is for **milestones only**, not every
change. Nothing else gets a prompt by default: a tooling or workflow fix that
implements no proposal, a process wording change, a re-review after fixes, a
docs correction. For those, Claude verifies the work itself and says how in
the PR. When a review might still be worth it, Claude says so in one line, and
writes the prompt only if the owner asks.

Every milestone PR body carries a `Review:` line that Claude keeps current:
`not run`, `AGREE at <sha>`, or `BLOCK at <sha>: #n, #m`. A review can still
be run after the merge, against the merged commit; its findings are ordinary
issues for a later PR.

The reviewer posts to GitHub itself, and nothing is pasted back:

- **one issue per reproduced finding**, labelled `review` plus the matching
  category label (`bug`, `robustness`, `tests`, `design`, `cleanup`,
  `documentation`), linking back to the thread and the SHA;
- **always one verdict comment** on the thread — AGREE, or BLOCK when any
  finding is MUST-FIX; the SHA reviewed, the issues it opened, what it checked
  and found clean — so a review that finds nothing still leaves a record.

Severities: **MUST-FIX** (fix before merging if the review arrives in time,
otherwise first), **SHOULD**, and **OUT OF SCOPE** (not caused by the change).
None of them locks anything; the owner decides.

The `review-handoff` skill holds the prompt template. When the owner says the
review is in, read it from GitHub, reproduce each finding before acting on it,
and fix it (`Fixes #n` in the PR) or rebut it with evidence on the issue.
Recommend which fixes belong before the merge; the owner decides. Owner
decisions go to the owner with a recommended default, not into the code. A
re-review is not a milestone. Claude mentions it in one line only when a
MUST-FIX was fixed by a code change, and it runs only if the owner wants it.

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
