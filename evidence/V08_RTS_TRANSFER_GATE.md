# Floorborn v0.8 RTS action-budget transfer gate

Status: **PASS on PR lane; do not auto-merge**

## Question

Can the same deterministic non-neural Floorborn player substrate transfer out of the RPG laboratory into a minimal RTS-style world where external agency is explicitly scarce, without giving the machine privileged visibility or unlimited command bandwidth?

## Result

Yes, within the bounded v0.8 RTS laboratory.

On the exact current PR head, both GitHub Actions workflows completed successfully on Node 24:

- original `floorborn-proof` pipeline: **61 tests passed, 0 failed**;
- isolated `floorborn-rts-transfer` pipeline: **9 RTS tests passed, 0 failed**;
- named RTS action-budget proof PASS.

Named proof:

```bash
node experiments/rts-proof.js
```

## Protocol boundary

The existing RPG player protocol remains `axm.player.v0.1`.

RTS uses a sibling bounded protocol:

```text
axm.player.rts.v0.1
```

Both are accepted by the same Floorborn decision substrate. The RTS observation exposes only player-visible RTS state and offered legal actions.

Engine-only enemy truth such as hidden doctrine, reserve squad, hidden base state, and hidden enemy resources is not present in the player observation.

Equivalent player identities receive the same:

- visible RTS state;
- legal command vocabulary;
- action-window duration;
- effective action budget;
- effective APM limit.

The experiment does **not** attempt to equalize internal reasoning speed or architecture.

## Effective APM boundary

The first RTS lab uses:

```text
window length: 5 seconds
max effective actions per window: 2
effective APM limit: 24
```

The scarce resource is external agency, not thought.

## Anti-cheese command cost

A command's effective action cost is derived from the number of independently retasked groups, not from the number of API objects sent.

Example:

```text
command:move:army-pair:hill
affected groups:
  - army-alpha
  - army-beta
computed effective cost: 2
```

Declaring that same two-group command as cost `1` is rejected before world mutation.

A previously legal two-cost command also becomes invalid when only one budget point remains. The over-budget submission is rejected before either army moves.

This prevents a machine player from hiding hundreds of individual retasks inside one command packet and calling it one APM action.

## Deterministic budget replenishment

When the current action window is deliberately advanced:

- the window index increments deterministically;
- the effective-action budget resets to the same fixed maximum;
- deterministic resource income is applied;
- the complete budget/state transition is receipt-backed and exactly replayable.

## First Floorborn RTS allocation

At the first RTS observation, Floorborn has more legal commands available than it can afford inside one action window.

Required objective:

```text
build one power node
scout north ridge
```

Other legal commands include optional scouting and army positioning.

Floorborn independently selects:

```text
1. command:build:power-node
   effective cost 1
   budget 2 -> 1

2. command:scout:north
   effective cost 1
   budget 1 -> 0
```

It does **not** spend the first-window budget on:

```text
command:scout:south
command:move:army-alpha:hill
command:move:army-pair:hill
```

The proof objective completes in window `0` with exactly two effective actions spent and zero budget remaining.

The complete RTS command receipt sequence replays to the same final public state: **PASS**.

## What this proves

v0.8 supports this narrower statement:

> The deterministic Floorborn player substrate can operate through a bounded RTS-style player protocol, choose among more legal commands than its current action budget allows, obey an architecture-neutral effective-APM limit, and produce exactly replayable command/budget receipts without receiving hidden enemy engine state.

## What this does not prove

It does not prove that Floorborn is a strong RTS player, can beat a human or neural model, can handle a production-scale real-time game, or has general strategy intelligence.

The first transfer deliberately tests **bounded agency and genre compatibility**, not winning.

## Next depth

The next RTS gate should create two real player slots in one tiny deterministic RTS world under the same effective-APM meter.

That shared-RTS gate should verify:

1. both player slots receive equivalent fog-of-war and budget rules;
2. neither player can consume the other player's action budget;
3. command costs are architecture-neutral;
4. world-state changes by one player alter what the other later observes;
5. both players can take independent legal command sequences;
6. receipts identify which player spent which effective actions;
7. exact shared-world replay remains possible;
8. a working chat can later occupy the second slot without receiving architecture-specific privileges.
