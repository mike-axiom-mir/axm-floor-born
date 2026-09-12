# Floorborn v0.6 intention lifecycle gate

Status: **PASS on PR lane; do not auto-merge**

## Question

Can a bounded deterministic Floorborn player form an explicit optional intention in one session, carry it across unrelated later play, let it influence a matching legal opportunity, and then retire or invalidate it without turning the old intention into a permanent command?

## Result

Yes, within the bounded v0.6 intention laboratory.

GitHub Actions `floorborn-proof` run **#122** completed successfully on Node 24:

- **44 tests passed, 0 failed**;
- v0.1 bounded-player demo PASS;
- v0.3 expedition gate PASS;
- v0.4 continuity gate PASS;
- v0.5 evidence-revision gate PASS;
- v0.6 named intention-lifecycle gate PASS.

Named proof:

```bash
npm run intention
```

## Lifecycle demonstrated

A legitimate prior relic experience causes Floorborn to choose a non-required future intent at an interlude:

```text
signal:seek-relic
```

That choice creates an explicit lineage record:

```text
sequence: 1
id: seek-relic
status: pending
createdSessionId: v06-intent-created
sourceActionId: signal:seek-relic
```

The pending intention survives an unrelated signal-verification session and exact memory snapshot/restore.

When a later legal relic opportunity appears, Floorborn selects:

```text
signal:pursue-relic-route
```

with visible evidence including:

```text
base:signal=0.5
memory:optional=+0.05
memory:relic=+0.275
optional-curiosity=+0.4
intention:seek-relic=+1.8
```

It then legally gathers the relic. The same intention record becomes:

```text
status: fulfilled
retiredSessionId: v06-opportunity
retiredEventId: gathered:memory-relic
```

The opportunity session replays exactly: **PASS**.

## Continuity is not compulsion

After fulfillment, the old intention no longer contributes its `+1.8` arbitration signal.

At a later interlude Floorborn autonomously chooses:

```text
signal:finish-journey
```

The completed `seek-relic` intention remains as history but does not force the same desire to regenerate.

If `seek-relic` is later legally adopted again, v0.6 creates a separate lifecycle:

```text
old sequence: 1 -> fulfilled
new sequence: 2 -> pending
```

The retired first record is not resurrected or rewritten.

## Changed-world invalidation

A pending intention may also encounter a world where the matching opportunity is no longer available.

Floorborn receives only the legal acknowledgement action:

```text
signal:acknowledge-no-relic
```

The pending record becomes:

```text
status: invalidated
retiredEventId: intent-invalidated:seek-relic
```

The historical choice remains inspectable rather than being silently deleted.

## Useful failed experiment preserved

GitHub Actions run **#114** had 42/43 tests passing. The one failing test expected Floorborn to automatically choose `seek-relic` again immediately after fulfilling the previous relic intention.

Actual Floorborn choice:

```text
signal:finish-journey
```

That failure exposed a bad research assumption rather than a missing capability. Automatically regenerating a fulfilled intention would make continuity behave like compulsion.

The gate was repaired in the stricter direction:

1. fulfillment must remove the old intention's arbitration influence;
2. the player is allowed to choose closure afterward;
3. if the same legal intent is later adopted again, it must create a new lifecycle record rather than resurrect the retired one.

The repaired model passed run #116 and the named v0.6 gate passed run #122.

## Claim boundary

v0.6 supports this narrower statement:

> Within the AXM bounded player laboratory, Floorborn can retain an explicitly selected optional intention across sessions, apply it to a later matching legal opportunity, retire it on fulfillment or invalidation, and preserve retired intentions as history without allowing them to become immortal commands.

It does not establish human desire, motivation, subjective goals, free will, consciousness, or general long-horizon planning.

## Next depth

The next useful gate should combine these mechanisms in a longer blind multi-session journey rather than adding another isolated score feature. The same lineage should encounter changing worlds, a recurring companion, revisable evidence, optional intentions, mistakes, and ordinary downtime while preserving one inspectable campaign history.
