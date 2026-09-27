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
implementing. Implement on a new branch in a worktree of your own (*Who works
where*, below), open a PR that references the issue, and review it against the
agreed design. The owner merges. This file does not spawn a separate reviewer
model; that mechanism is OpenCode-specific and lives in `AGENTS.md`.

### Who works where

One layout, for every session and every tool. `<main>` is the main checkout,
the parent directory of `git rev-parse --path-format=absolute --git-common-dir`;
`<project>` is its name, and `<default>` is the branch
`git symbolic-ref --short refs/remotes/origin/HEAD` names.

**Prerequisite on Windows:** `git config --global core.longpaths true`, since
nested worktree paths can pass the path limit on the Android sources. The
owner sets it on the machine; a session does not.

A worktree starts without dependencies. Before any check runs in one, install
them there, as CI does: `npm ci`, then `npx playwright-core install chromium`
(a no-op when the machine already has that revision). Never copy or link
`node_modules` from the main checkout.

- **`<project>/`, the main checkout, is the planner's or orchestrator's only.**
  No implementer or reviewer works there, and none checks out a branch or
  commit there (no `git checkout`, `git switch` or `gh pr checkout`).
- **Every session opened in `<project>/` starts by updating it**, whatever it
  is asked to do: `git fetch origin`, then `git pull --ff-only`, but only if it
  is on `<default>` (`git branch --show-current`) and has no uncommitted changes
  (`git status --porcelain` prints nothing). Otherwise it leaves `<project>/` as
  it is and tells the owner why. It never resets, stashes or merges there.
  There may be no standing orchestrator, since a session asked to implement
  moves into a worktree, so the next session to start brings `<project>/` up to
  date. Nothing relies on it meanwhile: implementers start from
  `origin/<default>`, reviewers from an exact SHA.
- **Every session that implements works in a worktree of its own**, one per
  change, never in `<project>/`. A Claude Code forked subagent uses the tool's
  own worktree isolation (`.claude/worktrees/`). Every other session first
  runs `git fetch origin`, then makes its worktree beside the main checkout,
  and works only there:

  ```sh
  git worktree add --no-track -b <branch> <main>/../<project>-work/<branch> origin/<default>
  ```

  That includes a new session the owner opens in `<project>/` and asks to
  implement a feature, as well as OpenCode, Codex, a headless session, or a
  worktree the main session makes. If the branch or the path exists, add a UTC
  stamp to both. `--no-track` keeps the branch from tracking
  `origin/<default>`, so its first push, `git push -u origin <branch>`, goes to
  its own branch. Install the dependencies in it (above) before running a gate.
  Name the worktree in every command, since a tool's shell may
  return to `<project>/` after each one. A session about to edit, commit or
  switch branches in `<project>/` stops and makes the worktree first. After the
  merge, it removes the worktree it made (`git worktree remove`) and deletes
  its merged branch.
- **Reviewers work in worktrees of their own**, one per review round, detached
  at the exact commit under review, under
  `<project>-review/review-<SHA first 12>-<UTC stamp YYYYMMDDTHHMMSSZ>` beside
  the main checkout. The steps (fetch, check the commit, make the worktree,
  check `HEAD`, install the dependencies) are in the `review-handoff` skill's
  CANDIDATE block.
- **In a cloud session**, the session's own clone takes the place of these
  folders; the fetch and commit checks still apply.
- **A session removes only worktrees it made**: the implementer its own after
  the merge, if it is still running then; a reviewer its own once its verdict
  is recorded. Leftovers are the owner's to clean up, with a tool that proves
  each removal safe. Sessions don't guess which worktrees are unused.

### Milestones and the independent review (every implementer)

This is the release process for whichever tool implements, Claude Code or
OpenCode: "the implementer" below is that session. In OpenCode it comes on top
of the per-PR review in `AGENTS.md`, not instead of it. Any tool given a
review-handoff prompt: the prompt is your job, and this section is only context.

**A milestone is a release**: an annotated tag `vX.Y.Z` on `main`, on the exact
commit the published release is built from. Nothing else is a milestone: not a
proposal, a PR, a run of PRs, or a change to a given file or to the process.
Binaries go to `diegoami/discola-releases`, but the tag goes on this
repository's `main`, and the release notes name the tagged commit. Each PR is
still verified by the implementer against its agreed design, and the owner still
merges it, as above.

The independent review happens **per milestone, before the tag**, never per
PR. The reviewer is a model that implemented none of the release, in whatever
tool the owner picks, in a fresh session every time.

1. **Call it.** The owner calls a milestone, or the implementer proposes one
   when a release is due or a coherent set of work has landed.
2. **Open the milestone issue.** It lists the proposed tag, the candidate commit
   on `main` (full SHA), the previous milestone tag, the PRs merged since then,
   and the gate results on the candidate.
3. **Hand off.** The implementer gives the owner one prompt from the
   `review-handoff` skill (`.claude/skills/review-handoff/SKILL.md`; a tool
   without Claude Code's skills reads it as a document). The reviewer fetches
   first, then reviews `git diff <previous tag>..<candidate SHA>` in a fresh,
   detached worktree of its own at the candidate SHA (`<project>-review/`, *Who
   works where*), never in the checkout it started in. It opens one issue per
   reproduced finding and posts one verdict comment on the milestone issue,
   naming the SHA and the worktree.
4. **The tag waits.** On BLOCK, the findings are fixed in ordinary PRs. The
   candidate moves to the new `main` commit, and the implementer gives a
   re-review prompt without being asked. If a third round still doesn't end in
   AGREE, the milestone goes to the owner.
5. **AGREE.** The implementer packages the release from the reviewed SHA and
   runs the manual smoke of the packaged build (`DESKTOP.md`). Until packaging
   moves into a worktree (a planned follow-up), this is the one step that runs
   in the main checkout, as `DESKTOP.md` §Releasing says, because the signing
   key lives there. Then it tags exactly that SHA, never a later commit, and the
   owner publishes. Work merged after the candidate belongs to the next
   milestone.
6. **Tag without a review.** The owner may do this, and the milestone issue
   records it.

The reviewer posts to GitHub itself, and nothing is pasted back:

- **one issue per reproduced finding**, labelled `review` plus the matching
  category label (`bug`, `robustness`, `tests`, `design`, `cleanup`,
  `documentation`), linking back to the milestone issue and the SHA;
- **always one verdict comment** on the milestone issue: AGREE, or BLOCK when
  any finding is MUST-FIX. It names the SHA reviewed, the issues it opened,
  and what it checked and found clean, so a review that finds nothing still
  leaves a record.

Every issue and comment body is written to a file as UTF-8 without a
byte-order mark and passed with `--body-file`.

Severities: **MUST-FIX** (fixed before the tag), **SHOULD**, and **OUT OF
SCOPE** (not caused by the work under review). The owner decides what waits
for the next milestone.

When the owner says the review is in, read it from GitHub, and reproduce each
finding before acting on it. Then fix it in a PR (`Fixes #n`), or rebut it
with evidence on the issue. Owner decisions go to the owner with a
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
