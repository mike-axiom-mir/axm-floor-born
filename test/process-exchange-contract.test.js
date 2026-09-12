import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FLOORBORN_PROCESS_EXCHANGE_VERIFICATION_SCHEMA,
  FLOORBORN_PROCESS_REQUEST_SCHEMA,
  processFloorbornRequest,
  verifyProcessExchange,
  verifyProcessResponse,
} from '../src/capability.js';
import { digest } from '../src/stable.js';

function decisionRequest(placeId) {
  return {
    schema: FLOORBORN_PROCESS_REQUEST_SCHEMA,
    operation: 'decide',
    player: {
      playerId: 'exchange-floorborn',
      lineageId: 'exchange-lineage',
    },
    observation: {
      protocol: 'axm.player.v0.1',
      sessionId: 'exchange-session',
      turn: 0,
      self: { playerId: 'exchange-floorborn' },
      place: { id: placeId, known: true },
      legalActions: [
        { id: `move:${placeId}`, kind: 'move', target: placeId, affordanceTags: ['optional'] },
        { id: 'wait:hold', kind: 'wait', affordanceTags: [] },
      ],
    },
  };
}

test('sealed process response is bound to the exact admitted request', () => {
  const admittedRequest = decisionRequest('north');
  const differentRequest = decisionRequest('south');
  const response = processFloorbornRequest(admittedRequest);

  assert.equal(verifyProcessResponse(response), true, 'the existing response bytes are internally sealed');
  assert.notEqual(digest(admittedRequest), digest(differentRequest), 'the two admitted requests have distinct identities');
  assert.equal(
    response.receipt.requestSha256,
    digest(admittedRequest),
    'the response receipt must retain which exact request caused it',
  );

  const admitted = verifyProcessExchange({ request: admittedRequest, response });
  assert.equal(admitted.schema, FLOORBORN_PROCESS_EXCHANGE_VERIFICATION_SCHEMA);
  assert.equal(admitted.result, 'PASS');
  assert.deepEqual(admitted.problems, []);
  assert.equal(admitted.truth.exactRequestIdentityVerified, true);
  assert.equal(admitted.truth.deterministicReplayVerified, true);

  const substituted = verifyProcessExchange({ request: differentRequest, response });
  assert.equal(substituted.result, 'HOLD');
  assert.ok(substituted.problems.includes('REQUEST_IDENTITY_MISMATCH'));
  assert.ok(substituted.problems.includes('DETERMINISTIC_REPLAY_MISMATCH'));
});

test('a self-consistent re-seal cannot replace deterministic exchange replay', () => {
  const request = decisionRequest('north');
  const response = processFloorbornRequest(request);
  const forged = structuredClone(response);
  forged.action = { id: 'wait:hold', kind: 'wait', affordanceTags: [] };
  const { receipt, ...forgedBody } = forged;
  forged.receipt.responseSha256 = digest(forgedBody);

  assert.equal(verifyProcessResponse(forged), true, 'the forged body is internally self-consistent');
  const verification = verifyProcessExchange({ request, response: forged });
  assert.equal(verification.result, 'HOLD');
  assert.deepEqual(verification.problems, ['DETERMINISTIC_REPLAY_MISMATCH']);
  assert.equal(verification.truth.responseContentIntegrityVerified, true);
  assert.equal(verification.truth.exactRequestIdentityVerified, true);
  assert.equal(verification.truth.deterministicReplayVerified, false);
  assert.equal(verification.authority, 'VERIFY_ONLY_NO_EXECUTION_NO_GAME_MUTATION_NO_MERGE_NO_CANON');
});

test('describe, learn, and complete exchanges retain their own causal request identity', () => {
  const decisionRequestValue = decisionRequest('north');
  const decision = processFloorbornRequest(decisionRequestValue);
  const requests = [
    {
      schema: FLOORBORN_PROCESS_REQUEST_SCHEMA,
      operation: 'describe',
    },
    {
      schema: FLOORBORN_PROCESS_REQUEST_SCHEMA,
      operation: 'learn',
      playerSnapshot: decision.playerSnapshot,
      receipt: {
        playerId: 'exchange-floorborn',
        turn: 0,
        action: decision.action,
        outcome: {
          eventId: 'exchange-session:move-north',
          utility: 1,
          novelty: 1,
          placeId: 'north',
        },
      },
    },
    {
      schema: FLOORBORN_PROCESS_REQUEST_SCHEMA,
      operation: 'complete',
      playerSnapshot: decision.playerSnapshot,
      sessionId: 'exchange-session',
    },
  ];

  for (const request of requests) {
    const response = processFloorbornRequest(request);
    assert.equal(response.receipt.requestSha256, digest(request));
    assert.equal(verifyProcessExchange({ request, response }).result, 'PASS');
  }
});
