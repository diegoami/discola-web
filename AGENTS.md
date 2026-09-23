> Guidance for OpenCode. Claude Code uses CLAUDE.md.

# Discola — OpenCode guidance

The tool-agnostic principles, the verification gates and the project rules live
in [`CLAUDE.md`](CLAUDE.md). **Read it before implementing.** This file adds the
OpenCode-specific review process.

## Review process: DeepSeek implements, Luna reviews

### Roles and identities

- **Implementer — DeepSeek** (`opencode/deepseek-v4.1-flash`). Writes the design,
  the code and the tests; replies on GitHub signed
  "— Implementer (DeepSeek V4.1 Flash)".
- **Reviewer — Luna** (`opencode/gpt-5.6-luna`, `#high` variant), invoked as a
  subagent in a fresh context and given an explicit model id. It verifies against
  the real code rather than trusting the description, and posts its verdict on
  GitHub signed "— Luna (GPT-5.6, high)".
- Luna posts through the owner's GitHub account (no separate bot identity), so
  the signature line is the only marker of authorship.
- A **BLOCK** is not overridden by the implementer — it goes to the owner.

### Two stages

- **Design.** Before any implementation, write the proposal as a GitHub issue:
  problem, findings with `file:line` references, the design, and open questions.
  Have Luna review that issue and comment. Iterate — reply, Luna re-reviews —
  until Luna posts an explicit **AGREE**. Do not implement before that.
- **Implementation.** Implement the agreed design on a branch and open a PR that
  references the issue. Have Luna review the PR against the agreed design; fix
  and iterate until Luna posts an explicit **AGREE**. The owner merges.

### Bootstrap

The change that introduces or edits this file or `CLAUDE.md` goes straight to a
PR that Luna reviews to AGREE, exactly as for a code change. The process reviews
its own amendment.

## Split by tool

- `AGENTS.md` (this file) holds the OpenCode review process.
- `CLAUDE.md` holds the tool-agnostic principles, the verification gates and the
  project rules, with no reviewer-spawning mechanism. Its "Independent review
  (Claude Code only)" section is Claude's milestone handoff to the owner; it
  does not apply here.

Keep one source of truth per idea: process here, principles and rules there.
