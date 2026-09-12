import assert from 'node:assert/strict';
import test from 'node:test';

import { createConsoleRuntime, startConsoleServer } from '../observer/server.js';

function assertPrivateBoundary(view) {
  assert.deepEqual(view.boundary, {
    authority: 'PLAYER_ACTION_ONLY',
    hostSnapshotExposed: false,
    floorbornDecisionTraceExposed: false,
    hiddenDoctrineExposed: false,
  });
  assert.equal('floorborn' in view, false);
  assert.equal('snapshot' in view, false);
  assert.equal('floorbornDecisionReceipts' in view, false);
  assert.equal('hiddenDoctrineByPlayer' in view, false);
}

test('console exposes only the current chat observation and accepts only listed legal actions', () => {
  const runtime = createConsoleRuntime({ sessionId: 'console-contract-001' });
  const before = runtime.view();
  assert.equal(before.complete, false);
  assert.equal(before.observation.self.playerId, 'chat-001');
  assert.ok(before.legalActions.length > 0);
  assertPrivateBoundary(before);

  const action = before.legalActions[0];
  const after = runtime.act(action.id);
  assert.ok(after.transcript.length > before.transcript.length);
  assertPrivateBoundary(after);
  assert.throws(() => runtime.act('command:not-in-observation'), /not legal/);
});

test('reset returns the exact opening player-facing view for the same session id', () => {
  const runtime = createConsoleRuntime({ sessionId: 'console-reset-001' });
  const opening = runtime.view();
  runtime.act(opening.legalActions[0].id);
  const reset = runtime.reset();
  assert.deepEqual(reset, opening);
});

test('loopback HTTP surface serves no-store UI and drives the real contested runtime', async (t) => {
  const server = await startConsoleServer({ port: 0, sessionId: 'console-http-001' });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  const page = await fetch(`${origin}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(await page.text(), /Live Contested Console/);

  const initialResponse = await fetch(`${origin}/api/view`);
  const initial = await initialResponse.json();
  assert.equal(initialResponse.headers.get('cache-control'), 'no-store');
  assertPrivateBoundary(initial);

  const action = initial.legalActions[0].id;
  const actionResponse = await fetch(`${origin}/api/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId: action }),
  });
  assert.equal(actionResponse.status, 200);
  const after = await actionResponse.json();
  assert.ok(after.transcript.length > initial.transcript.length);

  const illegalResponse = await fetch(`${origin}/api/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId: 'hidden-admin-action' }),
  });
  assert.equal(illegalResponse.status, 400);
});
