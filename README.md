# AXM Floorborn

**Research question:** can the machine floor itself become a real player?

Floorborn gives a deterministic machine-floor architecture a bounded player slot rather than hiding a conventional neural game-playing agent inside it.

> **Different outside. Equal inside. Choice and action define the player.**

Humans, neural models, Floorborn, and future player architectures may think differently. The game equalizes the world-facing boundary: visibility, legal actions, consequences, and genre-specific action/APM/deadline limits.

## Evidence ladder

### v0.1 — bounded player

Floorborn receives only player-visible state, chooses only legal actions, produces replayable receipts, and retains explicit experience that can measurably change a later choice.

### v0.2 — shared-world player

Floorborn and an external working neural chat occupy separate player identities in one RPG world through the same `axm.player.v0.1` protocol. Neither controls the other. The first live Twinseal co-op run completed and replayed exactly.

Evidence: [`evidence/LIVE_CHAT_SESSION_001.md`](evidence/LIVE_CHAT_SESSION_001.md).

### v0.3 — hidden expedition player

A seed-dependent world hides two required seals, one optional relic, and one trap across four regions. Floorborn must discover them through ordinary play. It completes multiple unseen layouts without a fixed action sequence, changes routes as experience changes, absorbs another player's world-state changes, and remains exactly replayable.

A working chat and Floorborn also completed a blind 13-turn shared expedition while the chat saw only its bounded observation/action view.

Evidence: [`evidence/LIVE_EXPEDITION_SESSION_001.md`](evidence/LIVE_EXPEDITION_SESSION_001.md), [`evidence/V03_PLAYER_GATE.md`](evidence/V03_PLAYER_GATE.md).

### v0.4 — player continuity

The same Floorborn lineage can retain explicit companion-specific history, distinguish a recurring companion from a stranger in a later neutral choice, select a non-required future intent because of earlier optional experience, and recover from a hidden negative outcome without resetting.

Companion memory is evidence, not a hidden `trust` or reputation score. Relationship-specific cooperative outcomes stay attached to the observed peer.

Named proof:

```bash
npm run continuity
```

Evidence: [`evidence/V04_CONTINUITY_GATE.md`](evidence/V04_CONTINUITY_GATE.md).

### v0.5 — revisable evidence

Floorborn can retain companion-and-signal-specific support/contradiction receipts and revise its later action in both directions as newer evidence disagrees or agrees.

Measured sequence for `chat-001 / route-safe`:

```text
fresh                  -> verify independently
supported 4 / contra 0 -> follow peer
supported 4 / contra 8 -> verify independently
supported 16 / contra 8 -> follow peer
```

The evidence does not leak to a stranger or to a different signal from the same companion.

Named proof:

```bash
npm run revision
```

Evidence: [`evidence/V05_REVISION_GATE.md`](evidence/V05_REVISION_GATE.md).

### v0.6 — intention lifecycle

A self-selected optional intention can now become explicit pending lineage state, survive unrelated later play and snapshot/restore, influence a matching future legal opportunity, and then retire as fulfilled or invalidated.

Example lifecycle:

```text
session A: choose seek-relic
        ↓
pending intention #1
        ↓
session B: unrelated play
        ↓
still pending
        ↓
session C: relic opportunity
        ↓
pursue route + gather relic
        ↓
intention #1 = fulfilled
        ↓
later interlude: old intention no longer influences choice
```

A fulfilled intention remains inspectable history but does not become an immortal command. If the same intent is later adopted again, it receives a new sequence record rather than resurrecting the retired one. Changed world state may instead retire a pending intention as `invalidated`.

The first v0.6 test incorrectly required Floorborn to automatically want another relic immediately after fulfillment. Floorborn instead chose `finish-journey`. The research gate was repaired in the stricter direction: continuity must not become compulsion.

Named proof:

```bash
npm run intention
```

Evidence: [`evidence/V06_INTENTION_GATE.md`](evidence/V06_INTENTION_GATE.md).

## Current verification

Requires Node.js 24+ and no external packages.

```bash
npm test
npm run demo
npm run expedition
npm run continuity
npm run revision
npm run intention
```

The verified v0.6 PR head reports **44 tests passed, 0 failed**, and all named gates through v0.6 pass in GitHub Actions.

## What "experience" means here

This project does not claim consciousness or subjective experience. **Experience** means retained causal history: observations, actions, outcomes, repeated patterns, companion-specific evidence, revisable signal evidence, explicit intentions, and measurable later behavioral effects.

At v0.6, Floorborn meets this repo's narrower definition of a **bounded operational player with inspectable continuity** inside the RPG laboratory. It is not a claim of human-like understanding or general game-playing intelligence.

## Next research depth

Do not restart the old proofs or scatter into every genre yet. The next useful gate is a longer blind multi-session campaign combining the mechanisms already earned: changing hidden worlds, recurring companion plus stranger, evidence revision, optional intentions, mistake/recovery, session-to-session snapshot continuity, and a campaign-level receipt index showing which earlier events caused later behavior.

Only after that should the same neutral player boundary be transferred into RTS, shooter, survival, puzzle, and other genres. For RTS, internal reasoning may differ while effective APM/action bandwidth is bounded by the game.

## Repo boundary

`axm-floor-born` owns the machine-as-player experiment: player protocol, Floorborn identity/memory, game adapters, experiments, and evidence. General machine-state discoveries may flow to `axm-state-research` without collapsing the two projects into one.

See [`AGENTS.md`](AGENTS.md) for lane rules and preserved gates, [`docs/FOUNDATION.md`](docs/FOUNDATION.md) for the research foundation, and `evidence/` for replay-backed records.
