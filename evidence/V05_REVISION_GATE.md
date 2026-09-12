# Floorborn v0.5 evidence revision gate

Status: **PASS on PR lane; do not auto-merge**

## Question

Can a deterministic Floorborn player revise a companion-specific learned relationship when later game evidence contradicts or supports it, without collapsing that evidence into a global reputation score?

## Result

Yes, within the bounded signal-verification laboratory.

GitHub Actions `floorborn-proof` run **#104** completed successfully on Node 24:

- **38 tests passed, 0 failed**;
- v0.1 bounded-player demo PASS;
- v0.3 expedition gate PASS;
- v0.4 continuity gate PASS;
- v0.5 named evidence-revision gate PASS.

Named proof:

```bash
npm run revision
```

## Revisable sequence

A fresh Floorborn confronted with `chat-001` claiming `route-safe` chooses independent verification:

```text
fresh -> inspect:verify-current
```

After four independently verified safe outcomes supporting that exact signal from that exact companion:

```text
supported=4
contradicted=0
choice -> signal:follow-peer
signal-evidence:chat-001:route-safe=+2.4
```

After eight later verified outcomes contradict the same claim:

```text
supported=4
contradicted=8
choice -> inspect:verify-current
signal-evidence:chat-001:route-safe=-0.8
```

After twelve additional later outcomes support the claim:

```text
supported=16
contradicted=8
choice -> signal:follow-peer
signal-evidence:chat-001:route-safe=+0.8
```

The learned relationship therefore changed in both directions as new receipts arrived.

## Specificity boundary

The evidence is keyed by both companion and signal.

After learning `chat-001 / route-safe`:

```text
chat-new / route-safe   -> inspect:verify-current
chat-001 / route-danger -> inspect:verify-current
```

Evidence about one companion does not automatically apply to a stranger. Evidence about one signal does not automatically become evidence about another signal from the same companion.

## What is stored

Each companion may retain explicit per-signal counts:

```text
signalEvidence[signal] = {
  supported,
  contradicted
}
```

The current action influence is calculated from the balance of those receipts. It is not a hidden moral judgment, permanent label, or opaque trust score.

`signalsSeen` records that a signal was observed. `signalEvidence` records whether later game evidence supported or contradicted it. These remain distinct facts.

## Replay and persistence

Signal-verification sessions are ordinary bounded player sessions with legal actions and action/outcome receipts. Verified trials replay exactly. The v0.5 memory snapshot restores exactly.

## Claim boundary

v0.5 supports this narrower statement:

> Within the AXM bounded player lab, Floorborn can retain companion-and-signal-specific evidence, let that evidence affect a later legal choice, and revise the influence in either direction when later receipts disagree or agree.

It does not establish human notions of trust, belief, deception understanding, social cognition, consciousness, or general reasoning about testimony.

## Next depth

The next useful test is longer-horizon intention: can Floorborn select an optional intent in one session, carry it forward as explicit pending state across ordinary intervening sessions, act on it when a matching opportunity appears, and retire or revise that intention when completed or invalidated?
