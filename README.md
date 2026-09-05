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
A seed-dependent world hides required resources, optional discovery, and danger. Floorborn must discover them through ordinary play. It completes multiple unseen layouts without a fixed action script, changes routes as experience changes, absorbs another player's world-state changes, and remains exactly replayable.

Evidence: [`evidence/LIVE_EXPEDITION_SESSION_001.md`](evidence/LIVE_EXPEDITION_SESSION_001.md), [`evidence/V03_PLAYER_GATE.md`](evidence/V03_PLAYER_GATE.md).

### v0.4 — player continuity
The same lineage can retain explicit companion-specific history, distinguish a recurring companion from a stranger in a later neutral choice, select a non-required future intent because of earlier optional experience, and recover from a hidden negative outcome without resetting.

Named proof:

```bash
npm run continuity
```

Evidence: [`evidence/V04_CONTINUITY_GATE.md`](evidence/V04_CONTINUITY_GATE.md).

### v0.5 — revisable evidence
Floorborn can retain companion-and-signal-specific support/contradiction receipts and revise its later action in both directions as newer evidence disagrees or agrees. Evidence does not leak to a stranger or unrelated signal.

Named proof:

```bash
npm run revision
```

Evidence: [`evidence/V05_REVISION_GATE.md`](evidence/V05_REVISION_GATE.md).

### v0.6 — intention lifecycle
A self-selected optional intention can become explicit pending lineage state, survive unrelated later play and snapshot/restore, influence a matching future legal opportunity, and then retire as fulfilled or invalidated.

A retired intention remains inspectable history but does not become an immortal command. If the same intent is later adopted again, it receives a new sequence record.

Named proof:

```bash
npm run intention
```

Evidence: [`evidence/V06_INTENTION_GATE.md`](evidence/V06_INTENTION_GATE.md).

### v0.7 — multi-session campaign
v0.7 combines the previously isolated mechanisms in one continuous lineage instead of testing them separately.

The campaign includes:

- a completed hidden expedition with recurring companion `chat-001`;
- later reunion choice and separate stranger `chat-new`;
- a hidden adversarial trap selected by the host without exposing hidden contents to Floorborn;
- autonomous recovery without reset;
- exact companion+signal support, later contradictions, and revised action;
- a familiar companion making a brand-new signal claim that remains unverified until evidence exists;
- lifetime signal history plus bounded recent verdict history so new consistent evidence can revise a historically sticky stance without deleting the past;
- optional relic experience producing a later optional intention;
- unrelated intervening session;
- exact player + campaign-ledger snapshot/restore;
- later matching opportunity and intention fulfillment;
- final closure after the retired intention stops influencing arbitration.

The deterministic campaign ledger closes with:

```text
17 checkpoints
8 forward causal links
25 completed Floorborn sessions
2 companion identities
1 retired intention lifecycle
0 active intentions at closure
final choice: signal:finish-journey
```

Named proof:

```bash
npm run campaign
```

Evidence: [`evidence/V07_CAMPAIGN_GATE.md`](evidence/V07_CAMPAIGN_GATE.md).

## Evidence hierarchy learned from the campaign

The integrated campaign exposed state collisions that isolated tests missed. The current hierarchy is:

```text
unverified exact companion claim
    -> verify first

supported exact claim
    -> specific evidence + broader companion context may participate

contradicted exact claim
    -> exact evidence blocks broad relationship/communication priors
       for that claim-dependent action
```

Broad familiarity remains useful for neutral coordination choices. It is not proof that a specific new claim is true.

Floorborn also keeps two explicit evidence timescales for exact companion+signal relationships:

- lifetime support/contradiction totals remain historical truth;
- a bounded recent verdict window can revise current stance after a consistent run of newer evidence.

Neither layer silently deletes the other.

## Current verification

Requires Node.js 24+ and no external packages.

```bash
npm test
npm run demo
npm run expedition
npm run continuity
npm run revision
npm run intention
npm run campaign
```

The verified v0.7.0 PR head passes **52 tests** plus every named gate through the multi-session campaign.

## What "experience" means here

This project does not claim consciousness or subjective experience. **Experience** means retained causal history: observations, actions, outcomes, repeated patterns, companion-specific evidence, revisable signal evidence, explicit intentions, and measurable later behavioral effects.

At v0.7, Floorborn meets this repo's narrower definition of a **bounded operational player with inspectable continuity across a multi-session RPG campaign**. It is not a claim of human-like understanding or general game-playing intelligence.

## Next research depth: first genre transfer

The next gate moves the same neutral player boundary into a minimal RTS laboratory.

The RTS experiment must preserve:

- equal visible state/fog-of-war for equivalent roles;
- equal legal command vocabulary;
- unrestricted internal reasoning method;
- equal effective APM/action bandwidth;
- deterministic effective cost for commands;
- no giant command payload that secretly bypasses APM;
- rejection of over-budget commands before world mutation;
- full command receipts and exact replay;
- measurements of **what each player spends scarce agency on**, not merely who wins.

## Repo boundary

`axm-floor-born` owns the machine-as-player experiment: player protocol, Floorborn identity/memory, game adapters, experiments, and evidence. General machine-state discoveries may flow to `axm-state-research` without collapsing the two projects into one.

See [`AGENTS.md`](AGENTS.md) for lane rules and preserved gates, [`docs/FOUNDATION.md`](docs/FOUNDATION.md) for the research foundation, and `evidence/` for replay-backed records.
