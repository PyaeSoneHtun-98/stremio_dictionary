# Windows runtime pins

The setup downloads upstream archives; it does not embed or redistribute media runtimes.
`packaging/runtime-manifest.json` is the source of truth for URLs and SHA-256 hashes.
The installer verifies downloaded and cached bytes before extraction and copies the executable's
entire directory, including shared DLLs. Runtime provisioning runs in the install transaction's
staging directory; the existing swap/rollback and cache ownership rules are unchanged.

## FFmpeg — Issue #73

- Provider: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds).
- Release: [autobuild-2026-09-30-13-08](https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2026-09-30-13-08), the last successful September 2026 build.
- Artifact: `ffmpeg-n8.1.3-9-g29e619e767-win64-lgpl-shared-8.1.zip`.
- SHA-256: `3e47bda1607740550141e37c0e49d1e5182b34699f15adfd137ee266d346811a`.
- Hash provenance: upstream `checksums.sha256` and GitHub release asset digest, independently
  compared with the downloaded archive.
- Variant: Windows x64, LGPL shared, release branch 8.1. Keep the matching libav DLLs with
  `ffmpeg.exe`. Licensing/source references remain in `packaging/THIRD_PARTY_NOTICES.txt`.

The old September 20 daily build returned HTTP 404 in CI #582–#586. BtbN's
[retention policy](https://github.com/BtbN/FFmpeg-Builds#release-retention-policy) retains the
last 14 daily builds, but the last build of each month for **two years**. This pin is retained
under that month-end policy; it is not a permanent availability guarantee.

**Review and renew this pin by June 2028, before the September 2028 retention expiry.**
Future pins must use a completed month's last successful release, verify upstream policy and
checksums again, and pass cold/cached provisioning plus DLL execution and subtitle extraction.
Do not use the floating `latest` URL: its bytes change while our hash is fixed.

Existing setup executables contain their original manifest and cannot be repaired by changing
master. An old setup with the deleted URL can still reuse its matching verified archive if
cached; an uncached old setup needs a newly built setup. A new setup uses its new hash/cache
entry while retaining support for existing cache ownership and upgrade recovery. Do not
delete an old user's cache or weaken hash verification to work around a missing upstream asset.

## mpv

The pin remains first-party stable mpv v0.41.0 x86_64 MSVC. Issue #73 does not change its
download, hash, runtime selection, or playback behavior.

## Verification

CI verifies the public archives using Windows PowerShell and an empty cache, executes the
managed runtimes, exercises synthetic embedded text subtitle extraction, and provisions
again with deliberately unavailable URLs to prove verified cache reuse. Live verification
also rejects corrupt cached/downloaded bytes without replacing the previously staged
FFmpeg executable. Packaged installer
tests separately cover custom paths, upgrades, rollback/recovery, and cache ownership.
These automated checks do not claim owner acceptance with real media.
