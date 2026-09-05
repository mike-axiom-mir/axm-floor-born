import test from 'node:test';
import assert from 'node:assert/strict';

import { StateRecoveryContestedRtsSession } from '../src/state-recovery-contested-rts.js';

function actionById(game, playerId, actionId) {
  const action = game.observe(playerId).legalActions.find((candidate) => candidate.id === actionId);
  assert.ok(action, `${actionId} should be legal for ${playerId}`);
  return action;
}

test('unscouted live contested fog remains identical before and after snapshot restore', () => {
  const game = new StateRecoveryContestedRtsSession({
    sessionId: 'v16-fog-resume-parity',
    playerIds: ['floorborn-001', 'chat-001'],
  });

  game.step(
    'floorborn-001',
    actionById(game, 'floorborn-001', 'command:move:army-alpha:center'),
  );

  const direct = game.observe('chat-001');
  assert.equal(direct.rts.centerScouted, false);
  assert.equal(direct.rts.centerPresence.length, 0);
  assert.deepEqual(direct.rts.visibleEnemyContacts, []);

  const restored = new StateRecoveryContestedRtsSession({
    sessionId: 'v16-fog-resume-parity',
    playerIds: ['floorborn-001', 'chat-001'],
    snapshot: JSON.parse(JSON.stringify(game.snapshot())),
  });
  const resumed = restored.observe('chat-001');

  assert.equal(resumed.rts.centerScouted, false);
  assert.equal(resumed.rts.centerPresence.length, 0);
  assert.deepEqual(resumed.rts.visibleEnemyContacts, []);
  assert.deepEqual(resumed.rts.visibleEnemyContacts, direct.rts.visibleEnemyContacts);
});
