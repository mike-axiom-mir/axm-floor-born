# Live contested RTS snapshot contract receipt

Status: **PASS on an unmerged PR lane**

## Failure boundary

The v0.1 live contested snapshot bundled game state, Floorborn state, the public
transcript, and Floorborn decision receipts without a versioned integrity or
replay contract. Restore checked only the outer schema before making those
independent representations usable.

## Implemented boundary

The v0.2 contract separates and hashes:

- canonical current state;
- retained game, transcript, and decision history;
- the deterministic replay anchor.

Acceptance requires complete game-receipt replay, exact transcript derivation,
decision-to-game causal links, and deterministic game plus Floorborn replay
after the anchor. Validation runs before view, action, or reveal paths return a
restored model.

New sessions anchor before receipt zero. v0.1 imports validate the evidence they
can prove, then explicitly label their current Floorborn state as the trust
anchor; no retroactive player-replay claim is made.

## Local verification

```text
npm run snapshot-contract: 12/12 pass
npm test:                  114/114 pass
npm run contested-rts:     PASS
npm run consequence:       PASS
npm run recovery:          PASS
npm run adapted-contest:   PASS
npm run recovery-lifecycle: PASS
npm run state-recovery:    PASS
git diff --check:          PASS
```

The focused suite covers deterministic serialization, JSON-compatible resume,
plain byte tampering, recomputed-digest state tampering, transcript rewrites,
decision-link rewrites, replay-anchor mutation, valid v0.1 migration, post-
migration verification, and invalid legacy projection rejection.

## Claim boundary

SHA-256 binds snapshot content but does not authenticate its author. A legacy
import necessarily trusts the validated current Floorborn state as its starting
point. Validation cost grows linearly with retained receipts; this contested
laboratory remains bounded to four action windows.
