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
- Broad relationship familiarity is context, not proof of a specific claim.
- For a claim-dependent action: unverified exact claim -> verify first; supported exact claim -> broader context may participate; contradicted exact claim -> exact evidence blocks broad relationship/communication priors for that claim.
- Preserve lifetime evidence and recent specific evidence as separate timescales. Recent consistent receipts may revise current stance without deleting historical counts.

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
1. self-selected optional intent stored as explicit pending lineage state;
2. survives unrelated sessions and snapshot/restore;
3. matching later legal opportunity may receive intention evidence;
4. fulfillment retires as `fulfilled`;
5. changed world state may retire as `invalidated`;
6. retired intent stays inspectable but stops influencing arbitration;
7. fulfillment does not force regeneration;
8. later re-adoption creates a new lifecycle record;
9. opportunity replay remains exact;
10. failed run #114 remains evidence that continuity must not be mistaken for compulsion.

Named proof:

```bash
npm run intention
```

Evidence: `evidence/V06_INTENTION_GATE.md`.

### v0.7 multi-session campaign
Must remain passing:
1. same Floorborn lineage across multiple distinct sessions/world seeds;
2. recurring companion plus stranger remain distinct;
3. hidden adversarial trap may be selected by the host, but hidden contents are never player input;
4. trap consequence can alter later recovery route without reset;
5. supported exact companion signal can alter later action;
6. later exact contradictions can revise that action even after substantial broad companion history;
7. a familiar companion's brand-new specific claim remains unverified until evidence exists;
8. lifetime signal counts are preserved while bounded recent verdict history may revise current weighting;
9. exact signal evidence does not leak to strangers or unrelated signals;
10. optional relic experience may create later optional intent;
11. pending intent survives unrelated session and exact snapshot restore;
12. matching future opportunity can receive intention evidence and fulfillment retires the intent;
13. final closure occurs with no active intention compulsion;
14. deterministic campaign ledger records checkpoints and forward causal links from earlier evidence to later behavior;
15. final player and campaign-ledger snapshots restore exactly;
16. failed campaign runs remain evidence of state interactions rather than being rewritten out of history.

Named proof:

```bash
npm run campaign
```

Evidence: `evidence/V07_CAMPAIGN_GATE.md`.

## Current depth after v0.7: first genre transfer
The bounded RPG player substrate and combined campaign are now strong enough to justify the first genre-transfer experiment.

### v0.8 target: RTS action-budget player
Build a minimal deterministic RTS laboratory that tests whether the same Floorborn player boundary can operate under real-time-style scarce agency.

Hard RTS equality constraints:
1. all equivalent player types receive the same visible RTS state/fog-of-war boundary;
2. all equivalent player types receive the same legal command vocabulary;
3. internal reasoning/computation is not artificially equalized;
4. external effective APM/action bandwidth **is** equalized;
5. one command may not secretly contain hundreds of individually retasked units to bypass APM;
6. command bundles must have a deterministic effective-action cost;
7. over-budget commands are rejected before world mutation;
8. action budget replenishment must be deterministic and replayable;
9. Floorborn must choose which commands are worth spending scarce actions on;
10. measurements should include action-budget allocation, not only win/loss;
11. preserve full command receipts and exact replay;
12. do not optimize Floorborn specifically to beat humans or neural models.

Start with a tiny RTS world before plugging into an AXM game. The research target is whether Floorborn's player continuity transfers into a different genre and how it spends bounded agency.

Do not optimize for winning. The research target is what kind of player a machine-floor architecture becomes when it can participate, accumulate and revise history, carry and retire intentions, recover, transfer across genres, and remain bounded by the same world-facing rules as other players.
