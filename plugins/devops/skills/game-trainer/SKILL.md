---
name: game-trainer
description: Build, extend or repair a native Linux GTK trainer for a single-player game on this machine (Bottles, Wine or Proton). Scaffolds a version-locked project, chooses the method, and sets the verification, install and rollback rules from six earlier trainers. Use when asked to make a trainer or cheat panel, add a trainer feature, or fix one after a game update.
---
# Game trainer

Six trainers live in `~/Games`. Each re-derived the same pattern, so start here. Single-player only: read `plugins/universal-modder/skills/mod-any-game/references/safety.md` first. Refuse online play, active anti-cheat, and multiplayer sessions, and encode that refusal as a runtime gate, not a promise.

## Start

1. `wrecall --brief "<game> trainer"`. Read the closest existing trainer below before writing anything.
2. Make the supplied material an input, not a dependency. Cheat tables are evidence: parse them, never run their scripts, and treat old offsets as hypotheses. One table here was only a promotional Lua script.
3. Identify the exact build with its SHA-256. Back up saves and settings outside the game, and verify the copies byte for byte before any live test.
4. Scaffold: `scripts/new-trainer "<Game>" <executable>`. It refuses an existing folder and creates `~/Games/<Game> Trainer` with the build hash, tests, a GTK panel, a launcher and a menu entry. Run `/usr/bin/python3 -m unittest test_memory.py` there. Use `--no-launcher` for a trial.

Use `/usr/bin/python3`, because GTK bindings are on the system Python.

## Choose the method

| The game is | Method | Copy from |
|---|---|---|
| Managed .NET with a mod loader | In-process module plus a leased file bridge | `Bannerlord Trainer` |
| Native, stable values, no hooks needed | `/proc/<pid>/mem` with re-applied switches | `GTA SA Trainer` |
| Native, code must change | Stopped-thread transactional patch via gdb, restored on close | `StarCraft Trainer` |
| Native, needs hooks | Validated code caves, player-only, disk file untouched | `Ghost Trainer` |
| Unreal under Proton | Signatures, live structure checks, game-thread dispatch | `Dune Trainer` |
| Simulation state | Preview, apply, and undo that refuses newer state | `SuperPower 2 Trainer` |

Prefer a supported API when the game has one. Never patch the executable on disk.

## Rules every trainer keeps

- **Version lock.** Refuse any other build by hash or PE fingerprint. After a game update, re-derive and re-validate; never just replace the hash.
- **Identity, not names.** Find the game by its mapped executable (`processes.py`), plus start time to catch a recycled pid. `pgrep` lies: Bannerlord's process is named `Starter`, which made a running game look stopped.
- **Live is not ready.** A connected process is not a playable save. Effects stay off until a real state check passes, and the panel says which state it sees.
- **Writes are guarded.** Compare expected bytes, write, read back. Refuse unknown bytes and partial patches, and recover only from exact known states.
- **Lease or restore.** Closing the panel, or the panel dying, must end ongoing effects. In-game modules use a short lease; patches restore on close. State plainly what a force-kill leaves behind.
- **One-time grants stay separate.** Gold or stats cannot be undone by a switch, so keep them out of toggle-all.
- **One instance.** Use `flock`. The module and panel must share one control list, generated from one file.
- **Hotkeys.** F8 to F12 go through the shared router, `Bannerlord Trainer/hotkey.py`, by mapped executable. A new hotkey game must be added there, and Dune keeps priority. GTA and StarCraft deliberately have no global keys.

## Verify in layers

1. **Unit:** the real backend against a fixture. Include refusal paths, reconnects, and rollback after partial failure.
2. **Static plus read-only live:** prove each address with cross-references and live values before any production write. Log it in `MODLOG.md` with what proved it. Discard guessed constants when evidence disagrees.
3. **Lab:** run behaviour tests against a copied prefix on a private Xvfb display (`:93`, `:94` so far), with the script refusing any other display or the real install. Measure off and on in the same run so a null cannot come from a dead sensor. Count game frames, not wall seconds, because the software-rendered lab runs slowly.
4. **Real game:** gate in-game checks behind a temporary file such as `bridge/verification.enabled`, and remove it afterwards. Never save during a check that mutates the campaign. Compare save hashes afterwards.
5. **Heartbeat and expiry:** confirm effects end when the panel dies.

Capturing the owner's actual display needs their explicit confirmation every time. Private lab displays are outside that rule. Say first if a test will occupy their screen or keyboard.

## Launch and load speed

