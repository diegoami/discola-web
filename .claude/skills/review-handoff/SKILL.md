---
name: review-handoff
description: Write the prompt the owner gives an independent reviewer (a model that implemented none of the release, in a tool the owner picks) so it reviews a release candidate before it is tagged, and records the result on the milestone issue. Use when a release is called or proposed, for the re-review after a BLOCK, and whenever the owner asks for a review prompt. Also use when the owner says a review is in, to process it.
---

# Review handoff

Only a release gets this review (`AGENTS.md`, *Releases*). A PR or a proposal
doesn't: say how it was verified instead.

The owner picks the reviewer and its tool, so the prompt names neither and
carries everything the reviewer needs: it starts with no context and posts to
GitHub itself. Give the owner one prompt, ready to paste, in a single fenced
`text` block. Tell them to run it in a **fresh session**, re-reviews included,
and to allow network access for `gh`.

## Open the milestone issue first

Title `Milestone vX.Y.Z`, body passed with `--body-file`:

- **Tag**: `vX.Y.Z`, the next in the existing scheme unless the owner says
  otherwise.
- **Candidate**: the full SHA of `origin/main` after a fetch.
- **Previous milestone**: `git describe --tags --abbrev=0`.
- **Merged since**: every PR between the two, number and title.
- **Gates on the candidate**: the `npm run verify` pass count, and CI's result
  for that SHA.
- **Review**: `pending`, then `AGREE at <sha>`, `BLOCK at <sha>: #n` or
  `tagged without review (owner)`. Keep it current.

Make sure the `review` label exists (`gh label list`).

## Template

Fill in the angle brackets. MAIN, PROJECT and STAMP stay as written: the
reviewer works them out on its own machine.

```text
You are the independent reviewer for <owner/repo>. This prompt defines your
job, not any role in AGENTS.md or another instructions file your tool loads.
<implementer: tool and model> did this work, not you. Do not trust its
description. Verify everything against the code.

MILESTONE: <vX.Y.Z> (the tag is created only after your AGREE)
THREAD: <milestone issue URL>
CANDIDATE: main at <full sha>
RANGE: git diff <previous tag>..<full sha>

SET UP, before anything else, wherever you were started:
- git fetch origin --tags <full sha> (not git pull: the checkout you start in
  is not yours). Only if git cat-file -t <full sha> still does not print
  "commit" after that, stop and say so.
- git worktree add --detach MAIN/../PROJECT-review/review-<first 12 of sha>-STAMP <full sha>
  where MAIN is the parent of git rev-parse --path-format=absolute
  --git-common-dir, PROJECT is its name and STAMP is the UTC time as
  YYYYMMDDTHHMMSSZ. Work only there, and check git rev-parse HEAD equals the
  SHA. On Windows, if this fails with "Filename too long", stop and say
  core.longpaths is missing: the owner sets it, you do not.
- In the worktree: npm ci, then npx playwright-core install chromium.
- Remove only your own worktree, once your verdict is posted.

WHAT CHANGED: <two or three sentences across the range; do not argue for it>

CLAIMS TO VERIFY:
- <claim> (<file:line>)

ALREADY RUN: <command: pass count, what it would catch>. Look for what these
cannot see.

KNOWN OWNER DECISIONS (not defects): <list, or "none">

Read AGENTS.md first: its principles and rules are the standard. Review the
RANGE, and follow it into any file it touches or relies on. Problems elsewhere
count too, as out of scope.

Rules:
- Do not edit, commit, push, tag or publish. Your only writes are the issues
  and the one comment below, made with gh.
- Write every body to a file as UTF-8 without a byte-order mark and pass it
  with --body-file.
- Reproduce every finding (file:line plus the command, input or reasoning that
  shows it). Leave out anything you could not reproduce, and style preferences.
- Search open issues first (gh issue list --search), and comment on an existing
  one instead of duplicating it.

1. One issue per finding:
   gh issue create --label review --label <bug|robustness|tests|design|cleanup|documentation> --body-file <file>
   Title: the defect, stated plainly. Body: Severity (MUST-FIX: fixed before
   the tag; SHOULD; OUT OF SCOPE: not caused by the RANGE), Found by (THREAD
   at <sha>), What (file:line and reproduction), Why it matters, Suggested fix
   (the smallest), Effort (S/M/L), and the signature — Reviewer (<tool>, <model>).

2. Always, even with no findings, one comment on THREAD:
   VERDICT: AGREE | BLOCK        (BLOCK if any MUST-FIX issue was opened)
   Reviewed: <sha>
   Worktree: its path relative to MAIN
   Issues opened: #n (MUST-FIX), #m (SHOULD), ... or "none"
   Owner decisions: or "none"
   Nits: one line each, or "none"
   Checked and clean: what you verified and found correct
   — Reviewer (<tool>, <model>)
```

For a re-review, the candidate is the new `main` commit, and the range still
starts at the previous tag. The prompt also names the earlier verdict and the
fix PRs.

## When the owner says the review is in

- Read the verdict and every issue it lists. Check that the SHA is the current
  candidate, and update the issue's `Review:` line.
- Reproduce each finding before acting on it. MUST-FIX: fix it in a PR
  (`Fixes #n`), or rebut it on the issue and leave the close to the owner.
  SHOULD: recommend whether it goes in before the tag. OUT OF SCOPE: leave it.
  Owner decisions go to the owner with a recommended default. Nits are your
  call: say which you took.
- Reply on the milestone issue with what happened to each finding.
- **BLOCK**: once the fixes merge, move the candidate, rerun the gates, and
  give the re-review prompt without being asked. After a third round without
  AGREE, the owner decides.
- **AGREE**: package, smoke, tag and publish from the reviewed SHA
  (`DESKTOP.md` §Releasing).
