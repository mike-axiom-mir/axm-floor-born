import assert from 'node:assert/strict';

import {
  applySharedRtsChatAction,
  createLiveSharedRts,
  liveSharedRtsView,
  revealCompletedSharedRts,
} from '../src/live-shared-rts.js';
import { replaySharedRts } from '../src/shared-rts.js';

const CHAT_CHOICES = [
  'command:move:army-alpha:center',
  'command:scout:center',
  'command:build:power-node',
];

let live = createLiveSharedRts({ sessionId: 'live-shared-rts-session-001' });

for (const [index, actionId] of CHAT_CHOICES.entries()) {
  const view = liveSharedRtsView(live);
  assert.equal(view.complete, false, `session completed before chat choice ${index + 1}`);
  assert.ok(view.chatObservation, `chat observation missing before choice ${index + 1}`);

  const legalIds = view.chatObservation.legalActions.map((action) => action.id);
  assert.ok(legalIds.includes(actionId), `${actionId} must be legal before choice ${index + 1}`);

  console.log(`CHAT VIEW BEFORE CHOICE ${index + 1}`);
  console.log(JSON.stringify(view, null, 2));
  console.log(`CHAT CHOICE ${index + 1}: ${actionId}`);

  live = applySharedRtsChatAction(live, actionId);
}

const finalView = liveSharedRtsView(live);
assert.equal(finalView.complete, true);

const completed = revealCompletedSharedRts(live);
const replayed = replaySharedRts({
  sessionId: completed.sessionId,
  receipts: completed.receipts,
});
assert.deepEqual(replayed, completed.publicState);

const floorbornScoutIndex = completed.transcript.findIndex((entry) => (
  entry.actor === 'floorborn' && entry.actionId === 'command:scout:center'
));
const chatMoveIndex = completed.transcript.findIndex((entry) => (
  entry.actor === 'chat' && entry.actionId === 'command:move:army-alpha:center'
));
assert.ok(chatMoveIndex >= 0);
assert.ok(floorbornScoutIndex > chatMoveIndex);

const floorSpent = completed.receipts
  .filter((receipt) => receipt.playerId === 'floorborn-001')
  .reduce((sum, receipt) => sum + receipt.effectiveCost, 0);
const chatSpent = completed.receipts
  .filter((receipt) => receipt.playerId === 'chat-001')
  .reduce((sum, receipt) => sum + receipt.effectiveCost, 0);

console.log('LIVE SHARED RTS SESSION 001 RESULT');
console.log(JSON.stringify({
  status: 'PASS',
  chatChoices: CHAT_CHOICES,
  floorbornObservedSharedWorldAfterChatMove: true,
  floorbornEffectiveActionsSpent: floorSpent,
  chatEffectiveActionsSpent: chatSpent,
  finalState: completed.publicState,
  transcript: completed.transcript,
  replay: 'PASS',
}, null, 2));
