# Subtitle Bridge logo assets

Issue [#83](https://github.com/PyaeSoneHtun-98/stremio_dictionary/issues/83) recreates the
owner's selected bridge/subtitle-bubble concept as native SVG paths. The palette is
off-white `#f5f5f5` on charcoal `#181818`, matching the neutral app theme.

## Files

| File | Purpose |
| --- | --- |
| `subtitle-bridge-mark.svg` | Editable transparent symbol; 256 × 224 viewBox, named arch, supports, bubble and caption paths. |
| `subtitle-bridge-icon.svg` | Icon on a rounded charcoal tile; 256 × 256, transparent outer corners. |
| `subtitle-bridge-logo.svg` | Full logo and outlined wordmark on a 1024 × 1024 charcoal background. |
| `subtitle-bridge-icon.png`, `subtitle-bridge-logo.png` | 1024 × 1024 raster previews/exports. |
| `subtitle-bridge-icon.ico` | Windows icon with 16, 24, 32, 48, 64, 128 and 256px RGBA frames. |
| `exports/icon-*.png` | Individually rasterized small icon sizes used to assemble the ICO. |
| `source/wordmark-outlined.svg` | Font-independent wordmark path source for the finished logo. |
| `source/wordmark-editable.svg` | Editable text source; requires Inter installed and can fall back to another font. |

The finished mark, icon and logo SVGs contain no raster images, embedded fonts, scripts,
filters or external resources. They can be edited in a vector editor and render without
Inter installed. The editable text source is intentionally the exception: use the outlined
version for distribution. The SVG title/description or accessible label identifies the logo.

The owner approved this recreated vector appearance on 2026-10-08. Issue
[#85](https://github.com/PyaeSoneHtun-98/stremio_dictionary/issues/85) applies the approved
icon to the launcher header, native launcher/player windows and Windows app/setup executables.
Start Menu and Installed Apps use the app executable's icon at index 0. That integration has
its own packaging/installed-icon acceptance; original artwork approval alone is not a native
Windows acceptance result.

## Wordmark provenance

The wordmark uses **Inter Bold**, variable axes `wght=700`, `opsz=32`, 100px size,
with default glyph advances (no kerning). The symbol is hand-authored; it does not trace or
embed the earlier generated PNG. Inter is licensed under SIL Open Font License 1.1;
the required copyright/license text is included in [licenses/Inter-OFL.txt](licenses/Inter-OFL.txt).
Outlines are artwork; the font binary is not bundled with these assets.

- [Official Inter font source](https://github.com/rsms/inter/tree/master/docs/font-files)
- Font file: `InterVariable.ttf`
- Font SHA-256: `4989b125924991b90d05b2d16e0e388c48f7d5bb8b30539bbf9c755278d0ccaf`
- [Official license](https://github.com/rsms/inter/blob/master/LICENSE.txt)
- License SHA-256: `262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a`

If the upstream file changes, obtain the documented revision or review the new font/license
before changing the hash. The outline tool rejects an unexpected font.

## Regenerating exports

The source of truth is `subtitle-bridge-mark.svg` and `source/wordmark-outlined.svg`.
Optional design tools use **Sharp 0.35.4**, **Pillow** and (only for re-outlining the
wordmark) **fontTools 4.66.1**. They are not application dependencies and are not required
to build or run Subtitle Bridge. Install them in a separate tooling environment, without
changing the app's package manifests.

From the repository root, with those dependencies available:

```powershell
# Point to Sharp in your separate Node tooling installation if it is not on Node's module path.
$env:SHARP_MODULE = 'C:\path\to\design-tools\node_modules\sharp'
node assets/branding/tools/export.cjs
python assets/branding/tools/pack-ico.py
```

To recreate the original outlined and editable wordmark sources from the hash-matched font:

```powershell
python assets/branding/tools/outline-wordmark.py C:\path\to\InterVariable.ttf
```

Then run both export commands again. `export.cjs` composes the SVGs and rasterizes every
PNG size directly from the icon SVG. `pack-ico.py` packs those frames without resampling
and verifies each decoded ICO frame exactly matches its corresponding PNG.

## Validation recorded

- SVGs parsed successfully; finished assets have no embedded raster/external-resource/font dependency.
- PNG/ICO dimensions and transparent icon corners checked; all seven ICO frames match the PNGs.
- Full logo and icon rendered and visually inspected, including native 16/24/32/48/64/128/256px icons.
- The owner approved the recreated vector appearance on 2026-10-08; no installed-shell or
  playback test is claimed by the original artwork approval.

## Windows integration verification

`npm run package:win` embeds the ICO in the copied Electron executable and compiles setup
with `/win32icon`. App-local ICO/PNG copies are included for native window icons in both
development and packaged runs. The original npm Electron executable remains unchanged.
`resedit` 3.1.0 and its PE parser are pinned build tooling only; they are not copied into the app.

```powershell
node scripts/verify-windows-branding.mjs
```

This checks all seven icon resource frames in both final EXEs against the approved PNG-based
ICO, plus the packaged window image/license copies. CI repeats the resource check after
installation and checks real shortcut/Installed Apps icon references. Release packaging also
runs the resource gate before publication. Owner checks of actual Explorer/taskbar/shortcut/
setup appearance remain recorded separately in the integration PR.
