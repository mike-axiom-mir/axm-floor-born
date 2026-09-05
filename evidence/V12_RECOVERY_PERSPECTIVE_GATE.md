# Floorborn v0.12 critical-state recovery perspective

Status: **PASS on PR lane; do not auto-merge**

## Question

Can Floorborn represent a currently visible critical own-unit state as immediate recovery relevance without silently rewriting the historical v0.10 player or hardcoding a permanent defensive personality?

## Design separation

v0.12 is explicitly opt-in:

```text
perspectives.criticalRecovery = false   # historical/default baseline
perspectives.criticalRecovery = true    # v0.12 experimental perspective
```

This preserves the v0.10 contested baseline exactly. A default Floorborn does not receive the new recovery evidence.

When enabled, the perspective is current-state only. It does not create memory by itself.

The trigger requires all of:

```text
legal action tagged recovery
+
affected own group is combat
+
that group is currently at center
+
visible integrity == 1
```

Evidence added:

```text
critical-state-recovery:<group>=+3
```

The +3 weight intentionally equals main `goal-relevance=+3`. Present critical state therefore makes recovery competitive, not automatically dominant.

## Verified result

Exact v0.12 head passed both remote pipelines on Node 24.

Full historical pipeline:

```text
86 tests passed
0 failed
```

The isolated RTS lane also passed all v0.8-v0.12 tests and named gates.

Named proof:

```bash
npm run recovery
```

## Same critical combat state, three conditions

All comparisons used the same bounded state:

```text
own army-alpha: center, integrity 1
opponent army-alpha: visible at center
legal attack: yes
legal retreat: yes
```

### A. Historical/default Floorborn, perspective OFF

```text
selected: attack
attack score:  3
retreat score: 0
```

Retreat had no `critical-state-recovery` evidence.

This preserves the v0.10 baseline rather than silently changing old evidence.

### B. Fresh Floorborn, perspective ON, no retained incoming-damage history

```text
selected: attack
attack score:  3
retreat score: 3
```

Attack evidence:

```text
base:command=0
goal-relevance=+3
```

Retreat evidence:

```text
base:command=0
critical-state-recovery:army-alpha=+3
```

Current state alone therefore did **not** force retreat. The equal scores resolve deterministically to attack through the ordinary action-id tie-break.

### C. Perspective ON + one legitimate incoming damage experience

The incoming player-visible event from v0.11 was ingested first:

```text
incoming:damaged:army-alpha
combat signal: -0.675
```

Same later critical state:

```text
selected: retreat
attack score:  2.325
retreat score: 3
```

Attack evidence:

```text
base:command=0
memory:combat=-0.675
goal-relevance=+3
```

Retreat evidence:

```text
base:command=0
critical-state-recovery:army-alpha=+3
```

The committed action produced:

```text
retreated:army-alpha:base
```

and exact world replay passed.

## Main finding

The result separates three layers cleanly:

```text
present critical state
  -> makes recovery relevant

retained negative incoming consequence
  -> lowers later combat value

interaction of both
  -> can change the selected legal action
```

Neither layer alone was implemented as an unconditional retreat command.

This is a useful machine-floor pattern:

> current state can create an affordance-level perspective while lived history determines how strongly that affordance competes with another valid goal.

## Snapshot / continuity

Floorborn snapshots now preserve the explicit perspective configuration. Restore retains:

- `criticalRecovery: true` when intentionally enabled;
- incoming consequence memory;
- resulting later recovery behavior.

Old snapshots without perspective config normalize to the historical default (`criticalRecovery: false`).

## Claim boundary

v0.12 supports the narrow claim that a configured deterministic machine-floor perspective can recognize a player-visible critical own-unit state and expose recovery relevance in arbitration, while retained incoming consequence history can causally interact with that state to change a later legal choice.

It does not establish that retreat is generally optimal, that Floorborn has fear/pain/self-preservation in a subjective sense, or that the new perspective should become a universal root.

## Next gate: v0.13 integrated contested adaptation

Run the same deterministic pressure-peer contest as v0.10 with:

- `ConsequenceContestedRtsSession`;
- `criticalRecovery` perspective enabled;
- visible incoming consequences ingested before each Floorborn decision.

Compare against the frozen v0.10 baseline:

```text
baseline retreats: 0
baseline Floorborn armies destroyed: 2
baseline control: 1
baseline result: draw 1-1
```

Measure behavior change rather than require improvement:

- attacks;
- retreats;
- fortifications;
- scouting;
- destroyed/surviving groups;
- control pressure;
- total effective actions;
- exact replay;
- retained incoming consequence records.

A retreat that preserves a unit but loses center control is still a useful result. Do not optimize the gate around winning.
