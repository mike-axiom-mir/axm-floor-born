# Floorborn v0.14 bounded recovery lifecycle

Status: **PASS on PR lane; do not auto-merge**

## Question

Can the v0.13 one-action recovery behavior be extended into an explicit short-lived Floorborn lineage state that blocks immediate same-window re-entry by the recovering group without silently becoming a permanent defensive bias or rewriting the frozen baseline?

## Verified result

The exact v0.14 artifact head passed both remote pipelines on Node 24:

- `floorborn-proof`: PASS;
- `floorborn-rts-transfer`: PASS;
- named `npm run recovery-lifecycle`: PASS;
- exact adapted combat replay: PASS;
- Floorborn recovery-memory snapshot/restore: PASS.

The v0.14 proof output was also preserved as a CI artifact (`v14-recovery-lifecycle-proof`) so the comparison is read from the exact verified runner output rather than inferred from a green check.

## Recovery lifecycle state

The experimental capability is explicit and opt-in:

```text
perspectives.recoveryLifecycle = false   # frozen historical/default behavior
perspectives.recoveryLifecycle = true    # v0.14 experiment
```

When enabled, a recovery retreat creates an inspectable group-specific record:

```text
sequence
groupId
status
createdSessionId
createdTurn
createdWindowIndex
sourceActionId
sourceEventId
retiredSessionId
retiredTurn
retiredWindowIndex
retiredEventId
```

While a record is pending, an immediate center move affecting that same group in the same action window receives:

```text
recovery-lifecycle-hold:<group>=-3
```

The hold is group-specific. Unrelated groups are not penalized.

The first v0.14 lifecycle retires deterministically when the action window advances. Override, missing/destroyed group, or incompatible session state can retire/invalidate it explicitly instead of leaving ghost state.

## Exact v0.13 control

Action history:

```text
1. move army-alpha to center
2. attack alpha -> alpha
3. move army-beta to center
4. attack beta -> alpha
5. retreat army-beta to base
6. move army-beta straight back to center
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
winner:                  pressure-peer-001
observed consequences:   4
recovery records:        0
```

Immediate retreat -> same-group re-entry: **true**.

## Exact v0.14 lifecycle run

Action history:

```text
1. move army-alpha to center
2. attack alpha -> alpha
3. move army-beta to center
4. attack beta -> alpha
5. retreat army-beta to base
6. scout center
7. move army-beta to center
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
winner:                  pressure-peer-001
observed consequences:   4
recovery records:        1
```

Immediate retreat -> same-group re-entry: **false**.

The action replacing immediate re-entry was:

```text
command:scout:center
```

The damaged beta re-entered only after the recovery lifecycle retired at the next action window.

## Exact recovery record

```text
sequence: 1
groupId: army-beta
status: completed
createdSessionId: v14-proof-lifecycle
createdTurn: 8
createdWindowIndex: 2
sourceActionId: command:retreat:army-beta:base
sourceEventId: retreated:army-beta:base
retiredSessionId: v14-proof-lifecycle
retiredTurn: 13
retiredWindowIndex: 3
retiredEventId: recovery-completed:window-advanced
```

No recovery record remained active at closure.

## Main finding

v0.14 successfully changed:

```text
retreat
-> immediate same-group re-entry
```

into:

```text
retreat
-> different action while recovery is pending
-> action window advances
-> recovery retires
-> same damaged group can re-enter later
```

But the match result, losses, control, and total agency use were unchanged.

That is important. The lifecycle is now real and inspectable, but its retirement condition is currently **time-based** rather than **state-grounded**.

The army did not heal, repair, reinforce, or otherwise change integrity while the window passed. It re-entered after the lifecycle expired while still carrying the underlying damaged state.

So v0.14 exposes the next machine-state distinction:

```text
elapsed time / new action window
!=
recovered physical game state
```

A clock boundary is not evidence that recovery actually occurred.

## Claim boundary

v0.14 supports the narrow claim that Floorborn can create, carry, apply, retire, snapshot, and replay a bounded group-specific recovery lifecycle that changes later legal-action arbitration without modifying the game engine into a hidden cooldown and without altering the historical baseline when disabled.

It does not support a claim that the recovery condition is strategically sufficient. The exact run demonstrates that one-window retirement delayed re-entry by one Floorborn action but did not preserve the unit or improve the result.

## Next gate: v0.15 state-grounded recovery completion

Do not simply extend the hidden timer or increase the re-entry penalty.

Test recovery retirement against visible game state rather than elapsed time alone.

Minimal direction:

1. keep the lifecycle on the Floorborn lineage, not as an invisible engine cooldown;
2. introduce a normal legal base recovery/stabilization action for a damaged own combat group;
3. that action must cost ordinary effective agency under the same APM cap;
4. completion must be visible and deterministic, for example restoring one integrity point up to the normal group maximum;
5. pending recovery should make the matching stabilization action relevant and keep immediate re-entry unattractive while the group remains critical;
6. recovery should retire only after observable stabilized state, explicit override, destruction/missing group, or other bounded invalidation;
7. another action window passing by itself must not imply recovery;
8. preserve v0.10-v0.14 baselines when the new experimental capability is disabled;
9. exact replay and snapshot/restore remain mandatory;
10. judge causal behavior change, not win rate.
