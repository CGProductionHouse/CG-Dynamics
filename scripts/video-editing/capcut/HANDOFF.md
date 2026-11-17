# Synthetic CapCut staff handover probe

This is a **test package**, not a client project. The ignored local archive is `scratch/CG_CAPCUT_SYNTHETIC_HANDOFF_STAFF.zip`. It contains one CapCut 9.1-authored, 9.6-saved 12-second project, all five synthetic media files in `assets/`, and `media-manifest.json` with SHA-256 hashes. The title remains a native CapCut text segment. The archive is intentionally not committed or uploaded.

## Conditions before opening on another Windows editor

- Use a separate Windows PC or separate CapCut profile with **CapCut Desktop 9.6**. Record the exact app build. A 9.1 or other-version result is a distinct compatibility test.
- Arrange an exclusive editor session. Close CapCut before copying or relinking. Do not touch existing projects, Premiere, account permissions or cloud sync.
- Do not proceed if a project folder or draft ID matching this package already exists in the destination store. Do not overwrite it. Do not use `--force-write`.
- The already reviewed `capcut-cli` **0.31.1** is needed for the deterministic registration/relink commands below. It is not inside the archive. If unavailable on the other editor, stop the CLI part and record a native CapCut relink attempt separately; do not install a plugin or authorize OAuth for this test.
- The test is local only. CapCut export must have **Sync exported videos to space** off. Do not select AI generation, Pro credits, purchases, or a cloud share target.

## Import and relink on the receiving Windows machine

In PowerShell, set these three values to the actual local paths. The CapCut folder is usually the path below, but verify it on that machine. The destination folder must **not** exist beforehand.

```powershell
$handoffZip = 'C:\path\received\CG_CAPCUT_SYNTHETIC_HANDOFF_STAFF.zip'
$capcutCli = 'C:\path\to\capcut.cmd' # capcut-cli 0.31.1, already available locally
$capcutDraftStore = Join-Path $env:LOCALAPPDATA 'CapCut\User Data\Projects\com.lveditor.draft'
$packageName = 'CG_CAPCUT_POC_20261024_NATIVE_ORIGINAL-copy'
$unpack = 'C:\path\to\private\synthetic-handoff-unpacked'

if (Test-Path -LiteralPath $unpack) { throw 'Unpack path already exists' }
Expand-Archive -LiteralPath $handoffZip -DestinationPath $unpack
$source = Join-Path $unpack $packageName
$destination = Join-Path $capcutDraftStore $packageName
if (Test-Path -LiteralPath $destination) { throw 'CapCut project name collision: stop' }

$manifest = Get-Content -LiteralPath (Join-Path $unpack 'media-manifest.json') -Raw | ConvertFrom-Json
foreach ($entry in $manifest) {
    $media = Join-Path $source ($entry.path.Replace('/', '\'))
    $actual = (Get-FileHash -LiteralPath $media -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $entry.sha256) { throw "Media hash mismatch: $($entry.path)" }
}

Copy-Item -LiteralPath $source -Destination $destination -Recurse
& $capcutCli relink $destination --dir (Join-Path $destination 'assets') --recursive --active-timeline
& $capcutCli lint $destination --active-timeline
& $capcutCli diagnose $destination
& $capcutCli register $destination --materials --apply --drafts $capcutDraftStore
```

The expected relink count on a **different** PC is five, with zero missing or ambiguous matches. `lint` should report zero errors, warnings and `media-outside-draft` items. `diagnose` should report `diverged: false` and `write_guard: ok`. Stop on any unexpected result before opening CapCut. `register` must show this exact destination and a successful application of the project/material metadata. It may edit that receiving machine's CapCut `root_meta_info.json` to list the newly added synthetic project; that operation was **not** performed on another PC in this research.

When the old absolute paths remain accessible on the same PC, `relink --dir` may report **zero** repairs because it only replaces missing media. For a controlled same-PC path-change rehearsal, use `relink $destination --from <old project folder> --to $destination --active-timeline` instead, and rerun `lint`/`diagnose`. Do not infer portability from an unmodified original media folder still being present.

## Native acceptance on the receiving editor

1. Launch CapCut Desktop. Search the exact project name before opening its single matching card; verify Details shows the destination path. If CapCut opens a different card, stop.
2. Verify all three 4-second synthetic scene clips, the transparent figure, and the 12-second audio track appear with no missing-media prompt. Play the full timeline.
3. Select the native text clip. Confirm the Text panel contains `CG CAPCUT` / `APP EDITED` and change one word or the font size. Save, close, reopen the exact project, and confirm the edit is still editable.
4. Export **locally** through CapCut as H.264 MP4 with space sync off. Verify the resulting file with `ffprobe` or another decoder and inspect picture/audio. An FFmpeg proxy is not acceptance evidence.
5. Record app version, destination project path, relink/registration output, title change, save/reopen result, native export path/duration, and any failures. Retain the test as a disposable local project; do not upload it.

## What has been witnessed so far

On the source Windows host, archive media hashes verified after a separate-path unzip. Plain copy produced five external path references. Explicit `relink --from <package path> --to <unpacked path>` repaired all five, after which `lint` reported zero issues and `diagnose` reported matching root/nested timelines with an `ok` write guard. This is a **local file/path test only**. No Franco or Sydney machine is connected through the available remote-device tool, and no separate Windows editor/profile has opened, edited, reopened or exported this archive. Cross-device staff editability is therefore **unverified**.
