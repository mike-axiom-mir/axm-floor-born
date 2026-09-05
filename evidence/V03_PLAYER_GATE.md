# Floorborn v0.3 player gate

Status: **PASS on PR lane; do not auto-merge**

## Operational claim

Within the bounded AXM RPG laboratory, Floorborn now meets the repo's operational player definition:

- persistent identity distinct from the game engine;
- bounded player-facing observation;
- legal action enforcement;
- deterministic non-neural action selection;
- independent world actions with ordinary consequences;
- inspectable retained experience that changes later choices;
- hidden state that must be discovered through play;
- route changes across different hidden layouts;
- recovery from another player's world-state changes;
- peer communication through ordinary legal actions;
- exact receipt-backed replay;
- live shared play with a working neural chat through the same player boundary.

This is a bounded operational game-player claim, not a claim of consciousness, personhood, human-like understanding, or general game-playing competence.

## Automated evidence

GitHub Actions run `floorborn-proof` #46 on the v0.3 PR lane completed successfully with:

- **24 tests passed, 0 failed**;
- original v0.1 bounded-player proof still passing;
- original v0.2 shared co-op proof still passing;
- v0.3 hidden expedition tests passing;
- live expedition bridge tests passing;
- first-proof demo passing;
- expedition player-gate demo passing.

The workflow was subsequently moved from Node 20 to Node 24 because GitHub Actions reports Node 20 deprecation for action runtimes. The package baseline now matches Node 24+.

## Hidden-layout autonomy gate

Across seeds 0-15, a fresh Floorborn player completed every expedition inside the 40-turn budget. The world changes which regions contain two required seals, one optional relic, and one trap. Hidden content is not exposed before inspection.

Different layouts produce different action histories. Exact receipts replay to the same final public states.

## Learning gate

A legitimate bad Archive experience can alter the first route in a later world. Decision evidence shows the learned `ancient` / `knowledge` contribution.

During development this exposed an overgeneralization: learned aversion to `ancient` could also suppress travel to an `ancient` goal location. v0.3 repairs that by representing explicit `goal` relevance separately from surface-tag memory. The learned aversion remains visible; it is not silently deleted.

## Shared-world disturbance gate

A second legal player can change shared world state while Floorborn is playing. Floorborn continues from the resulting observation rather than requiring a prerecorded action sequence.

## Blind live run

See `LIVE_EXPEDITION_SESSION_001.md`.

A working neural chat and `floorborn-001` completed a seed-hidden 13-turn expedition together. Floorborn independently explored, found and gathered a seal, signaled `found-seal`, converged on the goal-marked Gate, and selected `signal:open-gate` after the chat deliberately chose `wait:gate`.

After completion the hidden seed was revealed and all 13 receipts were replayed against a fresh game. Final public state matched exactly.

## Next research depth

Do not interpret v0.3 as the end of Floorborn research. It establishes the player substrate strongly enough that future work can stop asking only "can the floor play?" and start asking "what kind of player does this floor become?"

Next depth should focus on:

- optional/self-selected goals;
- richer bounded communication;
- mistakes and recovery;
- cross-session companion memory;
- longer-horizon plans;
- blind/adversarial world variants;
- only after that, adapters to RTS, shooter, survival, puzzle, and other genres.
