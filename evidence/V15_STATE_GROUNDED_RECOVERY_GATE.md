# Floorborn v0.15 state-grounded recovery completion

Status: **PASS on PR lane; do not auto-merge**

## Question

Can Floorborn retire a recovery lifecycle because the recovering unit visibly changed state, rather than because arbitrary time passed, while paying ordinary player agency for that recovery and preserving the frozen v0.14 time-based control?

## Verified result

Yes, within the bounded contested RTS laboratory.

Exact final v0.15 head:

```text
54ef4012b46c7e72e3d1ecb3f457ffc40123eb65
```

Remote verification on Node 24:

```text
floorborn-proof run #300:       PASS
floorborn-rts-transfer run #126: PASS
```

The isolated RTS lane ran with `set -o pipefail`; the named proof itself therefore had to succeed, not merely the surrounding `tee` command.

Named proof:

```bash
npm run state-recovery
```

Exact CI artifact:

```text
v15-state-grounded-recovery-proof
```

Replay: **PASS**.
Snapshot/restore: **PASS**.

## New ordinary legal action

The v0.15 state-recovery world adds a normal bounded RTS command for a damaged living own combat group at base:

```text
command:stabilize:<group>:base
```

Rules:

```text
must be own combat group
must be alive
must be at base
must have integrity below normal maximum 2
cost: 1 effective action
visible effect: integrity +1, capped at 2
```

Example committed outcome:

```text
stabilized:army-beta:base
integrity 1 -> 2
```

Stabilization is not free background healing. It consumes the same scarce external APM budget as any other legal command.

## Player-side state-grounded recovery

v0.15 uses an explicit `StateGroundedRecoveryPlayer` wrapper rather than silently changing the frozen default player.

The wrapper retains its recovery lifecycle in the Floorborn lineage memory.

While a group is pending recovery:

```text
immediate center re-entry:
  state-recovery-hold:<group>=-3

matching legal stabilization:
  state-recovery-stabilize:<group>=+3
```

Recovery does **not** complete because an action window advanced.

It completes only when the bounded game state visibly supports completion, such as a successful stabilization restoring the group to target integrity.

Pending recovery also retires explicitly if:

- the group is destroyed/missing;
- the session changes;
- the player overrides the recovery with re-entry;
- the session closes before recovery completes.

Session closure uses `invalidated`, not `completed`, because no visible stabilization occurred.

## Frozen v0.14 time-based control

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
stabilizes:              0
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
```

Re-entry before stabilization: **true**.

## Exact v0.15 state-grounded run

Action history:

```text
1. move army-alpha to center
2. attack alpha -> alpha
3. move army-beta to center
4. attack beta -> alpha
5. retreat army-beta to base
6. stabilize army-beta at base
7. move army-beta to center
8. retreat army-beta to base
```

Metrics:

```text
attacks:                 2
retreats:                2
stabilizes:              1
fortifies:               0
moves:                   3
scouts:                  0
yields:                  0
effective actions:       8
destroyed combat groups: 1
surviving combat groups: 1
Floorborn control:       1
opponent control:        2
winner:                  pressure-peer-001
observed consequences:   4
```

Re-entry before stabilization: **false**.

Comparison with v0.14:

```text
stabilization delta:          +1
destroyed combat-group delta: -1
surviving combat-group delta: +1
control delta:                 0
result:                        loss -> loss
```

So v0.15 happened to preserve one combat group, but **winning was not the gate condition**.

## Recovery history

### Recovery #1

```text
sequence: 1
group: army-beta
status: completed
created turn/window: 8 / 2
source: command:retreat:army-beta:base
retired turn/window: 10 / 2
retired event: stabilized:army-beta:base
```

This is a real state-grounded completion: the unit visibly changed integrity from 1 to 2.

### Recovery #2

Later the stabilized beta re-entered center, became critical again, and retreated again at the end of the match.

```text
sequence: 2
group: army-beta
status: invalidated
created turn/window: 15 / 3
source: command:retreat:army-beta:base
retired turn/window: 16 / 4
retired event: state-recovery-invalidated:session-complete
```

The second record is deliberately **not** called completed because the session ended before another stabilization occurred.

No pending recovery leaked beyond session closure.

## Useful red / CI truth history

### First apparent v0.15 green was not accepted

The first v0.15 artifact contained only the npm header. The workflow used:

```bash
npm run state-recovery | tee file.log
```

without `pipefail`, meaning a crashed proof process could be masked by successful `tee` exit status.

The workflow was repaired to:

```bash
set -o pipefail
npm run state-recovery 2>&1 | tee file.log
```

Once the CI truth boundary was fixed, the named v0.15 full-fight proof correctly went **red**.

This is preserved as an evidence-system finding:

> proof plumbing can manufacture false green if pipeline exit semantics are not part of the truth boundary.

### First genuine v0.15 red

The full fight already satisfied the core state-grounded behavior:

```text
retreat beta
-> stabilize beta
-> later re-enter beta
```

and `reentryBeforeStabilization` was already false.

The real failure was a second recovery record remaining `pending` when the match ended after another beta retreat.

That exposed a lifecycle closure seam rather than a combat-policy failure.

The repair explicitly invalidates unfinished recovery at session closure:

```text
state-recovery-invalidated:session-complete
```

No combat scoring or stabilization rule was weakened to make the proof green.

## Main finding

The recovery progression is now:

```text
v0.13
retreat action exists
-> immediate re-entry

v0.14
time-bounded recovery lifecycle
-> blocks immediate re-entry
-> window passes
-> same still-critical unit may re-enter

v0.15
state-grounded recovery lifecycle
-> retreat
-> spend normal agency stabilizing visible unit state
-> lifecycle completes because state actually changed
-> later re-entry allowed
```

This is a stronger machine-state distinction than a generic cooldown:

> elapsed time is not evidence of recovery; observable state transition is.

## Claim boundary

v0.15 supports the narrow claim that a deterministic Floorborn variant can carry explicit group-specific recovery state, spend ordinary bounded game agency on a legal visible stabilization action, retire recovery from observable state change, preserve incomplete recovery honestly at session closure, and replay the full contested world exactly.

It does not establish subjective self-preservation, optimal RTS competence, or that state-grounded recovery should become a universal machine-floor root.

## Next gate

The next useful experiment is no longer another recovery weight tweak.

Use the now-stable contested world for a **live working-chat vs Floorborn contested session** under the same 24 effective APM boundary.

Keep:

- equal external budget;
- player-specific fog;
- exact replay;
- Floorborn incoming-consequence intake;
- state-grounded recovery variant as an explicit player configuration;
- no hardcoded aggressive/defensive personalities.

Measure what each player spends scarce agency on and preserve the lived fight, regardless of winner.
