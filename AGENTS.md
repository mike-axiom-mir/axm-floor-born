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
- Growth must be inspectable. Prefer explicit episodic/pattern/companion/intention/recovery state and evidence over opaque self-modification.
- Receipts and deterministic replay are first-class. Claims require replayable evidence.
- State-research findings may flow to `axm-state-research`, but this repo owns the machine-as-player experiment.
- No automatic CANON. Merge, release, and promotion decisions are governed by AXM's roots — Truth, Agency/non-domination, Continuity, and Wisdom before speed — using grounded evidence; no person or model category is constitutional authority. Passing tests are evidence, not permission to silently declare the architecture final.
- Companion history is evidence, not a hidden moral or reputation score. Do not invent `trust` labels when the machine only observed sessions, signals, actions, places, or outcomes.
- Relationship-specific cooperative/communication outcomes must remain attached to the observed peer unless evidence supports broader transfer. Do not silently generalize one companion's history to strangers.
- Memory must remain revisable. Do not freeze the first supported or contradicted observation into permanent belief when later receipts disagree.
- Continuity must not become compulsion. A fulfilled or invalidated intention remains history but must stop influencing arbitration unless a new lifecycle is explicitly adopted.
- Broad relationship familiarity is context, not proof of a specific claim.
- For a claim-dependent action: unverified exact claim -> verify first; supported exact claim -> broader context may participate; contradicted exact claim -> exact evidence blocks broad relationship/communication priors for that claim.
- Preserve lifetime evidence and recent specific evidence as separate timescales. Recent consistent receipts may revise current stance without deleting historical counts.
- RTS equality means equal external effective-action bandwidth, not fake strict alternation. A player that still owns budget may keep legal command opportunities while another player is exhausted or yielded.
- RTS command cost is based on independently retasked groups/effects, not API packet count. Do not allow a giant payload to masquerade as one APM action.
- What Floorborn does and what the world/another player visibly does to Floorborn are distinct causal channels. Do not rewrite incoming consequences as self-caused action receipts.
- Present-state relevance and retained history are distinct. A current state may make an affordance relevant without dictating the choice; retained history may then change how that affordance competes.
- Experimental perspectives that would alter a frozen baseline must be explicit and opt-in. Do not silently rewrite old evidence when adding a new perspective.
- Recovery is a lifecycle/state, not merely a one-step action. If future work adds persistent recovery state, it must be explicit, group-specific, bounded, inspectable, and deterministically retired or invalidated. Never hide it as an unexplained cooldown or permanent defensive bias.

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

Evidence:
- `evidence/V09_SHARED_RTS_GATE.md`
- `evidence/LIVE_SHARED_RTS_SESSION_001.md`

### v0.10 contested RTS baseline
Must remain passing and behaviorally frozen when new experimental perspectives are disabled:
1. same 24-effective-APM boundary and independent budgets;
2. player-specific fog and deterministic line-of-sight;
3. deterministic integrity, fortification, damage, destruction, retreat affordance, and center-control scoring;
4. no hardcoded aggressive/defensive personality;
5. exact combat/control replay;
6. original measured Floorborn baseline remains available: 3 attacks, 1 fortify, 0 retreats, 2 moves, 1 scout, 1 yield; both own combat groups destroyed; 1-1 draw;
7. failed fog run #216 remains evidence that equal APM is not strict alternation.

Named proof:

```bash
npm run contested-rts
```

Evidence: `evidence/V10_CONTESTED_RTS_GATE.md`.

### v0.11 visible incoming consequence intake
Must remain passing:
1. opponent/world-caused visible consequences are a causal channel distinct from Floorborn's own action receipts;
2. incoming events appear only in the affected player's bounded observation;
3. host-only doctrine never enters the consequence event;
4. event keys deduplicate repeated reads;
5. retained incoming consequence records survive Floorborn snapshot/restore;
6. incoming negative combat evidence can alter the score of the same later legal combat action;
7. no fear/pain/anger/trust or other unsupported subjective label is inferred;
8. exact consequence-world replay uses stable semantic serialization;
9. first replay red remains evidence that key insertion order is not causal state.

Named proof:

```bash
npm run consequence
```

Evidence: `evidence/V11_VISIBLE_CONSEQUENCE_GATE.md`.

### v0.12 critical-state recovery perspective
Must remain passing:
1. `criticalRecovery` is explicit and opt-in; historical/default Floorborn keeps it off;
2. v0.10 baseline remains unchanged when off;
3. when on, a legal recovery action affecting an own center combat group at visible integrity 1 receives `critical-state-recovery:<group>=+3`;
4. present critical state alone makes recovery competitive but does not force retreat;
5. one real retained incoming damage event can tip the same later critical state from attack to retreat;
6. the perspective configuration and incoming consequence memory survive snapshot/restore;
7. no permanent defensive personality is created;
8. exact world replay remains passing.

Named proof:

```bash
npm run recovery
```

Evidence: `evidence/V12_RECOVERY_PERSPECTIVE_GATE.md`.

### v0.13 integrated contested adaptation
Must remain passing:
1. same deterministic pressure peer and contested rules as the frozen v0.10 baseline;
2. adapted player uses `ConsequenceContestedRtsSession`, visible-consequence intake before each Floorborn decision, and opt-in `criticalRecovery`;
3. v0.10 baseline remains 0 retreats;
4. adapted full-fight action history differs causally from baseline;
5. adapted run produces at least one legal recovery action from the earned v0.11/v0.12 interaction;
6. exact adapted combat replay passes;
7. strategic improvement is not required and must not be silently claimed;
8. measured v0.13 result is preserved: one retreat, then immediate re-entry of the same beta army, both own combat groups still destroyed, own control still 1, opponent control rises to 2, result worsens from draw to loss;
9. all four incoming combat consequences remain inspectable in adapted memory;
10. this negative result remains evidence that a recovery action is not yet a recovery lifecycle.

