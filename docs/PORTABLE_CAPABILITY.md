# Portable bounded-player process

This lane exposes the existing deterministic Floorborn chooser through one narrow local package/process seam. It does **not** move the game engine into Floorborn and does not let Floorborn mutate a consumer game directly.

## Boundary

Capability ID: `axm.floorborn.bounded-player-process`

The consumer remains responsible for constructing an already-bounded player observation using `axm.player.v0.1` or `axm.player.rts.v0.1`. Floorborn validates the existing protocol shape, chooses only from the supplied `legalActions`, and returns the selected action as a **candidate**. The host must still admit and apply that action through its own ordinary player door.

The process returns a caller-owned Floorborn snapshot after each state-changing operation. That makes continuity portable without a daemon, account, cloud service, AI model, or hidden background state.

The v0.2 response receipt binds both the deterministic response body and the exact canonical request identity. `verifyProcessResponse()` checks internal response integrity. `verifyProcessExchange()` additionally re-executes the exact request and requires the complete response to match, so a valid response from another request or a self-consistently re-sealed false result is held. Replay remains local, deterministic verification only; it does not authenticate the provider, authorize game mutation, approve a merge, or establish CANON.

## Library use

This package remains `private: true`; the seam is for explicit local/path/tarball consumption, not registry publication.

```js
import {
  processFloorbornRequest,
  verifyProcessExchange,
} from 'axm-floor-born';

const request = {
  schema: 'axm.floorborn.process-request/v0.1',
  operation: 'decide',
  player: {
    playerId: 'floorborn-local',
    lineageId: 'local-lineage-001',
  },
  observation: playerVisibleObservation,
};
const response = processFloorbornRequest(request);

const verification = verifyProcessExchange({ request, response });
if (verification.result !== 'PASS') throw new Error(verification.problems.join(', '));
// response.action is still only a candidate. The game owns admission/execution.
```

## CLI use

```bash
node bin/floorborn-player.js describe
printf '%s' "$REQUEST_JSON" | node bin/floorborn-player.js process
```

After a local tarball install, the same commands are available through `axm-floorborn-player`.

The CLI accepts at most 1 MiB on stdin, one JSON value per invocation, writes one deterministic JSON response on stdout, and exits with status 2 plus a bounded JSON error on invalid input. Before semantic request admission it also rejects duplicate object-member names at every JSON depth, including escaped spellings that decode to the same member name. This prevents last-key-wins parsing from erasing contradictory raw input.

That duplicate-member guarantee belongs specifically to the CLI byte boundary. Library callers pass already-materialized JavaScript objects to `processFloorbornRequest()`, so duplicate textual members that an upstream parser already collapsed cannot be reconstructed or rejected there.

## Operations

- `describe`: return the capability contract and authority boundary.
- `decide`: create/restore a Floorborn identity, admit one bounded observation, and return a selected legal action plus updated inspectable player state.
- `learn`: apply one explicit game receipt to a caller-supplied Floorborn snapshot.
- `complete`: explicitly record a completed session in a caller-supplied Floorborn snapshot.

No operation auto-selects this provider for a consumer, runs network access, applies an action to a game, publishes a package, merges a branch, or declares CANON.
