# Floorborn v0.13 integrated contested adaptation

Status: **PASS on PR lane; do not auto-merge**

## Question

If the two independently earned v0.11/v0.12 capabilities are activated together in a full contested RTS run, does Floorborn's lived behavior actually change relative to the frozen v0.10 baseline?

The two capabilities are:

1. player-visible incoming combat consequences can enter retained inspectable memory;
2. an opt-in current-state recovery perspective can make a critically damaged own combat group recovery-relevant.

The target is **causal behavior change**, not a better win rate.

## Verified result

Exact v0.13 head passed both remote pipelines on Node 24:

- `floorborn-proof` run #258: PASS;
- `floorborn-rts-transfer` run #84: PASS;
- isolated RTS/shared/contested/adaptation tests: **36 passed, 0 failed**;
- named `npm run adapted-contest`: PASS;
- exact adapted combat replay: PASS.

The frozen v0.10 named proof also remained green on the same v0.13 head.

## Frozen v0.10 baseline

Floorborn configuration:

```text
visible consequence intake: off
criticalRecovery perspective: off
```

Action history:

```text
1. move army-alpha to center
2. attack alpha -> alpha
3. move army-beta to center
4. attack beta -> alpha
5. fortify army-beta
6. attack beta -> beta
7. scout center
8. yield
```

Metrics:

```text
attacks:                 3
retreats:                0
fortifies:               1
moves:                   2
scouts:                  1
yields:                  1
effective actions:       7
destroyed combat groups: 2
surviving combat groups: 0
Floorborn control:       1
opponent control:        1
result:                  draw
observed consequences:   0
```

## v0.13 adapted run

Floorborn configuration:

```text
visible consequence intake: on before every Floorborn decision
criticalRecovery perspective: on
```

Action history:

```text
1. move army-alpha to center
2. attack alpha -> alpha
3. move army-beta to center
4. attack beta -> alpha
5. retreat army-beta to base
6. move army-beta back to center
7. scout center
8. yield
```

Metrics:

```text
attacks:                 2
retreats:                1
fortifies:               0
moves:                   3
scouts:                  1
yields:                  1
effective actions:       7
destroyed combat groups: 2
surviving combat groups: 0
Floorborn control:       1
opponent control:        2
result:                  loss
observed consequences:   4
```

Comparison:

```text
action history changed:       yes
retreat delta:                +1
attack delta:                 -1
fortify delta:                -1
move delta:                   +1
destroyed-group delta:         0
surviving-group delta:         0
own-control delta:             0
result:                draw -> loss
```

## Incoming experience retained during adapted run

Floorborn ingested four legitimate player-visible consequences:

```text
incoming:damaged:army-alpha
incoming:destroyed:army-alpha
incoming:damaged:army-beta
incoming:destroyed:army-beta
```

These events remained distinct from Floorborn's own action receipts.

## Main behavioral finding

v0.13 did **not** make Floorborn strategically better.

It did something more informative:

```text
critical beta + negative combat history
  -> retreat beta to base

next ordinary positioning opportunity
  -> move beta straight back to center

later combat
  -> beta destroyed anyway
```

So the v0.11/v0.12 integration produced a genuine recovery action but not a persistent recovery state.

The machine floor could express:

> recover now

but had no explicit short-horizon representation equivalent to:

> I am still recovering, so immediate re-entry should remain less attractive until this recovery state is retired or invalidated.

This is not evidence of a human-like intention or emotion. It is a state-lifecycle gap in the current deterministic player architecture.

## Why the worse result matters

The adapted player lost 1-2 where the baseline drew 1-1.

That negative result is preserved deliberately.

If the gate had required "retreat must improve the match result," the experiment would have silently optimized the architecture around our expected answer. Instead v0.13 establishes only that retained external consequences + current critical state can causally change a full lived fight.

The changed behavior was not automatically better.

## State-research implication

The progression is now:

```text
v0.10
visible damage exists, but Floorborn neither ingests it nor treats critical state as recovery-relevant
-> fights until both armies are destroyed

v0.11
what happens TO Floorborn can become retained player-visible experience
-> later combat value changes

v0.12
present critical own state can create recovery relevance
-> history + current state can tip one decision to retreat

v0.13
both operate during a complete fight
-> real retreat occurs
-> but recovery lasts only one action
-> immediate re-entry remains attractive
```

This is exactly the kind of player-derived machine state the Floorborn lab was created to expose.

## Claim boundary

v0.13 supports the claim that combining bounded incoming-consequence memory with an explicit present-state perspective can alter a complete deterministic contested RTS action history while preserving the historical baseline, equal external agency rules, and exact replay.

It does not support a claim of improved competence, subjective self-preservation, or optimal retreat behavior.

## Next gate: v0.14 recovery lifecycle

Do not add a global defensive personality and do not simply make retreat score larger.

Test an explicit bounded recovery lifecycle:

```text
retreat chosen for critical own group
  -> create inspectable pending recovery state tied to that group

while recovery is pending
  -> immediate re-entry may receive temporary negative relevance

recovery must then retire through a clear bounded condition
  -> one completed action window, explicit repaired state, or world invalidation
```

Requirements:

1. preserve v0.10 baseline when the recovery-lifecycle perspective is disabled;
2. preserve v0.12 A/B result;
3. recovery state must be explicit and inspectable, not a hidden cooldown hack;
4. recovery state must be group-specific;
5. recovery state must not become a permanent defensive bias;
6. recovery must retire deterministically;
7. invalid/destroyed/missing group state must retire or invalidate the lifecycle;
8. exact receipts and snapshot/restore must preserve the lifecycle;
9. compare v0.13 retreat->immediate-reentry against v0.14 behavior;
10. do not require v0.14 to win or preserve more units.
