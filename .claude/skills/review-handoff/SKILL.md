---
name: review-handoff
description: Write the prompt the owner pastes into an independent model so it reviews Discola at a milestone. Use when a design proposal is written, when a PR is open with the gates green, or when a release is staged (the three milestones in CLAUDE.md), and whenever the owner asks for a review prompt.
---

# Review handoff

Claude implements; an independent model reviews. At each milestone, stop and
give the owner one prompt, ready to paste, in a single fenced `text` block, and
nothing else in that block. The reviewer starts with no context, so the prompt
has to carry everything it needs.

## Fill in before writing

- **Milestone**: design, PR or release.
- **Target**: the issue or PR URL, and the branch and head commit SHA
  (`git rev-parse HEAD`) the review must read. A reviewer on a stale head wastes
  a round.
- **What changed and why**: two or three sentences. Do not argue for the change.
- **Claims to verify**: the specific things the work says are true, with
  `file:line`. These are what the reviewer checks hardest.
- **Checks already run**: each command and its pass *count*, and what each one
  would have caught. The reviewer should aim at what those checks cannot see.
- **Known owner decisions**: questions already put to the owner, so the
  reviewer does not report them as defects.

## Template

```text
You are an independent reviewer for Discola (github.com/diegoami/discola-web,
private; a two-player Briscola game: public/index.html is the view,
public/engine.js the rules). Another model did this work. Do not trust its
description. Verify everything against the code.

MILESTONE: <design proposal | pull request | staged release>
TARGET: <issue/PR URL>, branch <branch> at <sha>. Check you are reading <sha>
before you start, and say so if you are not.

WHAT CHANGED: <two or three sentences>

CLAIMS TO VERIFY:
- <claim> (<file:line>)
- ...

ALREADY RUN: <command: result, what it would catch>. Look for what these cannot
see.

KNOWN OWNER DECISIONS (not defects): <list, or "none">

Read CLAUDE.md first: its principles and project rules are the standard. Then
review <the proposal | the diff against main | the release staging>, and follow
it into any file it touches or relies on. Report issues you find elsewhere in
the repository too, marked OUT OF SCOPE.

Rules:
- Read only. Do not edit files, commit, push, or post on GitHub.
- Reproduce every finding: cite file:line, and give the command, the input or
  the reasoning that shows it. Leave out anything you could not reproduce.
- Do not report style preferences as defects.

Report in this format:

VERDICT: AGREE | BLOCK
FINDINGS, most severe first, each one:
  [BLOCK | SHOULD | NIT | OWNER DECISION | OUT OF SCOPE] <title>
  where: <file:line>
  evidence: <how you reproduced it>
  fix: <the smallest change that resolves it>
CHECKED AND CLEAN: <what you verified and found correct, so the next round does
not repeat it>
```

## After the owner pastes the review back

- Reproduce each finding yourself before acting on it. A reviewer can be wrong,
  and so can you.
- BLOCK and SHOULD: fix it, or rebut it with evidence. OWNER DECISION: put it to
  the owner with a recommended default. OUT OF SCOPE: flag it, do not fix it
  silently. NIT: your call, and say which you took.
- Record what happened to each finding in a comment on the PR or the issue.
- If anything changed, rerun the gates and offer a new prompt against the new
  head. A review of an old SHA does not cover the new one.
