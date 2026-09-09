# Portable bounded-player process

This lane exposes the existing deterministic Floorborn chooser through one narrow local package/process seam. It does **not** move the game engine into Floorborn and does not let Floorborn mutate a consumer game directly.

## Boundary

Capability ID: `axm.floorborn.bounded-player-process`

The consumer remains responsible for constructing an already-bounded player observation using `axm.player.v0.1` or `axm.player.rts.v0.1`. Floorborn validates the existing protocol shape, chooses only from the supplied `legalActions`, and returns the selected action as a **candidate**. The host must still admit and apply that action through its own ordinary player door.

The process returns a caller-owned Floorborn snapshot after each state-changing operation. That makes continuity portable without a daemon, account, cloud service, AI model, or hidden background state.

The response receipt SHA-256 binds the deterministic response body. It is content-integrity evidence only; it does not authenticate the provider, authorize game mutation, approve a merge, or establish CANON.

## Library use

This package remains `private: true`; the seam is for explicit local/path/tarball consumption, not registry publication.

```js
import {
  processFloorbornRequest,
  verifyProcessResponse,
} from 'axm-floor-born';

const response = processFloorbornRequest({
  schema: 'axm.floorborn.process-request/v0.1',
  operation: 'decide',
  player: {
    playerId: 'floorborn-local',
    lineageId: 'local-lineage-001',
  },
  observation: playerVisibleObservation,
});

if (!verifyProcessResponse(response)) throw new Error('response drift');
// response.action is still only a candidate. The game owns admission/execution.
```

## CLI use

```bash
node bin/floorborn-player.js describe
printf '%s' "$REQUEST_JSON" | node bin/floorborn-player.js process
```

After a local tarball install, the same commands are available through `axm-floorborn-player`.

The CLI accepts at most 1 MiB on stdin, one JSON value per invocation, writes one deterministic JSON response on stdout, and exits with status 2 plus a bounded JSON error on invalid input.

## Operations

- `describe`: return the capability contract and authority boundary.
- `decide`: create/restore a Floorborn identity, admit one bounded observation, and return a selected legal action plus updated inspectable player state.
- `learn`: apply one explicit game receipt to a caller-supplied Floorborn snapshot.
- `complete`: explicitly record a completed session in a caller-supplied Floorborn snapshot.

No operation auto-selects this provider for a consumer, runs network access, applies an action to a game, publishes a package, merges a branch, or declares CANON.
