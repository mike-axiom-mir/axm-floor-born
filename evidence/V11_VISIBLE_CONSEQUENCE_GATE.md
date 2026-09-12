# Floorborn v0.11 visible consequence intake

Status: **PASS on PR lane; do not auto-merge**

## Question

Can a consequence caused by another player become part of Floorborn's own inspectable game history when that consequence is legitimately visible to the player, without routing hidden engine truth through the learning path and without pretending the consequence is one of Floorborn's own actions?

## Result

Yes, within the bounded contested RTS laboratory.

The exact v0.11 head passed both remote pipelines on Node 24:

- `floorborn-proof`: PASS;
- `floorborn-rts-transfer`: PASS;
- isolated RTS/shared/contested/consequence tests: **30 passed, 0 failed**;
- named `npm run consequence`: PASS;
- exact consequence-world replay: PASS;
- Floorborn consequence-memory snapshot/restore: PASS.

## Two causal channels

v0.11 keeps these separate:

```text
Floorborn action receipt
  = what Floorborn chose + what that action caused

player-visible incoming consequence
  = what another player/world caused to Floorborn
    and Floorborn could legitimately observe
```

Opponent-caused damage is not rewritten as if Floorborn caused it.

## Bounded visible event

Training event:

```text
event: incoming:damaged:army-alpha
source player: peer-001
affected group: army-alpha
kind: combat-damage
utility: -0.8
novelty: 0.5
tags:
  combat
  damage
  incoming-pressure
```

The event existed only in the affected player's bounded observation inbox. It was absent from the attacking player's observation and did not contain host-only doctrine.

The event key is deterministic and deduplicated, so rereading the same observation does not inflate memory.

## Measured later behavioral effect

After one incoming damage event, the same later legal attack opportunity was shown to two otherwise fresh Floorborn lineages.

```text
same action:
command:attack:army-alpha:army-alpha

fresh Floorborn score:      3.000
experienced Floorborn:      2.325
score delta:               -0.675
```

Fresh evidence:

```text
base:command=0
goal-relevance=+3
```

Experienced evidence:

```text
base:command=0
memory:combat=-0.675
goal-relevance=+3
```

The retained incoming consequence created:

```text
combat pattern count: 1
combat total signal: -0.675
```

Thus something that happened **to** Floorborn can causally alter a later inspectable arbitration score.

## What v0.11 deliberately does not add

No retreat policy was added.

No `fear`, `pain`, `trauma`, `anger`, `trust`, or other subjective/emotional label was inferred.

The evidence is only:

```text
this visible combat consequence occurred
+
it was negative in this game utility model
+
that history now participates in later combat-tag arbitration
```

Whether retreat, attack, fortification, or another legal action should win remains a separate current-state decision problem.

## Useful red run #58 / full run #232

The first v0.11 head passed every new behavioral/intake test except exact replay.

The failure appeared as a generic replay mismatch at turn 0. Instrumentation showed that the causal state itself was not diverging. The verifier was comparing raw `JSON.stringify` output for an `outcome` object against a stable-cloned receipt whose keys were sorted.

The game and memory behavior were not weakened.

Replay comparison was repaired to use stable serialization and field-specific mismatch reporting. Both remote pipelines then passed.

This is preserved because deterministic evidence should compare semantic stable state, not incidental object property insertion order.

## Claim boundary

v0.11 supports the narrower claim that player-visible consequences caused by another actor can enter Floorborn's inspectable retained game history, remain scoped to what the player could observe, survive restore, alter later arbitration, and replay deterministically.

It does not establish subjective experience and it does not establish that the resulting behavior is strategically optimal.

## Next seam

v0.10 showed a legal retreat affordance that Floorborn never selected. v0.11 now lets incoming damage become experience.

The next isolated question is current-state perspective:

> When an own combat group is visibly at critical integrity and a legal recovery action exists, can the machine floor represent that state as immediate recovery relevance without hardcoding a permanent defensive personality?

Keep this separate from v0.11 so later behavior changes can be attributed to either retained external consequence history, present critical state, or their interaction.
