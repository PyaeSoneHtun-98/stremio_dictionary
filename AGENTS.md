# Subtitle Bridge agent instructions

This repository is the source of truth for Subtitle Bridge development. Before changing code, read:

1. `docs/PROJECT.md` — product goal, architecture, invariants, and current limitations.
2. `docs/DEVELOPMENT_WORKFLOW.md` — required issue/branch/PR/test/review flow.
3. `docs/STATUS.md` — current stable state, active work, and next planned work.
4. The active GitHub issue and pull request for the task being worked on.

Do not rely on chat history when the repository documentation already answers a project question. If documentation and implementation disagree, verify the code and current issue/PR, then update the documentation as part of the same work.

## Development rules

- Work from a GitHub issue with explicit scope and acceptance criteria.
- Use an issue-specific feature branch. Do not develop directly on `master`.
- Keep each PR focused on one issue. Do not silently add unrelated cleanup or redesign work.
- Open substantial work as a Draft PR early enough for CI and manual testing.
- Run the repository validation suite before requesting review.
- Record manual test results truthfully. Never mark an environment, codec, or behavior as tested when it was not actually tested.
- Treat CI as necessary but not sufficient for Windows playback behavior; real media/manual testing is required where the issue calls for it.
- Use Codex primarily as the final code reviewer/debugger unless the issue explicitly assigns implementation to Codex.
- Do not merge while Codex reports unresolved P1/P2 blockers.
- After fixes, re-run CI and repeat the affected manual tests before re-review when appropriate.
- Before merge, verify the reviewed PR head SHA is still current and required CI is green.
- Prefer squash merge unless an issue explicitly requires another merge strategy.
- Confirm that the linked issue is closed/completed after merge.

## Architecture invariants

Preserve these unless the active issue explicitly changes them:

- Target platform is Windows x64.
- Electron owns the desktop shell; React + TypeScript owns the renderer UI.
- mpv owns video/audio playback through the Electron main process.
- Local MKV embedded text subtitles use FFmpeg full-track extraction and normalization.
- HTTP/HTTPS network streams, including Stremio local streams, use mpv live subtitle decoding so playback does not wait for a complete network subtitle scan.
- mpv native subtitle rendering stays hidden when Subtitle Bridge renders the interactive subtitle overlay.
- Subtitle Bridge owns subtitle-track selection for the interactive overlay.
- SRT/SubRip, ASS, and SSA text subtitles are supported as interactive text. Image subtitles such as PGS/VobSub are not clickable text.
- Rich ASS/SSA visual fidelity is not currently recreated by the React overlay; readable dialogue is prioritized.
- The default translation provider is the offline English → Burmese local dictionary. Google remains optional and must not be required for normal operation.
- mpv and FFmpeg are external runtime dependencies in release packages; do not opportunistically redistribute unknown third-party builds.
- Stremio integration currently targets Stremio's local Windows playback-device mechanism through a reversible compatibility patch; it is not an upstream/native Stremio integration.

## Security and privacy rules

- Never log API keys, authorization headers, secrets, provider request bodies, subtitle text, clicked lookup words, or full local media paths/stream URLs.
- Do not persist raw FFmpeg stderr or other third-party output that may contain paths, subtitle content, or secrets.
- Do not enable mpv `--log-file` output for Subtitle Bridge. Raw mpv logs can contain complete Stremio stream URLs, including private hashes or query credentials; use only the app's structured/redacted diagnostics.
- Validate launch targets before forwarding them to mpv or FFmpeg. Only intended local-file and HTTP/HTTPS targets should be accepted.
- Keep renderer Node integration disabled and context isolation enabled. Expose system capabilities through narrow preload/IPC APIs.
- Any Stremio compatibility patch must be opt-in, reversible, idempotent, crash-safe, preserve existing recovery backups, and fail closed when the expected Stremio layout or patch-marker state is not recognized.

## Testing expectations

For changes that affect playback, subtitles, packaging, Stremio integration, settings, or translation, test the specific user-visible behavior in addition to automated validation.

Typical validation sequence:

```text
issue defined
→ feature branch
→ implementation
→ npm run check
→ Draft PR / CI
→ manual Windows test
→ record results
→ Codex review
→ fix P1/P2 blockers
→ re-test / re-review
→ verify final head + CI
→ squash merge
→ confirm issue closed
```

When a bug is discovered during manual testing, update the issue/PR description so the repository reflects what was actually learned before continuing.
