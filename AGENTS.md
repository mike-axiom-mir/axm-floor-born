# AXM Floorborn agent lane

## Root question
Can the machine floor itself become a real bounded player: observe a game through the same player-facing door, choose legal actions without a neural player model, retain its own machine-readable history, and let that history causally change later play?

## Lane rule
One chat = one PR lane. Do not scatter work across unrelated branches or repositories.

## Hard roots
- Different outside, equal inside: player types may think differently, but enter through the same game-defined observation/action boundary.
- Unlimited internal method, bounded external agency. A game may impose action/APM/deadline limits, but must not pretend different architectures think the same way.
- No privileged engine truth for Floorborn. If a human player cannot observe hidden state through the player interface, Floorborn does not receive it either.
- Baseline proof stays non-neural. A neural player can be added later as another peer player, not hidden inside Floorborn.
- Do not claim consciousness or subjective experience. "Experience" here means retained causal history: observed state, chosen action, outcome, and later behavioral effect.
- Growth must be inspectable. Prefer explicit episodic/pattern memory and evidence over opaque self-modification.
- Receipts and deterministic replay are first-class. Claims require replayable evidence.
- State-research findings may flow to `axm-state-research`, but this repo owns the machine-as-player experiment.
- No automatic canon or merge. Passing tests are evidence, not permission to silently declare the architecture final.

## Current gate: v0.1
Prove all of the following in one tiny RPG laboratory:
1. Floorborn receives a bounded player observation, not engine internals.
2. Floorborn chooses only from legal player actions.
3. The chooser is deterministic and does not use a neural model.
4. A complete action/outcome receipt can be replayed exactly.
5. Persistent Floorborn experience can change a later legal choice.
6. The reason for that changed choice remains inspectable.

Do not optimize for winning. The research target is whether a machine floor can participate, accumulate history, and develop distinct play behavior.
