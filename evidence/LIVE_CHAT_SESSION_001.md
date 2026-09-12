# Live chat co-op session 001

Status: **PASS**

This evidence records the first live AXM Floorborn co-op session in which a working neural chat occupied `chat-001` and chose its actions from only the player-visible observation/action list emitted by the live bridge. `floorborn-001` independently used deterministic Floorborn arbitration.

Session id: `floorborn-chat-1788588693559`

## Turn transcript

1. `floorborn-001` -> `move:forest`
2. `chat-001` -> `move:ruins`
3. `floorborn-001` -> `inspect:forest`
4. `chat-001` -> `inspect:ruins`
5. `floorborn-001` -> `gather:sun-shard`
6. `chat-001` -> `gather:moon-shard`
7. `floorborn-001` -> `move:gate`
8. `chat-001` -> `move:gate`
9. `floorborn-001` -> `signal:open-gate`

## Final public state

- both players at `gate`
- `floorborn-001` carries `sun-shard`
- `chat-001` carries `moon-shard`
- each player inspected a different location
- Twinseal Gate open

## Verification

The exact 9 recorded action/outcome receipts were replayed against a fresh co-op session and reproduced the same final public state: **LIVE REPLAY PASS**.

## Claim boundary

This proves an operational result only: a deterministic Floorborn player and a working neural chat can occupy separate bounded player slots, take independent legal actions, alter one shared deterministic RPG world, cooperate toward a common in-world condition, and produce replayable evidence.

It is not evidence of consciousness or subjective experience.
