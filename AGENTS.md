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
- Memory must remain revisable. Do not freeze the first supported or contradicted observation into permanent belief when later receipts disagree.

## Preserved gates

### v0.1 bounded player
Must remain passing: bounded observation, legal action enforcement, deterministic non-neural chooser, exact replay, persistent experience changing a later legal choice, and inspectable decision evidence.

### v0.2 shared-world player
Must remain passing: Floorborn and an external working chat occupy separate player identities, use the same neutral protocol, alter one shared RPG world through ordinary legal actions, and replay co-op completion exactly.

### v0.3 hidden expedition player
Must remain passing: hidden seed-dependent layouts, non-fixed action histories, transfer from prior experience, recovery from changing shared state, separate goal relevance, loop pressure without memory deletion, blind working-chat participation, and exact live replay.

### v0.4 continuity player
Must remain passing:
1. lineage-local companion observations survive across sessions;
2. rereading one observation does not inflate history;
3. first sight is not prior familiarity;
4. cooperative outcomes stay attached to the actual companion;
5. remembered companion vs stranger can alter a later neutral choice;
6. optional prior experience can change a later non-required intent with the same legal menu;
7. a hidden negative outcome can be learned from, routed around, and recovered from in the same session;
8. companion memory does not leak into a fresh lineage;
9. failed experiments remain evidence rather than being silently rewritten away.

Named proof:

```bash
npm run continuity
```

Evidence: `evidence/V04_CONTINUITY_GATE.md`.

### v0.5 evidence revision
Must remain passing:
1. peer signals are observed facts separate from evidence about whether those signals were supported;
2. support/contradiction evidence is keyed by both companion and signal;
3. supported evidence can make acting on that signal outrank independent verification;
4. later contradictions can reverse that choice;
5. still later supporting receipts can revise the influence again;
6. evidence does not leak to a stranger or to a different signal from the same companion;
7. verified signal sessions replay exactly and v0.5 memory restores exactly;
8. no `trust`, deception, honesty, or moral label is inferred from what is only supported/contradicted game evidence.

Named proof:

```bash
npm run revision
```

Evidence: `evidence/V05_REVISION_GATE.md`.

## Current depth after v0.5
Do not rebuild v0.1-v0.5 and do not spread sideways into unrelated games yet.

Deepen the player with longer-horizon intention:
1. allow an optional intention selected in one session to persist explicitly into later sessions;
2. keep intention state distinct from permanent identity or game rules;
3. ordinary intervening sessions must not silently erase or auto-complete it;
4. when a matching legal opportunity appears, pending intention may influence arbitration;
5. completion must retire the intention rather than create an immortal bias;
6. invalidation or contradictory world state must permit revision/retirement;
7. snapshot/restore and receipts must preserve the intention lifecycle exactly.

After that, deepen blind multi-session journeys and richer bounded communication before generalizing to RTS, shooter, survival, puzzle, and other genres. For RTS preserve the equality rule: internal reasoning may differ, while external effective APM/action bandwidth is bounded by the game.

Do not optimize for winning. The research target is what kind of player a machine-floor architecture becomes when it can participate, accumulate history, revise conclusions, carry intentions, recover, and remain bounded by the same world-facing rules as other players.
