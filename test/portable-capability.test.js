import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import {
  describeCapability,
  FLOORBORN_CAPABILITY_ID,
  FLOORBORN_PROCESS_REQUEST_SCHEMA,
  processFloorbornRequest,
  verifyProcessExchange,
  verifyProcessResponse,
} from '../src/capability.js';

function observation() {
  return {
    protocol: 'axm.player.v0.1',
    sessionId: 'portable-consumer-001',
    turn: 0,
    self: { playerId: 'floorborn-portable' },
    place: { id: 'start', known: true },
    legalActions: [
      {
        id: 'move:north',
        kind: 'move',
        target: 'north',
        affordanceTags: ['optional'],
      },
      {
        id: 'wait:hold',
        kind: 'wait',
        affordanceTags: [],
      },
    ],
  };
}

function firstDecisionRequest() {
  return {
    schema: FLOORBORN_PROCESS_REQUEST_SCHEMA,
    operation: 'decide',
    player: {
      playerId: 'floorborn-portable',
      lineageId: 'portable-lineage-001',
    },
    observation: observation(),
  };
}

test('capability descriptor is bounded, offline, and metadata-aligned', () => {
  const descriptor = describeCapability();
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(descriptor.id, FLOORBORN_CAPABILITY_ID);
  assert.equal(descriptor.status, 'EXPERIMENTAL');
  assert.equal(descriptor.runtime.node, '>=24');
  assert.equal(descriptor.runtime.dependencies, 0);
  assert.equal(descriptor.runtime.network, false);
  assert.equal(descriptor.runtime.account, false);
  assert.equal(descriptor.runtime.aiModel, false);
  assert.deepEqual(descriptor.authority, {
    automaticSelection: false,
    canon: false,
    execution: false,
    gameMutation: false,
    merge: false,
    publication: false,
  });
  assert.equal(pkg.private, true);
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.capability.id, descriptor.id);
  assert.equal(pkg.capability.status, descriptor.status);
});

test('same admitted observation and identity produce the same sealed decision', () => {
  const left = processFloorbornRequest(firstDecisionRequest());
  const right = processFloorbornRequest(firstDecisionRequest());

  assert.deepEqual(left, right);
  assert.equal(left.action.id, 'move:north');
  assert.equal(left.action.kind, 'move');
  assert.equal(left.operation, 'decide');
  assert.equal(left.playerSnapshot.playerId, 'floorborn-portable');
  assert.equal(left.playerSnapshot.lineageId, 'portable-lineage-001');
  assert.equal(verifyProcessResponse(left), true);
  assert.equal(verifyProcessExchange({ request: firstDecisionRequest(), response: left }).result, 'PASS');
});

test('learning crosses the process boundary only through an explicit receipt', () => {
  const decision = processFloorbornRequest(firstDecisionRequest());
  const learned = processFloorbornRequest({
    schema: FLOORBORN_PROCESS_REQUEST_SCHEMA,
    operation: 'learn',
    playerSnapshot: decision.playerSnapshot,
    receipt: {
      playerId: 'floorborn-portable',
      turn: 0,
      action: decision.action,
      outcome: {
        eventId: 'portable-consumer:move-north',
        utility: 1,
        novelty: 1,
        placeId: 'north',
      },
    },
  });

  assert.equal(learned.playerSnapshot.memory.actionsObserved, 1);
  assert.equal(learned.playerSnapshot.memory.episodes.length, 1);
  assert.equal(learned.playerSnapshot.memory.seenPlaces.north, 1);
  assert.equal(verifyProcessResponse(learned), true);
});

test('receipt verification detects response drift', () => {
  const response = processFloorbornRequest(firstDecisionRequest());
  const tampered = structuredClone(response);
  tampered.action.id = 'wait:hold';
  assert.equal(verifyProcessResponse(tampered), false);
});

test('identity mismatch and undeclared request fields fail closed', () => {
  assert.throws(
    () => processFloorbornRequest({
      ...firstDecisionRequest(),
      observation: {
        ...observation(),
        self: { playerId: 'someone-else' },
      },
    }),
    /must match the Floorborn player identity/,
  );

  assert.throws(
    () => processFloorbornRequest({
      ...firstDecisionRequest(),
      autoApplyToGame: true,
    }),
    /unexpected request field/,
  );
});

test('CLI executes the same process contract without a package import', () => {
  const run = spawnSync(process.execPath, ['bin/floorborn-player.js', 'process'], {
    cwd: new URL('..', import.meta.url),
    input: JSON.stringify(firstDecisionRequest()),
    encoding: 'utf8',
  });

  assert.equal(run.status, 0, run.stderr);
  const response = JSON.parse(run.stdout);
  assert.equal(response.action.id, 'move:north');
  assert.equal(response.receipt.authority, 'CONTENT_INTEGRITY_ONLY_NO_EXECUTION_NO_MERGE_NO_CANON');
  assert.equal(verifyProcessResponse(response), true);
});
