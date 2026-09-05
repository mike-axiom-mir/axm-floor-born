# Live expedition session 001

Status: **PASS**

This evidence records the first blind v0.3 expedition in which a working neural chat and deterministic `floorborn-001` occupied separate player slots in a seed-dependent hidden-layout RPG.

Session id: `live-hidden-1788589463340`

## Blindness boundary

During play, the working chat was shown only `liveExpeditionView(...)`: its current bounded observation, legal action list, and the shared transcript. The world seed and hidden region contents were not printed or used as player input.

The host snapshot necessarily contains engine state needed to resume/replay the game. That raw host snapshot is **not** a player observation and must remain outside the player context. Future process/network adapters should enforce this boundary structurally rather than by convention.

The seed was revealed only after the expedition completed.

## Live turn transcript

1. `floorborn-001` -> `move:archive`
2. `chat-001` -> `move:grove`
3. `floorborn-001` -> `inspect:archive`
4. `chat-001` -> `inspect:grove`
5. `floorborn-001` -> `gather:ember-seal`
6. `chat-001` -> `gather:tide-seal`
7. `floorborn-001` -> `signal:found-seal`
8. `chat-001` -> `move:camp`
9. `floorborn-001` -> `move:camp`
10. `chat-001` -> `move:gate`
11. `floorborn-001` -> `move:gate`
12. `chat-001` -> `wait:gate`
13. `floorborn-001` -> `signal:open-gate`

## What was not scripted

- Floorborn independently selected the Glass Archive from the equal first-turn routes.
- The chat independently chose a different route, Lumen Grove.
- Both hidden regions happened to contain different required seals.
- After gathering its seal, Floorborn chose `signal:found-seal` because its accumulated seal-related evidence made that communication action score above immediately leaving.
- Once both seals existed, the Gate move gained a separate `goal` relevance signal. Floorborn selected it on its own turn.
- At the Gate, the chat deliberately chose `wait:gate` rather than opening the Gate, leaving the final choice to Floorborn.
- Floorborn selected `signal:open-gate` over regrouping, leaving, or waiting.

## Post-completion reveal

Seed: `223696`

Hidden layout:

- Glass Archive -> `ember-seal`
- Lumen Grove -> `tide-seal`
- Clockwork Quarry -> optional `memory-relic`
- Hush Marsh -> trap

Neither the relic nor trap needed to be visited for this particular lived route.

## Final public state

- both players at the Resonance Gate;
- `floorborn-001` carries `ember-seal`;
- `chat-001` carries `tide-seal`;
- Floorborn inspected the Archive;
- chat inspected the Grove;
- Resonance Gate open;
- 13 committed turns.

## Replay verification

The exact 13 action/outcome receipts were replayed against a fresh `ExpeditionSession` using the revealed seed and the same two player identities. Node `assert.deepEqual` matched the replayed public state to the completed live public state: **LIVE EXPEDITION REPLAY PASS**.

## Claim boundary

This supports an operational game-player claim only. In this bounded RPG lab, Floorborn can independently observe, select legal actions, explore hidden state, gather resources, communicate, respond to a goal state, cooperate with a different player architecture, preserve inspectable decision evidence, and finish a live shared session.

It does not establish consciousness, subjective experience, human-like understanding, or general game-playing competence.
