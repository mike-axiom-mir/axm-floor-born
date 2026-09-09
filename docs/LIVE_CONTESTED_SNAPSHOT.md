# Live contested RTS snapshot contract

`axm.floorborn.live-contested-rts.v0.2` is the restart boundary for the live
state-grounded contested RTS bridge.

## Truth families

The snapshot keeps three truth families explicit:

- canonical current state: session identity, Floorborn lineage state, and the
  current game state without its receipt array;
- retained history: game receipts, the public transcript projection, and
  Floorborn decision receipts;
- replay origin: the exact game and Floorborn states from which deterministic
  verification resumes.

Each family has its own SHA-256 digest. A fourth digest binds those digests and
their versioned integrity contract. Digests detect accidental change and bind
the families together; they are not signatures or proof of who created a
snapshot.

## Acceptance rules

Before a snapshot can serve a view, accept a chat action, or reveal a result,
the runtime:

1. verifies the exact v0.2 shape and all family digests;
2. restores canonical game and Floorborn state without normalization drift;
3. replays the complete game receipt ledger from the fixed game origin;
4. derives the transcript from those receipts and requires an exact match;
5. checks each Floorborn decision receipt against its game receipt;
6. reconstructs every transition after the replay anchor, including visible
   consequence intake, deterministic choice, learning, and session closure;
7. requires the replayed game and Floorborn states to equal the snapshot.

No invalid state is returned for later mutation. A caller can inspect the same
contract without resuming through `inspectLiveContestedSnapshot()`.

## v0.1 migration

An unsealed v0.1 snapshot cannot retroactively prove the Floorborn state that
preceded its retained decisions. Migration therefore validates its complete
game replay, transcript, decision links, identities, and canonical shapes, then
labels its current state as a `legacy-v0.1-import` replay anchor. All subsequent
transitions are fully replayed from that boundary. The migration does not claim
that pre-anchor Floorborn state was independently reconstructed.

New sessions use a `session-origin` anchor before receipt zero, so their full
game and Floorborn evolution is verified.
