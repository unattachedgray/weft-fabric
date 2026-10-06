# Porting a mechanic between games

Use the `mashup-mods` skill with this checklist. The user chooses the donor,
receiving game and mechanic before work starts. Installation of these tools
does not establish that a particular game pair or feature is supported.

## Choose the smallest implementation

Prefer a self-contained mechanic implemented through the receiving game's mod
API. Use an existing source port or documented plugin interface when available.
A movement controller, combat rule, AI state machine or puzzle rule usually
needs less machinery than running two whole games and compositing frames.
Use passthrough only when retaining the donor runtime brings a measured benefit.

Keep the mechanic's simulation independent of the receiving game's adapters.
The core accepts inputs/state and returns state/events; the adapter owns the
host's entities, collision queries, input, rendering, audio and save format.
Declare which behavior is preserved and which behavior the user wants adapted.

## Evidence before implementation

Record both games' versions and executable/data hashes in `MODLOG.md`. Identify
the donor's relevant source, managed code, native functions or data tables with
the appropriate recon and RE tools. Distinguish observed behavior from an
inference. Trace the receiving game's actual mod API and update lifecycle.

Before comparing behavior, declare units, coordinate handedness, axis mapping,
tick rate, event ordering, floating-point precision, RNG/seed and reset state.
Explicitly test input edge versus held input, paused time, save/load and collisions
where they affect the mechanic. A frame-rate-dependent implementation can look
correct in one recording and fail in normal play.

## Verification when the user chooses a pair

1. Capture repeatable donor traces through the relevant real behavior. Include
   inputs, tick/time, state and observable events. Confirm the sensor fires and
   that the starting state and requested settings are actually applied.
2. Replay the same inputs through the independent ported core. Compare declared
   outputs using explicit tolerances or exact event ordering. Keep deviations
   visible; a successful compile is not behavioral parity.
3. Verify the receiving game's adapter separately: coordinate round trips,
   collision ownership, input forwarding, entity lifetime and event delivery.
4. Run a minimal mod in the receiving game through a repeatable scenario and
   compare gameplay, logs and timing with the intended behavior. Include a
   disabled-mod baseline and cleanup/uninstall verification.
5. For passthrough, measure latency and dropped/out-of-order messages; verify
   watchdog recovery after either process stops. Bound work and memory per tick.

Keep original files and saves backed up. Capture traces and decompiled material
in the local lab workspace. Distribute code, patches and converters appropriate
to the project; the user supplies game data locally. Publishing remains a
separate requested step. Record the verified result so the next recon can read it.

Current state: workflow and tools installed; no game pair has been tested.
