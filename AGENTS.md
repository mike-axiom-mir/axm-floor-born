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
- RTS equality means equal external effective-action bandwidth, not fake strict alternation. A player that still owns budget may keep legal command opportunities while another player is exhausted or yielded.
- RTS command cost is based on independently retasked groups/effects, not API packet count. Do not allow a giant payload to masquerade as one APM action.

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

### v0.8 RTS action-budget transfer
Must remain passing:
1. `axm.player.rts.v0.1` is a bounded sibling player protocol;
2. equivalent player types receive the same visible RTS state, legal command vocabulary, action window, and effective APM cap;
3. hidden engine-only enemy truth remains outside the player observation;
4. five-second windows expose two effective actions, equivalent to 24 effective APM;
5. multi-group commands pay one effective action per independently retasked group;
6. dishonest declared cost and stale over-budget commands are rejected before world mutation;
7. budget replenishment is deterministic and exactly replayable;
8. Floorborn can transfer through the RTS player door and choose which legal commands deserve scarce agency;
9. win/loss is not required for this gate.

Named proof:

```bash
npm run rts
```

Evidence: `evidence/V08_RTS_TRANSFER_GATE.md`.

### v0.9 shared RTS player slots
Must remain passing:
1. exactly two neutral player slots can occupy one shared RTS world;
2. mirrored roles receive the same protocol, command vocabulary, fog rules, command costs, and initial budget;
3. each player owns an independent effective-action budget;
4. one player cannot consume the other player's budget;
5. equal APM does not force strict command alternation;
6. a player with remaining budget may retain legal command opportunities while the other is exhausted/yielded;
7. one player's world mutation may change what the other can later observe, but only through that other player's legal visibility/fog boundary;
8. host-only hidden doctrine never enters a player observation;
9. stale/over-budget commands remain rejected before either player's world state mutates;
10. shared command receipts include acting player and both budget paths and replay exactly;
11. Floorborn and a working neural chat can occupy the two slots through the live bridge without architecture-specific privileges;
12. failed RTS run #20 remains evidence that a strict-alternation test was wrong, not a reason to distort the scheduler.

Named proof:

```bash
npm run shared-rts
```

Live bridge:

```bash
npm run live-shared-rts -- new FILE
npm run live-shared-rts -- act FILE ACTION_ID
npm run live-shared-rts -- show FILE
npm run live-shared-rts -- reveal FILE
npm run live-shared-rts -- verify FILE
```

Evidence:
- `evidence/V09_SHARED_RTS_GATE.md`
- `evidence/LIVE_SHARED_RTS_SESSION_001.md`

## Current depth after v0.9: contested RTS play
Do not expand into a large RTS yet. Add consequence before content.

### v0.10 target: contested RTS encounter
Build a tiny deterministic contested RTS world where two equal player slots can make choices that materially constrain, damage, displace, reveal, or protect the other side.

Hard constraints:
1. preserve independent equal effective-APM budgets;
2. preserve player-specific fog and the same legal command-cost rules;
3. introduce one shared contested objective or deterministic combat/contact system;
4. positioning, scouting, attack/defend/retreat choices must have replayable consequences;
5. one player's action must be able to change the other player's later legal choices or world state through ordinary game rules;
6. do not hardcode aggressive/defensive personalities into Floorborn;
7. allow mistakes and recovery rather than ending the experiment on first bad move;
8. do not make winning the only metric; record agency allocation, information gathering, positioning, losses, recovery, and objective pressure;
9. any combat resolution must be deterministic from visible/receipt-backed game state;
10. no player may issue more external effective actions than its own budget permits;
11. exact shared-world replay must include combat/state consequences;
12. once the deterministic gate is green, let a working chat occupy the peer slot through the same live boundary.

Do not optimize for winning. The research target is what kind of player a machine-floor architecture becomes when it can participate, accumulate and revise history, carry and retire intentions, recover, transfer across genres, spend bounded agency, and face another independent player under the same world-facing rules.
