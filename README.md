# AXM Floorborn

**Research question:** can the machine floor itself become a real player?

Floorborn is an AXM experiment in giving a deterministic machine-floor architecture a bounded player slot in a game, rather than wrapping a conventional neural game-playing agent around it.

The project deliberately separates four claims:

1. **v0.1:** Floorborn can occupy a bounded player slot and let retained experience change a later legal choice.
2. **v0.2:** Floorborn and an external working chat can independently cooperate inside one shared replayable RPG world.
3. **v0.3:** Floorborn can handle a hidden-layout expedition without a fixed action script, respond to changing world state, and carry learned preferences into later sessions.
4. **v0.4:** the same Floorborn lineage can preserve companion-specific continuity, recover from a bad hidden outcome without resetting, and let earlier optional experience change a later non-required intent.

At v0.4, Floorborn meets this repo's definition of a **bounded operational player with inspectable continuity inside the RPG laboratory**. That is not a claim of consciousness, personhood, human-like understanding, or general game-playing intelligence.

## Root principle

> **Different outside. Equal inside. Choice and action define the player.**

Humans, neural models, Floorborn, and future player architectures may think in radically different ways. The game enforces equality at the interaction boundary: visibility, legal actions, consequences, and genre-specific action/APM/deadline limits.

## v0.1 bounded player proof

```text
bounded observation
      |
      v
Floorborn perspective nodes
      |
 deterministic arbitration
      |
      v
one legal player action
      |
      v
   game outcome
      |
      v
receipt + persistent experience
      |
      +----> later decision can change
```

No neural model is used in the Floorborn chooser.

Expected first-proof behavior:

- a fresh Floorborn player chooses the forest at an otherwise equal crossroads;
- a Floorborn player that previously discovered and collected a useful cache in ancient ruins later chooses the ruins;
- the decision trace exposes the learned `ancient` / `structure` evidence;
- the earlier game session replays from receipts to exactly the same public state.

## v0.2 live co-op proof

Floorborn can share one deterministic RPG world with an **external chat player** through the same `axm.player.v0.1` observation/action protocol. The chat bridge is intentionally narrow: it exposes only the current player's observation and accepts exactly one offered legal action id.

The first co-op quest is the Twinseal Gate. Floorborn and the chat can independently move, inspect, gather, wait, and signal through ordinary player actions. Each shard exists only once in the shared world, both players must reunite, and the complete session is receipt-backed and exactly replayable.

### Play the Twinseal proof from a working chat

```bash
npm run live -- new ./floorborn-chat.json
npm run live -- act ./floorborn-chat.json move:ruins
npm run live -- show ./floorborn-chat.json
```

The bridge does not call a model API. The external model is the working chat itself. That keeps the experiment architecture-neutral.

## v0.3 hidden expedition player gate

The expedition lab removes the single known quest path. Four regions contain a seed-dependent hidden arrangement of:

- two required resonance seals;
- one optional memory relic;
- one trap.

Floorborn receives only visible region tags and legal actions. Item identity and danger remain hidden until inspection. It must explore, learn outcomes, choose where to spend actions, recover two seals, and decide when the goal state justifies going to the gate.

The gate verifies that Floorborn completes 16 hidden-layout seeds within a bounded turn budget, different layouts produce different action histories, runs replay exactly, bad prior experience can change a later route, another player's actions can disturb shared state without breaking Floorborn into a fixed script, and explicit goal relevance can outrank an unrelated learned surface aversion when appropriate.

### Blind live expedition with a working chat

```bash
npm run live-expedition -- new ./floorborn-expedition.json
npm run live-expedition -- act ./floorborn-expedition.json move:grove
npm run live-expedition -- show ./floorborn-expedition.json
npm run live-expedition -- verify ./floorborn-expedition.json
```

The raw host snapshot contains engine state needed for resumption and replay and is therefore **not** a player input. A future process/network adapter should structurally isolate that host state from the player instead of relying on the caller not to inspect it.

The first blind run is preserved at [`evidence/LIVE_EXPEDITION_SESSION_001.md`](evidence/LIVE_EXPEDITION_SESSION_001.md). The v0.3 gate summary is preserved at [`evidence/V03_PLAYER_GATE.md`](evidence/V03_PLAYER_GATE.md).

## v0.4 player continuity gate

v0.4 asks a different question: once Floorborn can play, **does its own history remain meaningfully attached to the player lineage?**

### Companion-specific continuity

Floorborn now keeps explicit observations about named companions across sessions. This is not a hidden `trust` or reputation score. The stored evidence is concrete: observed turns, shared sessions, signals seen, place sightings, inventory sightings, and cooperative outcomes that Floorborn actually experienced while that peer was present.

Relationship-specific cooperative/communication outcomes stay attached to the observed companion rather than becoming a universal claim about strangers.

In the named v0.4 proof, after a real shared expedition with `chat-001`, a later neutral campfire choice produces:

```text
remembered chat-001 -> signal:continue-with-peer
new chat-new        -> signal:finish-journey
```

The reunion decision exposes the contributing evidence instead of hiding it inside a weight:

```text
companion:chat-001=+1.8
companion-outcome:chat-001=+0.729
```

### Optional self-selected intent

The post-adventure interlude gives fresh and experienced Floorborn lineages the **same legal action menu**. A fresh lineage chooses to finish the journey. A lineage that previously discovered and legally gathered a memory relic instead chooses the optional `seek-relic` intent.

```text
fresh       -> signal:finish-journey
relic-lived -> signal:seek-relic
```

The experienced choice is traceable to retained `relic` evidence plus optional curiosity. This is deliberately a small result. It does not prove open-ended goal invention. It proves a non-required future intent can be selected because of retained game history rather than because the current quest demands it.

### Mistake and recovery

On a deterministic hidden layout, Floorborn initially chooses the Glass Archive and discovers a trap. It does not reset or receive a scripted correction. The negative experience remains in memory, Floorborn returns to camp, chooses the Grove instead, and still completes the same expedition with exact replay.

This matters because a player that can only succeed on clean paths is much less interesting than one that can accumulate consequences and continue.

### Named v0.4 proof

Requires Node.js 24+ and no external packages.

```bash
npm test
npm run demo
npm run expedition
npm run continuity
```

The verified v0.4 PR head reports **33 tests passed, 0 failed**, and the named continuity harness reports PASS for companion continuity, optional intent, mistake recovery, and exact replay.

The full v0.4 evidence record, including a useful failed experiment and its repaired comparison boundary, is preserved at [`evidence/V04_CONTINUITY_GATE.md`](evidence/V04_CONTINUITY_GATE.md).

## What "experience" means here

This is not evidence of consciousness or subjective experience. Here, **experience** means retained causal history: observations, chosen actions, outcomes, repeated patterns, companion-specific evidence, and measurable later behavioral effects.

The stronger question is not whether Floorborn can imitate a human. It is whether a machine-floor architecture can become a persistent game participant with its own inspectable history and increasingly nontrivial behavior.

## Repo boundary

`axm-floor-born` owns the machine-as-player experiment: player protocol, Floorborn identity/memory, game adapters, experiments, and evidence.

Machine-state discoveries that generalize beyond play can flow back into `axm-state-research`. The two projects should inform each other without collapsing into one repo.

See [`AGENTS.md`](AGENTS.md) for lane rules and hard constraints, [`docs/FOUNDATION.md`](docs/FOUNDATION.md) for the research foundation, and `evidence/` for replay-backed experiment records.
