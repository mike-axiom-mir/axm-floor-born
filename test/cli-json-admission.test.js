import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function requestText() {
  return JSON.stringify({
    schema: 'axm.floorborn.process-request/v0.1',
    operation: 'decide',
    player: {
      playerId: 'cli-json-floorborn',
      lineageId: 'cli-json-lineage',
    },
    observation: {
      protocol: 'axm.player.v0.1',
      sessionId: 'cli-json-session',
      turn: 0,
      self: { playerId: 'cli-json-floorborn' },
      place: { id: 'start', known: true },
      legalActions: [
        { id: 'move:north', kind: 'move', target: 'north', affordanceTags: ['optional'] },
        { id: 'wait:hold', kind: 'wait', affordanceTags: [] },
      ],
    },
  });
}

function runCli(input) {
  return spawnSync(process.execPath, ['bin/floorborn-player.js', 'process'], {
    cwd: new URL('..', import.meta.url),
    input,
    encoding: 'utf8',
  });
}

function assertDuplicateRejected(input, expectedMember) {
  const run = runCli(input);
  assert.equal(run.status, 2, `ambiguous JSON must fail closed; stdout=${run.stdout} stderr=${run.stderr}`);
  assert.equal(run.stdout, '');
  const error = JSON.parse(run.stderr);
  assert.equal(error.schema, 'axm.floorborn.process-error/v0.1');
  assert.equal(error.ok, false);
  assert.equal(error.error.code, 'INVALID_REQUEST');
  assert.match(error.error.message, new RegExp(`duplicate JSON member: ${expectedMember}`));
  assert.equal(error.authority, 'NO_EXECUTION_NO_MERGE_NO_CANON');
}

test('CLI rejects duplicate top-level object members before last-key-wins parsing', () => {
  const ambiguous = requestText().replace(
    '"operation":"decide"',
    '"operation":"describe","operation":"decide"',
  );
  assertDuplicateRejected(ambiguous, 'operation');
});

test('CLI treats escaped-equivalent member names as duplicates', () => {
  const ambiguous = requestText().replace(
    '"operation":"decide"',
    '"operation":"describe","operati\\u006fn":"decide"',
  );
  assertDuplicateRejected(ambiguous, 'operation');
});

test('CLI rejects nested duplicate members before constructing the semantic request', () => {
  const ambiguous = requestText().replace(
    '"playerId":"cli-json-floorborn","lineageId"',
    '"playerId":"wrong-player","playerId":"cli-json-floorborn","lineageId"',
  );
  assertDuplicateRejected(ambiguous, 'playerId');
});
