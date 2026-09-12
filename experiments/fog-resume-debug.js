import assert from 'node:assert/strict';

import { StateRecoveryContestedRtsSession } from '../src/state-recovery-contested-rts.js';

const game = new StateRecoveryContestedRtsSession({
  sessionId: 'v16-fog-resume-debug',
  playerIds: ['floorborn-001', 'chat-001'],
});

const move = game.observe('floorborn-001').legalActions.find(
  (action) => action.id === 'command:move:army-alpha:center',
);
assert.ok(move);
game.step('floorborn-001', move);

const direct = game.observe('chat-001');
const snapshot = JSON.parse(JSON.stringify(game.snapshot()));
const restoredGame = new StateRecoveryContestedRtsSession({
  sessionId: 'v16-fog-resume-debug',
  playerIds: ['floorborn-001', 'chat-001'],
  snapshot,
});
const resumed = restoredGame.observe('chat-001');

console.log(JSON.stringify({
  direct: {
    centerScouted: direct.rts.centerScouted,
    centerPresence: direct.rts.centerPresence,
    visibleEnemyContacts: direct.rts.visibleEnemyContacts,
    ownGroups: direct.rts.ownGroups,
  },
  resumed: {
    centerScouted: resumed.rts.centerScouted,
    centerPresence: resumed.rts.centerPresence,
    visibleEnemyContacts: resumed.rts.visibleEnemyContacts,
    ownGroups: resumed.rts.ownGroups,
  },
  snapshotPlayerState: snapshot.players['chat-001'],
}, null, 2));
