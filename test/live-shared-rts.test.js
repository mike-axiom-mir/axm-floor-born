import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applySharedRtsChatAction,
  createLiveSharedRts,
  liveSharedRtsView,
  revealCompletedSharedRts,
} from '../src/live-shared-rts.js';
import { replaySharedRts } from '../src/shared-rts.js';

test('live shared RTS gives Floorborn an independent first command then exposes only the chat player boundary', () => {
  const live = createLiveSharedRts({ sessionId: 'live-shared-rts-start' });
  const view = liveSharedRtsView(live);

  assert.equal(view.complete, false);
  assert.equal(view.transcript[0].actor, 'floorborn');
  assert.equal(view.transcript[0].actionId, 'command:build:power-node');
  assert.ok(view.chatObservation);
  assert.equal(view.chatObservation.protocol, 'axm.player.rts.v0.1');
  assert.equal(view.chatObservation.self.playerId, 'chat-001');
  assert.equal(view.chatObservation.rts.budgetRemaining, 2);
  assert.equal(JSON.stringify(view.chatObservation).includes('hidden-floorborn-doctrine'), false);
});

test('chat world mutation can change what Floorborn later discovers through its own legal command', () => {
  let live = createLiveSharedRts({ sessionId: 'live-shared-rts-interaction' });
  let view = liveSharedRtsView(live);

  assert.ok(view.chatObservation.legalActions.some((action) => action.id === 'command:move:army-pair:center'));
  live = applySharedRtsChatAction(live, 'command:move:army-pair:center');
  view = liveSharedRtsView(live);

  const floorTurns = view.transcript.filter((entry) => entry.actor === 'floorborn');
  assert.equal(floorTurns.at(-1).actionId, 'command:scout:center');

  const floorState = live.game.players['floorborn-001'];
  const chatState = live.game.players['chat-001'];
  assert.equal(floorState.scouted.center, true);
  assert.equal(chatState.groups['army-alpha'].position, 'center');
  assert.equal(chatState.groups['army-beta'].position, 'center');
});

test('working chat and Floorborn can independently complete the same shared RTS objective under separate budgets', () => {
  let live = createLiveSharedRts({ sessionId: 'live-shared-rts-complete' });

  live = applySharedRtsChatAction(live, 'command:move:army-pair:center');
  let view = liveSharedRtsView(live);
  assert.equal(view.chatObservation.rts.windowIndex, 1);
  assert.equal(view.chatObservation.rts.budgetRemaining, 2);

  live = applySharedRtsChatAction(live, 'command:build:power-node');
  view = liveSharedRtsView(live);
  assert.ok(view.chatObservation.legalActions.some((action) => action.id === 'command:scout:center'));

  live = applySharedRtsChatAction(live, 'command:scout:center');
  view = liveSharedRtsView(live);
  assert.equal(view.complete, true);
  assert.equal(view.chatObservation, null);

  const completed = revealCompletedSharedRts(live);
  const floorState = completed.publicState.players['floorborn-001'];
  const chatState = completed.publicState.players['chat-001'];
  assert.equal(floorState.powerNodes, 1);
  assert.equal(floorState.scouted.center, true);
  assert.equal(chatState.powerNodes, 1);
  assert.equal(chatState.scouted.center, true);

  const floorSpent = completed.receipts
    .filter((receipt) => receipt.playerId === 'floorborn-001')
    .reduce((sum, receipt) => sum + receipt.effectiveCost, 0);
  const chatSpent = completed.receipts
    .filter((receipt) => receipt.playerId === 'chat-001')
    .reduce((sum, receipt) => sum + receipt.effectiveCost, 0);

  assert.equal(floorSpent, 3);
  assert.equal(chatSpent, 4);

  const replayed = replaySharedRts({
    sessionId: completed.sessionId,
    receipts: completed.receipts,
  });
  assert.deepEqual(replayed, completed.publicState);
});
