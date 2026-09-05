# Floorborn foundation

## Thesis
A computer normally executes a game while another actor plays it. Floorborn tests a different arrangement: a deterministic machine-floor architecture also receives a bounded player slot in the world it is running.

This repo does not assume that a machine has subjective experience. It tests something measurable: whether a machine-floor player can accumulate an independent causal history and whether that retained history changes later action selection.

## Equality boundary

**Different outside. Equal inside. Choice and action define the player.**

Humans, neural models, Floorborn, and future AXM player architectures do not need equal internal capabilities. Equality is enforced at the world boundary:

- same game rules;
- same legal action vocabulary for equivalent player roles;
- same visibility/fog-of-war rules;
- same consequences for committed actions;
- same action/APM/deadline limits where the genre requires them;
- no architecture receives hidden engine state merely because it is machine-native.

An RTS may allow any player unlimited internal reasoning while limiting every player to the same effective APM. The scarce resource is external agency, not thought.

## Operational player definition

For this research repo, calling Floorborn an **operational player** requires all of the following in a bounded game:

1. it has a persistent player identity distinct from the game engine;
2. it receives only player-facing observations;
3. it can commit only legal player actions;
4. its action selection is independent of a human or neural model choosing on its behalf;
5. actions produce ordinary world consequences shared with other players;
6. its own retained history can causally affect later choices;
7. decision evidence remains inspectable;
8. sessions can be replayed from receipts;
9. changing world state can change its path rather than requiring a fixed script.

This definition is deliberately narrower than intelligence, personhood, consciousness, or general game-playing competence.

## First architecture

```text
GAME WORLD
    |
    v
bounded observation
    |
    v
FLOORBORN PLAYER
  perspective nodes
  deterministic arbitration
  retained experience
    |
    v
one legal action
    |
    v
GAME WORLD
    |
    v
receipt: before -> choice -> outcome -> after
```

## Experience layers

The current implementation keeps explicit inspectable memory:

1. **Session history**: what happened in the current run.
2. **Episodes**: notable action/outcome records retained across sessions.
3. **Patterns**: repeated or salient relationships between visible affordance tags and outcomes.
4. **Recent-action pressure**: bounded anti-loop evidence that discourages repeatedly selecting the same action without deleting long-term memory.
5. **Goal relevance**: an explicit state signal that can outrank a learned surface association when the world exposes that an action now advances the active objective.
6. **Growth candidates**: future work; validated patterns may eventually propose new deterministic perspectives, but v0.3 does not self-modify code.

## Why games

Games are bounded worlds with explicit rules, reversible experiments, repeatable seeds, and consequences that remain inside the simulation. They let us expose a machine-floor architecture to roles it normally never occupies: explorer, collaborator, strategist, opponent, builder, or party member.

Across genres, the same Floorborn lineage may encounter different state families. RPGs stress exploration, cooperation, and memory. RTS games stress resource allocation and bounded action budgets. Puzzle games stress contradiction and hypothesis. Survival games stress scarcity and long-horizon consequence.

The important comparison is not only score. It is what each architecture notices, remembers, and chooses to spend its limited agency on.

## Current evidence ladder

### v0.1
Floorborn occupied a bounded solo RPG player slot and retained experience changed a later legal choice.

### v0.2
Floorborn and a working neural chat independently cooperated in one shared RPG world through the same player protocol.

### v0.3
Floorborn completed multiple seed-dependent hidden-layout expeditions without a fixed action sequence, changed later route selection after prior experience, continued after a second player's world-state changes, and completed a blind live expedition with a working chat. The live run preserved full receipts and exact replay.

## Cross-architecture future

Independent player types can share one neutral game boundary:

```text
Human       Neural model       Floorborn       other AXM player
   \             |                 |                 /
    +------------+-----------------+----------------+
                         |
                  PLAYER PROTOCOL
                         |
                     SAME WORLD
```

They may cooperate rather than compete. Each keeps its own history. The game remains neutral about how each player produces a decision.

The next depth target is not another genre yet. First deepen the RPG player: optional goals, richer communication, mistakes and recovery, companion memory across sessions, longer horizons, and stronger blind/adversarial runs.