Measure before guessing. Bannerlord went from 61 s to 16 s on 2026-10-31, and 44 of those seconds were waits, not loading.

- Sample one launch per second: per-thread CPU, `/proc/<pid>/io`, and the game's own log gaps. Idle CPU with no disk reads means the game is blocked, not loading.
- Catch a blocked launch with `ss -tunap`. A `SYN-SENT` that does not change is a dead server, and it sits under `wineserver`, not the game process. On that run the only clue in the game log came seconds after the stall ended, so the log alone misattributes it.
- For a single-player Bottles game, `flatpak run --unshare=network` makes dead connections fail at once. Local sockets still work. Test it first, and record that online features stop working.
- A fixed gap that survives no-network is a timeout. Galaxy sign-in is 15 s with no GOG client installed. Read the managed caller before touching anything: if the game already survives the failure, jump to that failure. Any on-disk patch needs the owner's approval, an exact-byte check that refuses other builds, a stored original and a `--revert`, as in `Bannerlord Trainer/tools/patch-gog-signin.py`.
- Skip splash videos from the module, in the hook that runs just before the check, and look for a built-in argument such as `/continuegame` first.
- Time stages from real signals, ending at "playable" rather than "object exists". Keep a log of every launch and exclude runs with a dialog or a kill. A countdown from the median of the last five runs, re-anchored at each stage, was within 1 s here (`loadtimes.py`, `loadwatch.py`).
- Show the countdown as an override-redirect window under `GDK_BACKEND=x11`. It sits above a fullscreen game on GNOME and takes no focus.
- Log every in-game load too (`LoadTimer.cs`), so a later stall arrives as a number.

Slow saves or other bursts of parallel managed work under Wine can come from CPU count, not disk. Bannerlord saved 3x faster when narrowed to 7 physical P-cores with `SetProcessAffinityMask` on the save-start event and restored on save-over, so play keeps its cores. Sweep core sets before blaming storage, time the disk separately, and read `Cpus_allowed_list` from `/proc/<pid>/task/*/status` to prove the mask applied. Wine masks stop at its CPU count, so offline CPUs can cost the top host CPUs on restore. `flatpak run --env` did not reach the game through bottles-cli, so check `/proc/<pid>/environ`.

## Monitor placement

Games open on the middle monitor unless the owner chose another. Read `~/Games/trainer_common/game_monitor.py`, which is backed by `~/.config/game-trainers/monitor.json`, and put the choice in the trainer menu. Wine opens on the desktop primary, and it undoes moves for the first few seconds. Set `_NET_WM_WINDOW_OPACITY` to 0, move with `xplace.py`, wait for each move to settle, and restore opacity once the window holds still. Resending moves without waiting makes the window jump between monitors. Keep a launch button in the trainer.

## Install

- A running game keeps the old module. If the game is open, arm `tools/install-on-exit.py` from the Bannerlord trainer as a `systemd-run --user` unit, and do not touch installed files.
- Check the build result before arming: one failed build armed an install of a stale DLL.
- Install atomically: copy to a temporary name, then `os.replace`.
- Control counts must match. A panel reopened against an older module has its commands rejected, and effects stop until the game restarts.
- Keep `releases/before-<feature>/` with sources and the prior binary.

## Traps already paid for

- A GDB-based allocation experiment on Dune failed and the game exited shortly after. A Windows helper replaced that method.
- Steam's launch wrapper can start an anti-cheat launcher despite the argument, so a process existing does not show what is active. Check the live state.
- Force-killing a hook trainer can leave payloads in memory: restart the game before re-attaching.
- Some `.db` save files are not SQLite. Use ordinary byte-verified copies.
- A green light means attached, not that every patch applied. Show the message.
- A renamed copy of Ubuntu's `sleep` did not work as a test stand-in. The template copies the Python binary instead.

- Never kill Bannerlord to end a test. It leaves `safely_exited = 0`, the next start stops at a safe mode prompt, and that dialog pollutes the timing. Use `tools/stop-test-game.py`. Check other games for the same crash marker.
- A build failure must stop a test script. One chained script here installed and launched the old build.
- `pkill -f` matches the shell that runs it when the pattern appears in the command. Use an anchored pattern from a script file.
- Compare ownership and other game state by reading saves, without touching the running game. The format is in `Bannerlord Trainer/tools/read-save-fiefs.py`.

## Finish

README states controls, limits, verification with dates, and rollback. Evidence goes in `evidence/`. `wnote <game>-trainer` the durable facts, and add the trainer to the table above when it teaches a new method.
