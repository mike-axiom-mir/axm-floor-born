import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FLOORBORN_PROCESS_REQUEST_SCHEMA,
  processFloorbornRequest,
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
});
