# AXM Floorborn

**Research question:** can the machine floor itself become a real player?

Floorborn is an AXM experiment in giving a deterministic machine-floor architecture a bounded player slot in a game, rather than wrapping a conventional neural game-playing agent around it.

The project deliberately separates three claims:

1. **v0.1:** Floorborn can occupy a bounded player slot and let retained experience change a later legal choice.
2. **v0.2:** Floorborn and an external working chat can independently cooperate inside one shared replayable RPG world.
3. **v0.3:** Floorborn can handle a broader hidden-layout expedition without a fixed action script, recover from changing world state, and carry learned preferences into later sessions.

At v0.3, Floorborn meets this repo's definition of an **operational player in the bounded RPG laboratory**. That is not a claim of consciousness, personhood, human-like understanding, or general game-playing intelligence.

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

The first co-op quest is the Twinseal Gate:

- Floorborn and the chat begin at the same crossroads;
- each can independently move, inspect, gather, wait, and signal through ordinary player actions;
- a sun shard and moon shard each exist only once in the shared world;
- the players may split up and recover different shards;
- both must reunite at the Twinseal Gate;
- the gate opens only when both players and both shards are present;
- the complete shared session is receipt-backed and exactly replayable.

### Play the Twinseal proof from a working chat

```bash
npm run live -- new ./floorborn-chat.json
npm run live -- act ./floorborn-chat.json move:ruins
npm run live -- show ./floorborn-chat.json
```

The bridge does not call a model API. The external model is the working chat itself. That keeps the experiment architecture-neutral.

## v0.3 real-player expedition gate

The expedition lab removes the single known quest path. Four regions contain a seed-dependent hidden arrangement of:

- two required resonance seals;
- one optional memory relic;
- one trap.

Floorborn receives only visible region tags and legal actions. Item identity and danger remain hidden until inspection. It must explore, learn outcomes, choose where to spend actions, recover two seals, and decide when the goal state justifies going to the gate.

The player gate currently checks that:

- Floorborn completes 16 hidden-layout seeds within a bounded turn budget;
- different hidden layouts produce different action histories;
- every run is receipt-backed and exactly replayable;
- a bad prior experience can change the first route taken in a later world;
- a second player's unexpected actions can change shared world state without breaking Floorborn into a fixed script;
- goal relevance is represented separately from learned surface associations, preventing a bad experience with an `ancient` place from automatically blocking an `ancient` goal location;
- recent-action pressure reduces simple loops without erasing long-term memory.

Requires Node.js 24+ and no external packages.

Run the autonomous gate with:

```bash
npm test
npm run expedition
```

### Blind live expedition with a working chat

Create a resumable expedition. If no seed is supplied, the host chooses one without printing it in the player view:

```bash
npm run live-expedition -- new ./floorborn-expedition.json
```

The command prints only the working chat's bounded observation, legal action ids, and transcript. Commit one legal action:

```bash
npm run live-expedition -- act ./floorborn-expedition.json move:grove
```

Resume later:

```bash
npm run live-expedition -- show ./floorborn-expedition.json
```

After completion, reveal the host record or verify exact replay:

```bash
npm run live-expedition -- reveal ./floorborn-expedition.json
npm run live-expedition -- verify ./floorborn-expedition.json
```

The raw host snapshot contains engine state needed for resumption and replay and is therefore **not** a player input. A future process/network adapter should structurally isolate that host state from the player instead of relying on the caller not to inspect it.

The first blind run is preserved at [`evidence/LIVE_EXPEDITION_SESSION_001.md`](evidence/LIVE_EXPEDITION_SESSION_001.md). In that session the working chat did not receive the seed or hidden layout during play; Floorborn independently explored, gathered a seal, signaled its discovery, moved to the goal-marked Gate, and opened it after the chat deliberately waited.

The v0.3 gate summary is preserved at [`evidence/V03_PLAYER_GATE.md`](evidence/V03_PLAYER_GATE.md).

## What "experience" means here

This is not evidence of consciousness or subjective experience. Here, **experience** means retained causal history: observations, chosen actions, outcomes, repeated patterns, and measurable later behavioral effects.

The stronger question is not whether Floorborn can imitate a human. It is whether a machine-floor architecture can become a persistent game participant with its own inspectable history and increasingly nontrivial behavior.

## Repo boundary

`axm-floor-born` owns the machine-as-player experiment: player protocol, Floorborn identity/memory, game adapters, experiments, and evidence.

Machine-state discoveries that generalize beyond play can flow back into `axm-state-research`. The two projects should inform each other without collapsing into one repo.

See [`AGENTS.md`](AGENTS.md) for lane rules and hard constraints, [`docs/FOUNDATION.md`](docs/FOUNDATION.md) for the research foundation, and `evidence/` for replay-backed experiment records.
