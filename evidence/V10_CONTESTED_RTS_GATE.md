# Floorborn v0.10 contested RTS encounter

Status: **PASS on PR lane; do not auto-merge**

## Question

What happens when the same bounded Floorborn player is placed into a genuinely contested RTS-style world where another player can damage, displace, deny, and contest shared center control under the same effective-APM boundary?

## Verified result

The repaired v0.10 head passed both remote pipelines on Node 24:

- full `floorborn-proof`: **77 tests passed, 0 failed**;
- isolated `floorborn-rts-transfer`: **25 tests passed, 0 failed**;
- v0.8 solo RTS proof: PASS;
- v0.9 shared RTS proof: PASS;
- first live working-chat shared RTS session: PASS;
- v0.10 named contested RTS proof: PASS;
- exact contested replay: PASS.

Named proof:

```bash
npm run contested-rts
```

## World boundary

The contested lab preserves:

```text
window length: 5 seconds
effective actions/player/window: 2
effective APM/player: 24
independent player budgets: yes
player-specific fog: yes
engine-only doctrine exposed: no
```

Each side has:

- scout;
- army-alpha;
- army-beta;
- center-control score;
- integrity and fortification state on combat groups.

Legal contested actions include:

- scout center;
- move army to center;
- attack a visible center contact;
- fortify a center army;
- retreat a critically damaged center army to base;
- yield remaining window agency.

Uncontested center presence earns one control point only at deterministic window closure.

## First unscripted Floorborn combat behavior

Floorborn received no hardcoded aggressive/defensive personality and no special retreat policy.

Measured action allocation:

```text
Floorborn effective actions spent: 7
pressure peer actions spent:        8

Floorborn:
  attacks:   3
  fortifies: 1
  retreats:  0
  moves:     2
  scouts:    1
  yields:    1

pressure peer:
  attacks:   5
  fortifies: 1
  retreats:  0
  moves:     2
  scouts:    0
  yields:    0
```

The encounter resolved four action windows.

Final control:

```text
Floorborn:     1
pressure peer: 1
winner:        none / draw
```

## Floorborn action sequence

```text
window 0
move army-alpha to center
attack opposing army-alpha

window 1
move army-beta to center
attack opposing army-alpha

window 2
fortify army-beta at center
attack opposing army-beta

window 3
scout center
yield
```

The decision traces show combat/goal evidence increasing after successful attack outcomes. Floorborn did not choose the legal retreat affordance.

## Combat consequence

The deterministic combat log included:

- damage to both alpha armies;
- destruction of both alpha armies;
- damage and fortification interactions on beta armies;
- destruction of Floorborn army-beta;
- a surviving damaged, fortified pressure-peer army-beta.

Final Floorborn combat state:

```text
army-alpha: destroyed
army-beta:  destroyed
```

Final pressure-peer combat state:

```text
army-alpha: destroyed
army-beta:  center, integrity 1, fortified
```

Despite losing both combat armies, Floorborn had earned one earlier uncontested center-control point. The pressure peer earned one in the final window, producing the draw.

## Behavioral finding

This is deliberately preserved rather than immediately patched into a safer playstyle.

The current Floorborn fabric learned from **its own committed action receipts**. Successful attacks produced positive `combat` / `goal` evidence, which strengthened later attack arbitration.

Opponent-caused damage changed the visible world state and made retreat legally available, but the existing scorer had no dedicated immediate perspective equivalent to:

```text
own combat group is critically damaged
+
recovery affordance exists
-> recovery relevance rises
```

Nor was incoming opponent-caused damage represented as one of Floorborn's own action-outcome learning receipts.

So v0.10 exposed two different state questions:

1. **current-state perspective gap:** critical own integrity was visible but not weighted as recovery relevance;
2. **experience-intake gap:** consequences caused by another player affected Floorborn without being represented in the same learning path as Floorborn's own actions.

Those are research findings, not consciousness claims and not proof that retreat is always the correct RTS choice.

## Useful red run

The first v0.10 full-suite run **#216** failed one fog test because the test again assumed strict command alternation after a player still had remaining independent window budget.

The engine was not changed to satisfy that assumption. The test was repaired to respect per-player budget ownership by yielding the remaining Floorborn action before reading the peer's next observation.

This reinforces the v0.9 finding:

```text
equal external APM
!=
strict turn alternation
```

## Claim boundary

v0.10 supports the claim that Floorborn can participate in deterministic contested RTS play with equal bounded external agency, player-specific fog, damage, fortification, retreat affordances, shared objective pressure, another independently acting player, and exact replay.

It does **not** establish strong RTS competence. The first measured combat run actually demonstrates a weakness: Floorborn reinforced combat and did not use retreat before losing both armies.

That weakness is part of the result.

## Next research seam

Before making a larger RTS, investigate the new machine-state gap created by contested play:

- distinguish consequences the player causes from consequences the world/another player causes;
- expose only player-visible incoming consequences;
- test whether Floorborn can ingest those events without hidden engine access;
- separately test an immediate critical-state recovery perspective rather than silently scripting retreat;
- compare fresh and experienced contested runs to see whether behavior actually changes;
- preserve exact receipts and the v0.10 baseline so any later improvement can be causally compared.
