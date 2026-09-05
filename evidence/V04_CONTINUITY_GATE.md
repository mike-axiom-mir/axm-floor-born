# Floorborn v0.4 continuity gate

Status: **PASS on PR lane; do not auto-merge**

## Operational claim

v0.4 deepens the bounded operational-player result from v0.3. Within this RPG laboratory, the same deterministic non-neural Floorborn lineage can now preserve inspectable continuity across experience in three distinct ways:

1. **companion continuity**: prior shared play with a specific peer can alter a later coordination choice involving that same peer without automatically transferring the relationship evidence to a stranger;
2. **self-selected optional intent**: a legitimate earlier optional discovery can alter what Floorborn chooses to pursue after the required adventure is already complete;
3. **mistake and recovery**: Floorborn can make a locally legal choice that produces a negative hidden outcome, retain that result, choose a different route, and still complete the same session without resetting.

This is not evidence of consciousness, personhood, subjective experience, human-like understanding, or general game-playing competence.

## Verification

GitHub Actions `floorborn-proof` run **#86** on the v0.4 PR head completed successfully on Node 24.

- **33 tests passed, 0 failed**;
- v0.1 bounded-player demo PASS;
- v0.3 expedition player gate PASS;
- v0.4 named continuity gate PASS.

The named continuity harness is `experiments/continuity-proof.js` and runs with:

```bash
npm run continuity
```

## Companion continuity result

A Floorborn lineage completed a 17-turn shared expedition with `chat-001` before entering a later neutral campfire interlude.

Retained companion evidence included:

- 9 observed Floorborn turns involving `chat-001`;
- the earlier shared session identity;
- 7 companion-specific cooperative outcome observations.

At the later interlude:

- remembered `chat-001` -> `signal:continue-with-peer`;
- new `chat-new` -> `signal:finish-journey`.

The reunion decision exposed:

```text
base:signal=0.5
optional-curiosity=+0.4
companion:chat-001=+1.8
companion-outcome:chat-001=+0.729
```

The system deliberately does **not** store a hidden or moralized `trust` field. Companion memory is explicit observed history: shared sessions, observed turns, signals, places, inventory sightings, and peer-specific cooperative outcome evidence.

## Relationship-specific learning boundary

During v0.4 development we identified a dangerous simplification: if `cooperation` were learned only as a global tag, a successful action involving one peer could make Floorborn behave as if the same relationship evidence applied to every stranger.

v0.4 therefore keeps `cooperation` and `communication` outcome signals attached to the peer present when Floorborn made the action. General world facts can still transfer. Relationship-specific evidence does not silently become universal reputation.

A first stronger test also failed in GitHub Actions run **#76** because its comparison was confounded by legitimate Gate memory: after a successful expedition Floorborn had learned that the Gate itself was valuable and chose it for both the familiar-peer and stranger cases. We did not weaken or delete that world memory. The experiment was repaired by moving the reunion-vs-stranger comparison to a neutral post-adventure interlude where companion continuity is the actual variable under test.

The repaired test passed on run #80 and remains green in run #86.

## Self-selected optional intent

A fresh Floorborn and an experienced Floorborn receive the exact same legal post-adventure action menu.

Fresh lineage:

```text
signal:finish-journey
```

A lineage that previously found and legally gathered a memory relic:

```text
signal:seek-relic
```

The experienced decision exposes:

```text
base:signal=0.5
memory:relic=+0.5
optional-curiosity=+0.4
```

The game rules did not change. Retained experience changed arbitration among the same legal choices. The interlude receipt replayed exactly: **PASS**.

This is intentionally a small optional-goal result. It does not prove open-ended goal creation. It proves that a non-required future intent can be selected because of the player lineage's own retained game history rather than because the current quest requires it.

## Mistake and recovery

For deterministic seed `1`, a fresh Floorborn initially chose:

```text
move:archive
inspect:archive
```

The hidden outcome was:

```text
trap:archive
```

After returning to camp, Floorborn selected:

```text
move:grove
```

rather than immediately repeating the bad Archive route.

The rejected Archive proposal retained visible negative evidence:

```text
familiarity:2=-0.2
memory:ancient=-0.875
memory:knowledge=-0.875
repetition:1=-0.35
```

Floorborn then completed the same expedition in 15 turns. Exact receipt replay: **PASS**.

No state reset, memory deletion, or scripted `if trap then grove` repair was used.

## Claim boundary

v0.4 supports this narrower statement:

> A deterministic machine-floor player in the AXM bounded RPG lab can preserve lineage-local experience about worlds and specific companions, let that history alter later legal choices, choose a non-required future intent from experience, and recover from a negative hidden outcome without resetting its player history.

It does not establish subjective machine experience or a universal notion of a player across arbitrary games.

## Next depth

Do not restart v0.1-v0.4 or spread horizontally into every genre yet. The next useful depth is a longer multi-session journey with richer bounded communication, imperfect/contradictory peer evidence, longer-horizon commitments, stronger blind worlds, and explicit tests that memories can be revised when later evidence disagrees.

Only after that should the same player boundary be generalized into RTS, shooter, survival, puzzle, and other genres.
