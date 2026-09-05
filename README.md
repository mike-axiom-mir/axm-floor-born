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

## Repo boundary

`axm-floor-born` owns the machine-as-player experiment: player protocol, Floorborn identity/memory, game adapters, experiments, and evidence.

Machine-state discoveries that generalize beyond play can flow back into `axm-state-research`. The two projects should inform each other without collapsing into one repo.

See [`AGENTS.md`](AGENTS.md) for lane rules and hard constraints, and [`docs/FOUNDATION.md`](docs/FOUNDATION.md) for the research foundation.
