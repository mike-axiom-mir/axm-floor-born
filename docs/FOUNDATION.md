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

The initial implementation keeps explicit inspectable memory:

1. **Session history**: what happened in the current run.
2. **Episodes**: notable action/outcome records retained across sessions.
3. **Patterns**: repeated or salient relationships between visible affordance tags and outcomes.
4. **Growth candidates**: future work; validated patterns may eventually propose new deterministic perspectives, but v0.1 does not self-modify code.

## Why games

Games are bounded worlds with explicit rules, reversible experiments, repeatable seeds, and consequences that remain inside the simulation. They let us expose a machine-floor architecture to roles it normally never occupies: explorer, collaborator, strategist, opponent, builder, or party member.

Across genres, the same Floorborn lineage may encounter different state families. RPGs stress exploration, cooperation, and memory. RTS games stress resource allocation and bounded action budgets. Puzzle games stress contradiction and hypothesis. Survival games stress scarcity and long-horizon consequence.

The important comparison is not only score. It is what each architecture notices, remembers, and chooses to spend its limited agency on.

## Cross-architecture future

A later flagship experiment can put independent player types in the same RPG party:

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
