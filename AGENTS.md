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
- Growth must be inspectable. Prefer explicit episodic/pattern memory and evidence over opaque self-modification.
- Receipts and deterministic replay are first-class. Claims require replayable evidence.
- State-research findings may flow to `axm-state-research`, but this repo owns the machine-as-player experiment.
- No automatic canon or merge. Passing tests are evidence, not permission to silently declare the architecture final.

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

## Current gate: v0.3 real-player expedition
Do not rebuild v0.1 or v0.2. Deepen player behavior while preserving them.

The current expedition gate must demonstrate:
1. hidden layouts vary by seed and remain hidden until player inspection;
2. Floorborn can complete multiple unseen layouts without a fixed action sequence;
3. changing layouts produce different lived action histories;
4. prior experience can change later route selection;
5. simple learned aversions cannot accidentally override explicit goal relevance;
6. repeated-action pressure can reduce loops without erasing persistent memory;
7. a second player's unexpected legal actions can change the shared world and Floorborn can continue from the resulting state;
8. a working chat can participate in a blind live expedition through the same bounded observation/action door;
9. live sessions remain receipt-backed and exactly replayable.

## Next depth after v0.3
If v0.3 is green, do not expand sideways into unrelated games yet. Increase player depth first: optional goals, richer communication, mistakes and recovery, cross-session companion memory, longer horizons, and stronger blind/adversarial runs. Only then generalize adapters across genres.

Do not optimize for winning. The research target is whether a machine-floor architecture can participate, accumulate history, develop distinct play behavior, and remain inspectable while doing so.
