import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

test('CLI rejects duplicate top-level object members before semantic admission', () => {
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

test('CLI rejects malformed UTF-8 bytes before semantic admission', () => {
  const input = Buffer.from(requestText(), 'utf8');
  const marker = Buffer.from('cli-json-lineage', 'utf8');
  const markerOffset = input.indexOf(marker);
  assert.notEqual(markerOffset, -1);

  // Replace one otherwise valid lineage byte with an invalid standalone UTF-8 byte.
  // The semantic request accepts arbitrary non-empty lineage strings, so replacement
  // decoding would silently turn these different bytes into a U+FFFD-containing value.
  input[markerOffset + marker.length - 1] = 0xff;

  const run = runCli(input);
  assert.equal(run.status, 2, `malformed UTF-8 must fail closed; stdout=${run.stdout} stderr=${run.stderr}`);
  assert.equal(run.stdout, '');
  const error = JSON.parse(run.stderr);
  assert.equal(error.schema, 'axm.floorborn.process-error/v0.1');
  assert.equal(error.ok, false);
  assert.equal(error.error.code, 'INVALID_REQUEST');
  assert.match(error.error.message, /UTF-8/);
  assert.equal(error.authority, 'NO_EXECUTION_NO_MERGE_NO_CANON');
});

test('CLI stops consuming stdin immediately after the byte ceiling is crossed', () => {
  const directory = mkdtempSync(join(tmpdir(), 'floorborn-bounded-stdin-'));
  const inputPath = join(directory, 'oversized-input.bin');
  const input = Buffer.alloc((1024 * 1024) + 2, 0x61);
  input[input.length - 1] = 0x7a;
  writeFileSync(inputPath, input);

  const inputFd = openSync(inputPath, 'r');
  try {
    const run = spawnSync(process.execPath, ['bin/floorborn-player.js', 'process'], {
      cwd: new URL('..', import.meta.url),
      stdio: [inputFd, 'pipe', 'pipe'],
      encoding: 'utf8',
    });

    assert.equal(run.status, 2, `oversized stdin must fail closed; stdout=${run.stdout} stderr=${run.stderr}`);
    assert.equal(run.stdout, '');
    assert.match(JSON.parse(run.stderr).error.message, /1048576 byte limit/);

    const unread = Buffer.alloc(1);
    assert.equal(
      readSync(inputFd, unread, 0, unread.length, null),
      1,
      'the CLI must not consume the complete invalid stream before rejecting it',
    );
    assert.equal(unread[0], 0x7a, 'only limit + 1 bytes should have been consumed');
  } finally {
    closeSync(inputFd);
    rmSync(directory, { recursive: true, force: true });
  }
});
