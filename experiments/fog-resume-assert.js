import assert from 'node:assert/strict';

import { StateRecoveryContestedRtsSession } from '../src/state-recovery-contested-rts.js';

const mode = process.argv[2];
if (!['direct', 'resumed'].includes(mode)) throw new Error('mode must be direct or resumed');

const game = new StateRecoveryContestedRtsSession({
  sessionId: 'v16-fog-binary-assert',
  playerIds: ['floorborn-001', 'chat-001'],
});
const move = game.observe('floorborn-001').legalActions.find(
  (action) => action.id === 'command:move:army-alpha:center',
);
assert.ok(move);
game.step('floorborn-001', move);

const direct = game.observe('chat-001');
const restoredGame = new StateRecoveryContestedRtsSession({
  sessionId: 'v16-fog-binary-assert',
  playerIds: ['floorborn-001', 'chat-001'],
  snapshot: JSON.parse(JSON.stringify(game.snapshot())),
});
const resumed = restoredGame.observe('chat-001');

const observation = mode === 'direct' ? direct : resumed;
assert.equal(observation.rts.centerScouted, false);
assert.equal(observation.rts.centerPresence.length, 0);
assert.deepEqual(observation.rts.visibleEnemyContacts, []);
