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
- Growth must be inspectable. Prefer explicit episodic/pattern/companion/intention state and evidence over opaque self-modification.
- Receipts and deterministic replay are first-class. Claims require replayable evidence.
- State-research findings may flow to `axm-state-research`, but this repo owns the machine-as-player experiment.
- No automatic canon or merge. Passing tests are evidence, not permission to silently declare the architecture final.
- Companion history is evidence, not a hidden moral or reputation score. Do not invent `trust` labels when the machine only observed sessions, signals, actions, places, or outcomes.
- Relationship-specific cooperative/communication outcomes must remain attached to the observed peer unless evidence supports broader transfer. Do not silently generalize one companion's history to strangers.
- Memory must remain revisable. Do not freeze the first supported or contradicted observation into permanent belief when later receipts disagree.
- Continuity must not become compulsion. A fulfilled or invalidated intention remains history but must stop influencing arbitration unless a new lifecycle is explicitly adopted.

## Preserved gates

### v0.1 bounded player
Must remain passing: bounded observation, legal action enforcement, deterministic non-neural chooser, exact replay, persistent experience changing a later legal choice, and inspectable decision evidence.

### v0.2 shared-world player
Must remain passing: Floorborn and an external working chat occupy separate player identities, use the same neutral protocol, alter one shared RPG world through ordinary legal actions, and replay co-op completion exactly.

### v0.3 hidden expedition player
Must remain passing: hidden seed-dependent layouts, non-fixed action histories, transfer from prior experience, recovery from changing shared state, separate goal relevance, loop pressure without memory deletion, blind working-chat participation, and exact live replay.

### v0.4 continuity player
Must remain passing: lineage-local companion history, no duplicate observation inflation, prior familiarity distinct from first sight, peer-specific cooperative outcomes, remembered companion vs stranger behavior difference, optional experience changing a non-required intent, mistake/recovery without reset, fresh-lineage isolation, and preservation of failed experiments.

Named proof:

```bash
npm run continuity
```

Evidence: `evidence/V04_CONTINUITY_GATE.md`.

### v0.5 evidence revision
Must remain passing: companion+signal-specific support/contradiction receipts, bidirectional revision as later evidence changes, no leak to strangers or unrelated signals, exact replay/restore, and no unsupported trust/deception labels.

Named proof:

```bash
npm run revision
```

Evidence: `evidence/V05_REVISION_GATE.md`.

### v0.6 intention lifecycle
Must remain passing:
1. a self-selected optional intention is stored as explicit pending lineage state;
2. it survives unrelated sessions and snapshot/restore;
3. a matching later legal opportunity may receive intention evidence;
4. ordinary fulfillment retires the pending intention as `fulfilled`;
5. changed world state may retire it as `invalidated`;
6. retired intentions remain inspectable history but stop influencing arbitration;
7. fulfillment must not force the same intent to regenerate;
8. later legal re-adoption creates a new sequence/lifecycle rather than resurrecting a retired record;
9. intention opportunity sessions replay exactly;
10. failed run #114 remains evidence that continuity must not be mistaken for compulsion.

Named proof:

```bash
npm run intention
```

Evidence: `evidence/V06_INTENTION_GATE.md`.

## Current depth after v0.6
Do not rebuild v0.1-v0.6 and do not spread sideways into unrelated games yet.

The next gate should combine the established mechanisms in a longer blind multi-session campaign:
1. same Floorborn lineage across multiple distinct sessions/world seeds;
2. at least one recurring companion and one stranger;
3. optional intention creation, ordinary intervening play, later opportunity, and retirement;
4. companion evidence that can be supported and contradicted during the campaign;
5. at least one hidden negative outcome and recovery without reset;
6. campaign-level receipts/index showing which session caused which later state change;
7. snapshot/restore between sessions without losing lineage continuity;
8. no raw host/hidden world state passed as player observation;
9. no special architecture-specific action privileges.

After a blind multi-session campaign is earned, consider the first genre transfer. For RTS preserve the equality rule: internal reasoning may differ, while external effective APM/action bandwidth is bounded by the game.

Do not optimize for winning. The research target is what kind of player a machine-floor architecture becomes when it can participate, accumulate and revise history, carry and retire intentions, recover, and remain bounded by the same world-facing rules as other players.
