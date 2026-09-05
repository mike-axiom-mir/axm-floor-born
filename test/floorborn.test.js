import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import { assertLegalAction } from '../src/protocol.js';
import { replaySession, runSession, TinyRpgSession } from '../src/rpg.js';

function firstChoice(player, sessionId) {
  const result = runSession({ player, scenario: 'crossroads', sessionId });
  return result.receipts[0].action.id;
}

test('observation is bounded and does not expose hidden world internals', () => {
  const game = new TinyRpgSession({ scenario: 'ruins-lesson', playerId: 'p', sessionId: 's' });
  const observation = game.observe();
  assert.equal('world' in observation, false);
  assert.equal('hiddenDiscovery' in observation.place, false);
  assert.equal(JSON.stringify(observation).includes('sealed-cache'), false);
});

test('protocol rejects an action that was not offered to the player', () => {
  const game = new TinyRpgSession({ scenario: 'crossroads', playerId: 'p', sessionId: 's' });
  const observation = game.observe();
  assert.throws(
    () => assertLegalAction({ id: 'teleport:moon', kind: 'move', target: 'moon', affordanceTags: [] }, observation),
    /illegal action/,
  );
});

test('fresh Floorborn decisions are deterministic', () => {
  const a = new FloorbornPlayer({ playerId: 'a' });
  const b = new FloorbornPlayer({ playerId: 'b' });
  assert.equal(firstChoice(a, 'a-eval'), firstChoice(b, 'b-eval'));
});

test('fresh Floorborn chooses forest at the equal crossroads tie', () => {
  const player = new FloorbornPlayer({ playerId: 'fresh' });
  assert.equal(firstChoice(player, 'fresh-eval'), 'move:forest');
});

test('retained game experience changes a later legal choice', () => {
  const player = new FloorbornPlayer({ playerId: 'experienced' });
  runSession({ player, scenario: 'ruins-lesson', sessionId: 'lesson' });
  assert.equal(firstChoice(player, 'experienced-eval'), 'move:ruins');
});

test('Floorborn memory survives snapshot and restore', () => {
  const original = new FloorbornPlayer({ playerId: 'persistent' });
  runSession({ player: original, scenario: 'ruins-lesson', sessionId: 'lesson' });
  const restored = FloorbornPlayer.restore(original.snapshot());
  assert.deepEqual(restored.snapshot(), original.snapshot());
  assert.equal(firstChoice(restored, 'restored-eval'), 'move:ruins');
});

test('decision trace exposes why memory affected arbitration', () => {
  const player = new FloorbornPlayer({ playerId: 'trace' });
  runSession({ player, scenario: 'ruins-lesson', sessionId: 'lesson' });
  runSession({ player, scenario: 'crossroads', sessionId: 'eval' });
  const ruins = player.lastDecision.proposals.find((proposal) => proposal.actionId === 'move:ruins');
  assert.ok(ruins.evidence.some((line) => line.startsWith('memory:ancient=')));
});

test('recorded session receipts replay to the exact same public state', () => {
  const player = new FloorbornPlayer({ playerId: 'replay' });
  const run = runSession({ player, scenario: 'ruins-lesson', sessionId: 'replay-session' });
  const replayed = replaySession({
    scenario: 'ruins-lesson',
    playerId: 'replay',
    sessionId: 'replay-session',
    receipts: run.receipts,
  });
  assert.deepEqual(replayed, run.finalState);
});

test('game grants only one committed action per turn', () => {
  const player = new FloorbornPlayer({ playerId: 'one-action' });
  const run = runSession({ player, scenario: 'crossroads', sessionId: 'one-action-eval' });
  assert.equal(run.finalState.turn, 1);
  assert.equal(run.receipts.length, 1);
});
