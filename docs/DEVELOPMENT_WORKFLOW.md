# Development workflow

Subtitle Bridge uses a deliberate issue → implementation → manual validation → Codex review → merge flow. The goal is to keep each change understandable, testable, and easy to continue in a new chat or by a different coding agent.

## 1. Define the work before coding

Create or update a GitHub issue first.

The issue should state:

- the user-visible goal
- scope
- explicit out-of-scope items
- acceptance criteria
- any verified platform constraints discovered during research or manual testing

Do not start implementation from a vague chat request when the behavior can be captured in an issue first.

## 2. Create an issue-specific branch

Use a descriptive branch tied to the issue, for example:

```text
feat/issue-24-stremio-handoff
fix/issue-21-ass-garbage
```

Do not implement directly on `master`.

## 3. Implement only the issue scope

Read `AGENTS.md`, `docs/PROJECT.md`, `docs/STATUS.md`, and the active issue before editing code.

Preserve existing behavior outside the issue unless a change is necessary and documented. If manual testing reveals the original design assumption was wrong, update the issue/PR to reflect the new verified behavior rather than silently changing direction.

## 4. Validate locally/automatically

Run:

```bash
npm run check
```

This is expected to cover linting, type checking, tests, and application build validation.

For packaging changes, also run the relevant packaging flow on Windows:

```cmd
npm run package:win
```

Automated validation should include regression coverage when practical, but automated tests do not replace real playback testing.

## 5. Open or maintain a Draft PR

Use a Draft PR while implementation or manual validation is still incomplete.

The PR body should contain:

- concise implementation summary
- important architecture decisions
- automated validation status
- manual validation status
- known limitations
- honest pending items

Never describe a test as passed unless it was actually performed against the current behavior being claimed.

## 6. Manual Windows testing

For user-visible media behavior, test the real application on Windows using representative content.

Examples include:

- local MKV playback
- SRT/ASS/SSA subtitle behavior
- unsupported image subtitles
- translation lookup
- settings persistence
- installer upgrade behavior
- Stremio stream playback
- Stremio one-click handoff

When a failure is found, treat it as design information. Record what failed, fix it, then repeat the affected test.

## 7. Record results in the repository

Update the PR body and, where useful, the relevant documentation with the actual result.

`docs/STATUS.md` should answer these questions without requiring chat history:

- What is stable on `master`?
- What issue/PR is active?
- What has been verified?
- What is still pending?
- What comes next?

## 8. Send the PR to Codex for review

Codex is normally the final reviewer/debugger, not the primary implementer.

The review prompt should tell Codex:

- the PR and issue being reviewed
- important architecture/security invariants
- manual tests already performed
- areas of special risk
- to identify any P1/P2 blockers
- to say clearly when the PR is ready to merge

Do not merge while Codex reports unresolved P1/P2 findings.

## 9. Fix review findings

For each valid blocker:

1. fix the code/documentation
2. run automated validation
3. re-run affected manual tests when necessary
4. respond to the review thread with the fix
5. leave the finding for Codex to verify rather than resolving it prematurely when independent verification is expected

Then ask Codex to re-review the current head.

## 10. Final merge gate

Before merging, verify all of the following:

- the PR head is the same head Codex reviewed or only contains clearly understood post-review documentation changes that have also been validated as appropriate
- required CI is green
- manual acceptance results are recorded truthfully
- no unresolved P1/P2 blockers remain
- the PR is no longer Draft

Then squash merge unless another strategy was explicitly chosen.

## 11. Confirm issue completion

After merge:

- verify the PR is merged
- verify the linked issue is closed/completed
- update `docs/STATUS.md` on the next work branch so it reflects the new stable `master`

## 12. Start the next issue separately

Do not piggyback the next feature onto the just-finished PR.

For example, the player UI/UX redesign is intentionally separate from the Stremio handoff work. It should receive its own issue, branch, implementation, manual test, review, and merge cycle.

## Standard flow at a glance

```text
requirement
→ GitHub issue
→ issue branch
→ implementation
→ npm run check
→ Draft PR / CI
→ manual Windows validation
→ record actual results
→ Codex review
→ fix P1/P2 blockers
→ re-test / re-review
→ verify final head + CI
→ mark ready
→ squash merge
→ confirm issue closed
→ next issue
```

## When Codex is used as the implementer

Occasionally an issue may explicitly assign the implementation itself to Codex as an experiment. In that case:

- the issue must still define the goal, constraints, and acceptance criteria
- the prompt should describe the problems to solve without unnecessarily prescribing the visual/design solution
- Codex should be given room to choose implementation details that stay within project architecture and security rules
- the result must still pass the same CI, manual testing, and final review gates before merge

The UI/UX redesign planned after Issue #24 is expected to use this one-time implementation-by-Codex workflow.