Named proof:

```bash
npm run adapted-contest
```

Evidence: `evidence/V13_INTEGRATED_CONTEST_ADAPTATION_GATE.md`.

## Current depth after v0.13: recovery lifecycle
Do not enlarge the RTS and do not simply increase retreat weight.

### v0.14 target: bounded group-specific recovery lifecycle
The v0.13 seam is:

```text
retreat army-beta to base
-> next ordinary positioning opportunity
-> move the same damaged beta immediately back to center
```

Test an explicit short-horizon recovery state rather than a stronger retreat rule.

Hard constraints:
1. recovery lifecycle is an explicit experimental capability/perspective and defaults off;
2. v0.10 baseline remains frozen when off;
3. v0.12 same-state A/B result remains frozen;
4. a retreat caused by the recovery path may create an inspectable pending recovery record tied to the affected group;
5. the record must include session/turn/window provenance and source action/outcome;
6. while pending in the same bounded action window, immediate center re-entry by that same group may receive temporary negative relevance;
7. recovery state must not penalize unrelated groups;
8. recovery state must retire deterministically at a clear boundary, preferably completion of the action window for this first test;
9. destroyed/missing/incompatible group state must invalidate the lifecycle rather than leave a ghost record;
10. if the player overrides recovery anyway, the override must be recorded/retired rather than silently keeping a stale state;
11. lifecycle history remains inspectable after retirement but stops influencing arbitration;
12. snapshot/restore must preserve pending and retired recovery records exactly;
13. exact combat/world replay must remain passing;
14. compare against v0.13: immediate retreat->re-entry should change, but winning/preserving units is not required;
15. do not hide this as a game-engine cooldown. The state belongs to the Floorborn player lineage and must be visible in its inspectable memory.

Do not optimize for winning. The research target is what kind of player a machine-floor architecture becomes when player-visible consequences, current state, retained history, and short-lived self-selected recovery state interact under the same external world rules as other players.

---

# Shared AXM capability guidance

## Detail-density and composable capability principle

Quality is often the accumulated result of many small correct details, not one large generic upgrade.

- When improving a system, look for missing small, bounded capabilities, checks, parameters, passes, and repair operations that control specific details or failure modes.
- Prefer many reusable, inspectable, composable capabilities over one opaque "make it better" step when the smaller capabilities create real control or evidence.
- A machine should remain useful without AI: humans, explicit state, recipes, or deterministic logic can invoke the same capabilities directly.
- With AI, the model is primarily an interpretation and orchestration layer: it translates a higher-level goal into selections and combinations of the same underlying capabilities. The AI does not own those capabilities.
- A better reasoning model may improve goal interpretation and composition, while the underlying machine remains portable and usable without that model.
- Judge improvement by accumulated perceptual or functional detail, coherence, failure reduction, and fit to the goal—not by model size, resolution, benchmark score, or one broad upgrade alone.
- For visual, game, asset, animation, and video work, pay attention to small interacting details such as material variation, contact, timing, weight, secondary motion, lighting response, sound layering, asymmetry, wear, scale cues, camera behavior, and continuity.
- Do not fragment working systems merely for ideology. Add granularity where it creates useful control, reuse, diagnosis, repair, or quality.

**Working rule:** thousands of small good details and capabilities in the right places can improve a result more than one simple big upgrade.

## Canonical state and adaptive realization principle

When useful, separate **what exists** from **how it is expressed on a particular machine**.

- Canonical state/identity is authoritative. Rendering, UI, meshes, previews, audio paths, device skins, caches, and other realizations are replaceable expressions unless the repository explicitly defines otherwise.
- Preserve expression intent separately where needed: meaning, material character, motion weight, readability, atmosphere, hierarchy, sound intent, semantic detail, and other qualities that should survive changes in rendering cost.
- Prefer one truthful body with multiple realization contracts over manually divergent `mobile`, `lite`, `desktop`, `ultra`, or platform editions when the same canonical state can support them.
- Choose realization from canonical state + expression intent + measured machine capabilities + user policy. Adaptation may occur at launch or dynamically as GPU/CPU/RAM, battery, thermals, display, latency, storage, network, or user preference changes.
- A weak device should usually receive a cheaper expression, **not weaker truth**. Logical/world/design detail may remain rich even when the visible or audible realization is simplified.
- Identify non-degradable invariants explicitly. Examples include rules, fairness, hit detection, data integrity, core functionality, privacy promises, causal meaning, timing meaning, content identity, and authoritative state.
- Never let a lossy realization overwrite richer canonical state merely because that realization was rendered or edited on a weaker device. A projection/cache is not authority.
- Upgrading expression must not invent canonical facts. Downgrading expression must not erase canonical facts.
- Build bounded alternative realization paths where they add value: geometry detail, texture resolution, lighting, particles, simulation passes, post-processing, UI density, preview fidelity, audio richness, or analogous domain-specific expression layers.
- Do not force this split where representation itself is the canonical truth; apply it where truth and realization can honestly be separated.

**Working rule:** degrade expression, never truth; upgrade expression, never invent truth. One body may wake up differently on different machines while remaining the same thing.
