---
name: bottles-game-install
description: Install a Windows game from a user-provided local installer folder into Bottles, configure its runtime, create a launch shortcut, and verify installation and gameplay through direct testing. Use when asked to handle a Bottles game installation end to end or troubleshoot that installation.
---
# Bottles game installation

The user supplies the game folder; the agent owns installation and testing. Use normal Bottles workflows and the original folder. Do not substitute folder lessons, a new launcher, or repeated requests that the user click and report back. A skill guides agent work; it cannot guarantee Windows compatibility.

## Establish the actual starting state

- Read local MACHINE.md and any recorded Bottles diagnosis before repeating previous work. Discover the installed Bottles variant, current app/runtime versions, available runners, bottle configuration, and active game/installer processes. Check official updates early, before building workarounds; inspect release notes rather than assuming an update fixes the observed bug.
- Resolve the supplied folder, executable, neighboring archives, supplied checksums and required languages/components. Avoid copying large installers merely to satisfy a sandbox. Do not rerun an already completed installation without a reason.
- Prefer a dedicated game bottle. Reuse the user's selected/configured bottle when appropriate; preserve its games and saved data. New bottles do not inherit another bottle's fixes or dependencies. Announce the choice briefly.
- Run `scripts/preflight.py SOURCE --bottle-path PREFIX` for a Flatpak installation once the prefix exists. It checks actual source readability inside a fresh sandbox and the prefix's host disk space. It does not check archive integrity or prove an already-running GUI has new permissions. Resolve its failures before running the installer.
- Grant only the relevant source directory access when needed, normally read-only. Verify all companion archives through the same sandbox path the installer will use. File-picker exports may expose only setup.exe. Start a new app instance after permissions change; do not kill unrelated games to do so.
- Establish destination plus temporary-space requirements from the installer and real filesystem. Prefer a destination on the bottle's C: drive with a distinct game directory. Never infer free SSD space from Z:, which may map to Flatpak's temporary root. Do not automatically pass Inno Setup flags to an unidentified installer.

## Install and measure

Check graphics-driver/runtime compatibility, DXVK/VKD3D where needed, and the game's required redistributables. Install required components through Bottles or the supplied legitimate installers; avoid indiscriminate dependency bundles and globally applying one game's workaround.

Launch with the correct working directory and capture a bounded log. Drive the installer through available desktop/Windows automation. Explain before taking screen or keyboard control. Keep saves and source archives intact; skip bundled advertising, browser offers, unrelated host/network changes, and optional auto-launch until ready to test. Do not alter DRM or swap in alternate cracked binaries.

Measure installation using progress, process CPU/I/O deltas and destination growth together. Identify processes by executable and prefix, not a command-line substring. A quiet progress bar alone is not a hang; a process alive alone is not progress. Before retries, capture the error, stage and measurements. After two failed attempts at the same stage, change the diagnostic approach rather than relaunching identically. Use the diagnostic-loop skill when the sensor or symptom is uncertain.

For matching failures, read [references/failure-patterns.md](references/failure-patterns.md). These are conditional evidence, not default configuration. Revert changes that do not help unless they have an independently verified purpose. Never terminate all Bottles instances just to clear one installer. Temporary installation displays must be stopped after completion and must not become the game's launch display.

## Finish only at the demonstrated level

1. **Installed:** observe successful completion and required files. Run supplied integrity verification where available; record missing/bad files. Finish required redistributables and verify their installed state.
2. **Launches:** start through the final saved Bottles program entry, on the user's real display. Check responsiveness and crash logs. Resolve graphics/device warnings rather than clicking past them and declaring success.
3. **Renders:** directly observe the actual launcher/menu or game frames with an available, permitted capture path. Process liveness, WM_NULL response and GPU memory allocation do not prove rendering. If capture is unavailable, distinguish the resulting verification limit explicitly.
4. **Playable:** exercise a brief tutorial, benchmark or safe gameplay segment where available; verify input, visible rendering and sound when measurable, then a clean exit and one relaunch through the final shortcut. Do not overwrite existing saves or make account purchases. Without this evidence, say "installed; gameplay unverified," not "fully tested."

Register the correct executable in Bottles and add a normal application-menu shortcut when supported. Check its exact path, working directory and arguments; test the saved launch route rather than a different diagnostic command. Avoid a second launcher layer. Leave a concise durable record of versions, settings actually applied, evidence, shortcut and unresolved limits; use local machine notes for machine-specific paths.

Report what the user can launch and the demonstrated test level in plain language. Ask only for genuinely missing source files, credentials, preferences with material impact, or unavailable human-only interaction. If direct access is blocked, state the precise blocker instead of inventing successful verification. Do not require the user to learn drive mappings or special staging folders.
