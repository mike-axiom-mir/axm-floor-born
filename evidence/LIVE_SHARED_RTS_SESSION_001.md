# Live shared RTS session 001

Status: **PASS**

This evidence records the first shared RTS session in which deterministic `floorborn-001` and a working neural chat occupied separate RTS player slots under the same bounded external action rules.

Session id: `live-shared-rts-session-001`

## Boundary used during play

The working chat choices were selected from the bounded `axm.player.rts.v0.1` observation surface. The chat-facing view exposed:

- its own groups/resources/objective progress;
- current independent effective-action budget;
- the shared window index and effective APM limit;
- only currently visible enemy contacts;
- the exact legal command list and deterministic command costs.

The chat-facing view did **not** expose host-only hidden doctrine or other engine-only truth.

Floorborn occupied its own player slot and chose commands independently through the same RTS player protocol. The chat did not control Floorborn.

## Equality boundary

The live lab used:

```text
window length: 5 seconds
effective actions per player per window: 2
effective APM limit per player: 24
```

Budgets were independent. Spending an action did not consume the other player's budget.

Equal APM did not mean fake strict alternation. If one player exhausted its own budget while the other still had agency left in the current window, the other player could retain another legal command opportunity.

## Working-chat choices

The chat deliberately did not take the shortest objective path.

Its choices were:

```text
1. command:move:army-alpha:center
2. command:scout:center
3. command:build:power-node
```

Each choice was asserted to be present in the current bounded legal-action list before being committed.

## Lived transcript

```text
window 0
turn 0  Floorborn -> command:build:power-node       cost 1   budget 2 -> 1
turn 1  Chat      -> command:move:army-alpha:center cost 1   budget 2 -> 1
turn 2  Floorborn -> command:scout:center           cost 1   budget 1 -> 0
turn 3  Chat      -> command:scout:center           cost 1   budget 1 -> 0

window 1
turn 4  Chat      -> command:build:power-node       cost 1   budget 2 -> 1
```

The window boundary occurred after both players had spent their window-0 agency. Both budgets then replenished deterministically.

## Cross-player world interaction

The chat moved `army-alpha` to center before Floorborn's second command.

Floorborn then independently selected `command:scout:center` through its own decision arbitration. The resulting shared-world observation path occurred after the chat-created center movement.

This is a bounded interaction claim only. It does not claim that Floorborn inferred a human-like tactical meaning from the chat movement. It establishes that one player's ordinary legal world mutation existed before, and could be exposed by, the other player's later legal information-gathering action.

## Agency allocation

Total effective actions spent before shared objective completion:

```text
Floorborn: 2
Chat:      3
```

Floorborn spent its two actions on the objective:

```text
build power node
scout center
```

The chat spent one extra action on army positioning before completing its own objective.

Same cap, different action allocation.

## Final public state

Both players completed the same bounded objective:

- each built one power node;
- each scouted center;
- chat `army-alpha` remained at center;
- Floorborn combat armies remained at base;
- the session completed at turn 5 in window 1.

## Replay

The exact shared command receipts were replayed from a fresh `SharedRtsSession`.

The replayed final public state matched the completed live final state exactly: **LIVE SHARED RTS REPLAY PASS**.

## Remote verification

GitHub Actions `floorborn-rts-transfer` run **#26** completed successfully on Node 24. The same run also passed the v0.8 solo RTS gate, v0.9 shared-player gate, all shared/live RTS tests, and this live working-chat session.

The general `floorborn-proof` workflow on the exact same commit also completed successfully, preserving the earlier RPG/campaign player gates.

## Claim boundary

This supports the narrower claim that a working neural chat and deterministic Floorborn can occupy separate player slots in one shared deterministic RTS-style world, operate under the same effective-APM rules, spend separate agency budgets on independently selected legal commands, affect one shared world, and replay that session exactly.

It does not establish strong RTS competence, production-scale real-time play, consciousness, or superiority over another player architecture.
