# AXM Floorborn agent lane

## Root question
Can the machine floor itself become a real bounded player: observe a game through the same player-facing door, choose legal actions without a neural player model, retain its own machine-readable history, and let that history causally change later play?

## Lane rule
One chat = one PR lane. Do not scatter work across unrelated branches or repositories.

## Hard roots
- Different outside, equal inside: player types may think differently, but enter through the same game-defined observation/action boundary.
- Unlimited internal method, bounded external agency. A game may impose action/APM/deadline limits, but must not pretend different architectures think the same way.
- No privileged engine truth for Floorborn. If a human player cannot observe hidden state through the player interface, Floorborn does not receive it either.
- Baseline Floorborn stays non-neural. A neural player may participate as a peer player, never as a hidden chooser inside Floorborn.
- Do not claim consciousness or subjective experience. "Experience" here means retained causal history: observed state, chosen action, outcome, and later behavioral effect.
- Growth must be inspectable. Prefer explicit episodic/pattern/companion memory and evidence over opaque self-modification.
- Receipts and deterministic replay are first-class. Claims require replayable evidence.
- State-research findings may flow to `axm-state-research`, but this repo owns the machine-as-player experiment.
- No automatic canon or merge. Passing tests are evidence, not permission to silently declare the architecture final.
- Companion history is evidence, not a hidden moral or reputation score. Do not invent `trust` labels when the machine only observed sessions, signals, actions, places, or outcomes.
- Relationship-specific cooperative/communication outcomes must remain attached to the observed peer unless evidence supports broader transfer. Do not silently generalize one companion's history to strangers.

## Preserved gates

### v0.1 bounded player
Already demonstrated and must remain passing:
1. bounded player observation, not engine internals;
2. legal action enforcement;
3. deterministic non-neural chooser;
4. exact action/outcome replay;
5. persistent experience changes a later legal choice;
6. inspectable reason for changed arbitration.

### v0.2 shared-world player
Already demonstrated and must remain passing:
1. Floorborn and an external working chat occupy separate player identities;
2. both use the same neutral player protocol;
3. neither controls the other;
4. both alter one shared RPG world through ordinary legal actions;
5. co-op completion is replayable from receipts.

### v0.3 hidden expedition player
Already demonstrated and must remain passing:
1. hidden layouts vary by seed and remain hidden until player inspection;
2. Floorborn completes multiple unseen layouts without a fixed action sequence;
3. changing layouts produce different lived action histories;
4. prior experience changes later route selection;
5. simple learned aversions cannot accidentally override explicit goal relevance;
6. repeated-action pressure reduces loops without erasing persistent memory;
7. a second player's unexpected legal actions can change shared world state and Floorborn continues from the resulting observation;
8. a working chat can participate in a blind live expedition through the same bounded observation/action door;
9. live sessions remain receipt-backed and exactly replayable.

### v0.4 continuity player
Already demonstrated and must remain passing:
1. Floorborn keeps lineage-local companion observations across sessions;
2. repeated reads of the same observation do not inflate companion history;
3. familiarity means prior history, not merely seeing a peer for the first time in the current turn;
4. successful cooperative/communication outcomes are stored on the actual companion rather than as a universal stranger-facing relationship score;
5. a later neutral choice can distinguish an earlier companion from a stranger because of preserved companion evidence;
6. a legitimate optional discovery can change a later non-required intent while the legal action menu stays identical;
7. Floorborn can experience a hidden negative outcome, change route, recover, complete the same session, and preserve exact replay;
8. companion memory stays lineage-local and does not leak into a fresh Floorborn identity;
9. failed experiments remain evidence: do not erase useful confounds merely to make a gate green.

Named proof:

```bash
npm run continuity
```

Evidence: `evidence/V04_CONTINUITY_GATE.md`.

## Current depth after v0.4
Do not rebuild v0.1-v0.4 and do not expand sideways into unrelated games yet.

Deepen continuity first:
1. longer multi-session journeys with the same Floorborn lineage;
2. richer but still bounded communication semantics;
3. contradictory or imperfect companion evidence and explicit memory revision;
4. longer-horizon intentions that survive ordinary state changes;
5. stronger blind/adversarial world variants;
6. tests that distinguish useful transfer from overgeneralization.

Only after those gates are earned should the same player boundary be generalized to RTS, shooter, survival, puzzle, and other genres. For RTS, preserve the equality rule: internal reasoning may differ, while external effective APM/action bandwidth is bounded by the game.

Do not optimize for winning. The research target is what kind of player a machine-floor architecture becomes when it can participate, accumulate history, recover, form inspectable continuity, and remain bounded by the same world-facing rules as other players.
