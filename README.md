# AXM Floorborn

**Research question:** can the machine floor itself become a real player?

Floorborn is an AXM experiment in giving a deterministic machine-floor architecture a bounded player slot in a game, rather than wrapping a conventional neural game-playing agent around it.

The first proof is intentionally tiny: a deterministic RPG laboratory where Floorborn can observe only player-visible state, choose only legal actions, receive replayable outcomes, retain its own explicit memory, and let earlier game experience change a later choice.

## Root principle

> **Different outside. Equal inside. Choice and action define the player.**

Humans, neural models, Floorborn, and future player architectures may think in radically different ways. The game enforces equality at the interaction boundary: visibility, legal actions, consequences, and genre-specific action/APM/deadline limits.

## v0.1 proof

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

No neural model is used in the v0.1 chooser.

### Run it

Requires Node.js 20+ and no external packages.

```bash
npm test
npm run demo
```

Expected first-proof behavior:

- a fresh Floorborn player chooses the forest at an otherwise equal crossroads;
- a Floorborn player that previously discovered and collected a useful cache in ancient ruins later chooses the ruins;
- the decision trace exposes the learned `ancient` / `structure` evidence;
- the earlier game session replays from receipts to exactly the same public state.

This is not evidence of consciousness or subjective experience. Here, **experience** means a retained causal history of observations, actions, outcomes, and measurable later behavioral effects.

## v0.2 live co-op proof

Floorborn can now share one deterministic RPG world with an **external chat player** through the same `axm.player.v0.1` observation/action protocol. The chat bridge is intentionally narrow: it exposes only the current player's observation and accepts exactly one offered legal action id.

The first co-op quest is the Twinseal Gate:

- Floorborn and the chat begin at the same crossroads;
- each can independently move, inspect, gather, wait, and signal through ordinary player actions;
- a sun shard and moon shard each exist only once in the shared world;
- the players may split up and recover different shards;
- both must reunite at the Twinseal Gate;
- the gate opens only when both players and both shards are present;
- the complete shared session is receipt-backed and exactly replayable.

### Play from a working chat

Create a resumable live session:

```bash
npm run live -- new ./floorborn-chat.json
```

The bridge prints only the chat player's visible observation plus legal action ids. Choose one and commit it:

```bash
npm run live -- act ./floorborn-chat.json move:ruins
```

Each chat action advances the world, lets Floorborn take its next deterministic turn, persists both histories, and returns the next bounded chat observation. Resume at any time with:

```bash
npm run live -- show ./floorborn-chat.json
```

The bridge does not call a model API. The external model is the working chat itself. That keeps the experiment architecture-neutral: ChatGPT, another neural model, a human-operated shell, or another future player can occupy `chat-001` without changing the game.

## Repo boundary

`axm-floor-born` owns the machine-as-player experiment: player protocol, Floorborn identity/memory, game adapters, experiments, and evidence.

Machine-state discoveries that generalize beyond play can flow back into `axm-state-research`. The two projects should inform each other without collapsing into one repo.

See [`AGENTS.md`](AGENTS.md) for lane rules and hard constraints, and [`docs/FOUNDATION.md`](docs/FOUNDATION.md) for the research foundation.
