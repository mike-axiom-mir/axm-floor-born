import { FloorbornPlayer } from './floorborn.js';
import {
  PLAYER_PROTOCOL_VERSION,
  RTS_PLAYER_PROTOCOL_VERSION,
  validateObservation,
} from './protocol.js';
import { digest, stableClone } from './stable.js';

export const FLOORBORN_CAPABILITY_SCHEMA = 'axm.floorborn.capability/v0.1';
export const FLOORBORN_CAPABILITY_ID = 'axm.floorborn.bounded-player-process';
export const FLOORBORN_PROCESS_REQUEST_SCHEMA = 'axm.floorborn.process-request/v0.1';
export const FLOORBORN_PROCESS_RESPONSE_SCHEMA = 'axm.floorborn.process-response/v0.1';
export const FLOORBORN_PROCESS_RECEIPT_SCHEMA = 'axm.floorborn.process-receipt/v0.1';

const AUTHORITY = Object.freeze({
  automaticSelection: false,
  canon: false,
  execution: false,
  gameMutation: false,
  merge: false,
  publication: false,
});

const CAPABILITY = Object.freeze({
  schema: FLOORBORN_CAPABILITY_SCHEMA,
  id: FLOORBORN_CAPABILITY_ID,
  status: 'EXPERIMENTAL',
  purpose: 'Choose a legal action from a caller-supplied bounded player observation while retaining inspectable Floorborn state.',
  runtime: {
    node: '>=24',
    dependencies: 0,
    network: false,
    account: false,
    aiModel: false,
  },
  process: {
    requestSchema: FLOORBORN_PROCESS_REQUEST_SCHEMA,
    responseSchema: FLOORBORN_PROCESS_RESPONSE_SCHEMA,
    receiptSchema: FLOORBORN_PROCESS_RECEIPT_SCHEMA,
    operations: ['describe', 'decide', 'learn', 'complete'],
    maxCliInputBytes: 1048576,
  },
  playerProtocols: [PLAYER_PROTOCOL_VERSION, RTS_PLAYER_PROTOCOL_VERSION],
  boundary: {
    observationAdmission: 'CALLER_OWNS_PLAYER_VISIBLE_OBSERVATION_BOUNDARY',
    selectedAction: 'CANDIDATE_ONLY_HOST_MUST_APPLY_THROUGH_GAME_PLAYER_DOOR',
    retainedState: 'CALLER_OWNED_LOCAL_SNAPSHOT',
    receipt: 'CONTENT_INTEGRITY_NOT_AUTHOR_AUTHENTICATION',
  },
  authority: AUTHORITY,
});

export function describeCapability() {
  return stableClone(CAPABILITY);
}

export function processFloorbornRequest(request) {
  assertPlainObject(request, 'request');
  assertExactKeys(request, ['schema', 'operation', 'observation', 'player', 'playerSnapshot', 'receipt', 'sessionId']);
  if (request.schema !== FLOORBORN_PROCESS_REQUEST_SCHEMA) {
    throw new Error('unsupported Floorborn process request schema');
  }

  switch (request.operation) {
    case 'describe':
      assertAllowedKeys(request, ['schema', 'operation']);
      return sealResponse({
        schema: FLOORBORN_PROCESS_RESPONSE_SCHEMA,
        ok: true,
        operation: 'describe',
        capability: describeCapability(),
        authority: AUTHORITY,
      });
    case 'decide':
      assertAllowedKeys(request, ['schema', 'operation', 'observation', 'player', 'playerSnapshot']);
      return decide(request);
    case 'learn':
      assertAllowedKeys(request, ['schema', 'operation', 'playerSnapshot', 'receipt']);
      return learn(request);
    case 'complete':
      assertAllowedKeys(request, ['schema', 'operation', 'playerSnapshot', 'sessionId']);
      return complete(request);
    default:
      throw new Error(`unsupported Floorborn process operation: ${String(request.operation)}`);
  }
}

export function verifyProcessResponse(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return false;
  if (response.schema !== FLOORBORN_PROCESS_RESPONSE_SCHEMA) return false;
  if (!response.receipt || response.receipt.schema !== FLOORBORN_PROCESS_RECEIPT_SCHEMA) return false;
  if (response.receipt.authority !== 'CONTENT_INTEGRITY_ONLY_NO_EXECUTION_NO_MERGE_NO_CANON') return false;
  if (typeof response.receipt.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(response.receipt.sha256)) return false;

  const { receipt, ...body } = response;
  return digest(body) === receipt.sha256;
}

function decide(request) {
  if (!request.observation) throw new Error('decide requires observation');
  validateObservation(request.observation);
  const player = restoreOrCreatePlayer(request);
  if (request.observation.self?.playerId !== player.playerId) {
    throw new Error('observation.self.playerId must match the Floorborn player identity');
  }

  const action = player.decide(request.observation);
  return sealResponse({
    schema: FLOORBORN_PROCESS_RESPONSE_SCHEMA,
    ok: true,
    operation: 'decide',
    action,
    decision: stableClone(player.lastDecision),
    playerSnapshot: player.snapshot(),
    authority: AUTHORITY,
  });
}

function learn(request) {
  if (!request.playerSnapshot) throw new Error('learn requires playerSnapshot');
  if (!request.receipt) throw new Error('learn requires receipt');
  const player = FloorbornPlayer.restore(request.playerSnapshot);
  player.learn(request.receipt);

  return sealResponse({
    schema: FLOORBORN_PROCESS_RESPONSE_SCHEMA,
    ok: true,
    operation: 'learn',
    playerSnapshot: player.snapshot(),
    authority: AUTHORITY,
  });
}

function complete(request) {
  if (!request.playerSnapshot) throw new Error('complete requires playerSnapshot');
  if (!request.sessionId || typeof request.sessionId !== 'string') {
    throw new Error('complete requires sessionId');
  }
  const player = FloorbornPlayer.restore(request.playerSnapshot);
  player.markSessionComplete(request.sessionId);

  return sealResponse({
    schema: FLOORBORN_PROCESS_RESPONSE_SCHEMA,
    ok: true,
    operation: 'complete',
    playerSnapshot: player.snapshot(),
    authority: AUTHORITY,
  });
}

function restoreOrCreatePlayer(request) {
  if (request.playerSnapshot && request.player) {
    throw new Error('decide accepts playerSnapshot or player, not both');
  }
  if (request.playerSnapshot) return FloorbornPlayer.restore(request.playerSnapshot);
  if (!request.player) throw new Error('first decide requires explicit player identity');

  assertPlainObject(request.player, 'player');
  assertExactKeys(request.player, ['playerId', 'lineageId', 'perspectives']);
  if (!request.player.playerId || typeof request.player.playerId !== 'string') {
    throw new Error('player.playerId is required');
  }
  if (!request.player.lineageId || typeof request.player.lineageId !== 'string') {
    throw new Error('player.lineageId is required');
  }

  return new FloorbornPlayer({
    playerId: request.player.playerId,
    lineageId: request.player.lineageId,
    perspectives: request.player.perspectives ?? null,
  });
}

function sealResponse(body) {
  const stableBody = stableClone(body);
  return stableClone({
    ...stableBody,
    receipt: {
      schema: FLOORBORN_PROCESS_RECEIPT_SCHEMA,
      sha256: digest(stableBody),
      authority: 'CONTENT_INTEGRITY_ONLY_NO_EXECUTION_NO_MERGE_NO_CANON',
    },
  });
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertExactKeys(value, allowedKeys) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`unexpected request field: ${key}`);
  }
}

function assertAllowedKeys(value, keys) {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`field ${key} is not allowed for ${value.operation}`);
  }
}
