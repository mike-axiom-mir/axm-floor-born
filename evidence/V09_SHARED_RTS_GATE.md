# Floorborn v0.9 shared RTS player-slot gate

Status: **PASS on PR lane; do not auto-merge**

## Question

Can Floorborn and another decision architecture occupy separate player slots in one RTS-style world while sharing the same command vocabulary, fog rules, effective-APM cap, and consequences, without sharing or stealing each other's action budget?

## Result

Yes, within the bounded v0.9 RTS laboratory.

The exact live-session implementation head passed both remote pipelines:

- `floorborn-rts-transfer`: PASS;
- `floorborn-proof`: PASS.

The isolated RTS lane ran **19 RTS/shared/live tests: 19 passed, 0 failed**, plus:

- v0.8 named solo RTS transfer proof: PASS;
- v0.9 named shared RTS player-slots proof: PASS;
- first live working-chat shared RTS session: PASS.

## Player-slot equality

Equivalent player slots receive the same:

- `axm.player.rts.v0.1` protocol;
- visible-state schema;
- legal command vocabulary;
- command-cost calculation;
- five-second action window;
- two effective actions per window;
- 24 effective APM limit;
- fog-of-war rules.

Their internal reasoning method is not artificially equalized.

## Independent agency budgets

Each player owns an independent effective-action meter.

A two-squad command costs two effective actions because it independently retasks two groups. If Floorborn spends both of its actions, the peer still retains its own remaining actions.

Receipts record:

- acting player;
- action cost;
- acting budget before/after;
- opponent budget before/after;
- window index;
- pre/post state digests.

Tests verify one player's command cannot consume the other's budget.

## Shared-world fog interaction

A player's center combat movement remains hidden from an opponent that has not scouted center.

Once that opponent legally scouts center, visible contacts are derived from the shared world state. Engine-only doctrine remains outside the observation.

Thus world mutation is shared while knowledge remains player-bounded.

## Scheduler lesson from red run #20

The first shared replay test failed even though the engine behavior was correct.

The test incorrectly assumed RTS equality meant strict alternating turns.

Actual correct behavior:

```text
same per-player APM cap
!=
forced one-for-one alternation
```

If player A has exhausted its independent window budget while player B still has budget, player B may receive consecutive legal command opportunities until B also exhausts or yields.

The test was repaired to follow the deterministic budget scheduler. The engine was not weakened to satisfy the faulty assumption.

This red run is preserved as a design finding because strict alternation would distort the very RTS action-bandwidth model the experiment is trying to test.

## Named v0.9 proof

```bash
npm run shared-rts
```

Measured named proof:

```text
window: 5 seconds
budget: 2 effective actions/player
APM: 24/player

Floorborn effective actions spent: 3
Peer effective actions spent:      4
```

The two player types spent scarce agency differently while obeying the same boundary.

## First live working-chat RTS session

Evidence: `evidence/LIVE_SHARED_RTS_SESSION_001.md`.

Working-chat choices:

```text
move army-alpha to center
scout center
build power node
```

Floorborn independently chose:

```text
build power node
scout center
```

The exact five-turn shared session replayed to the same final public state.

## What v0.9 supports

> A deterministic Floorborn player and a working neural chat can occupy separate player slots in one shared deterministic RTS-style world, use the same architecture-neutral effective-APM boundary and legal command system, spend independent action budgets, cause world changes that can later enter the other player's bounded observation, and reproduce the entire interaction through exact receipts.

## What v0.9 does not support

It does not establish that Floorborn is a strong RTS player, that the lab is a production RTS, that a neural chat is disadvantaged or advantaged fairly in every possible interface, or that either player has subjective experience.

The research target remains player architecture and agency allocation, not victory claims.

## Next gate: v0.10 contested RTS play

The next useful step is a tiny adversarial/contested RTS world rather than a larger content surface.

Requirements:

1. retain separate equal effective-APM budgets;
2. retain player-specific fog;
3. introduce a shared contested objective or deterministic combat contact;
4. one player's positioning/scouting must create genuine consequences for the other;
5. do not script aggressive/defensive personalities;
6. measure where each architecture spends scarce agency;
7. allow mistakes, retreat/reposition, and recovery;
8. receipts must make combat/state consequences exactly replayable;
9. win/loss may be recorded but must not be the sole research metric;
10. later allow a working chat to occupy the peer slot through the same live bridge.
