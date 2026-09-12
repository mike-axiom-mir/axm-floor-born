import assert from 'node:assert/strict';

import {
  applySharedRtsChatAction,
  createLiveSharedRts,
  revealCompletedSharedRts,
} from '../src/live-shared-rts.js';
import { replaySharedRts } from '../src/shared-rts.js';

let live = createLiveSharedRts({ sessionId: 'v09-shared-rts-proof' });
live = applySharedRtsChatAction(live, 'command:move:army-pair:center');
live = applySharedRtsChatAction(live, 'command:build:power-node');
live = applySharedRtsChatAction(live, 'command:scout:center');

const completed = revealCompletedSharedRts(live);
const replayed = replaySharedRts({
  sessionId: completed.sessionId,
  receipts: completed.receipts,
});
assert.deepEqual(replayed, completed.publicState);

const floorReceipts = completed.receipts.filter((receipt) => receipt.playerId === 'floorborn-001');
const chatReceipts = completed.receipts.filter((receipt) => receipt.playerId === 'chat-001');
const floorSpent = floorReceipts.reduce((sum, receipt) => sum + receipt.effectiveCost, 0);
const chatSpent = chatReceipts.reduce((sum, receipt) => sum + receipt.effectiveCost, 0);

const floorScoutedAfterPeerMoved = completed.transcript.some((entry, index, transcript) => (
  entry.actor === 'floorborn'
  && entry.actionId === 'command:scout:center'
  && transcript.slice(0, index).some((prior) => (
    prior.actor === 'chat' && prior.actionId === 'command:move:army-pair:center'
  ))
));

assert.equal(completed.publicState.complete, true);
assert.equal(floorScoutedAfterPeerMoved, true);
assert.equal(floorSpent, 3);
assert.equal(chatSpent, 4);

console.log(JSON.stringify({
  gate: 'AXM Floorborn v0.9 shared RTS player slots',
  status: 'PASS',
  apmBoundary: {
    windowSeconds: 5,
    effectiveActionsPerWindow: 2,
    effectiveApm: 24,
    perPlayerBudget: true,
  },
  interaction: {
    chatMovedArmyPairToCenter: true,
    floorbornLaterScoutedCenter: floorScoutedAfterPeerMoved,
  },
  agencySpent: {
    floorborn: floorSpent,
    chat: chatSpent,
  },
  transcript: completed.transcript.map((entry) => ({
    actor: entry.actor,
    windowIndex: entry.windowIndex,
    actionId: entry.actionId,
    effectiveCost: entry.effectiveCost,
    budgetBefore: entry.budgetBefore,
    budgetAfter: entry.budgetAfter,
  })),
  finalState: completed.publicState,
  replay: 'PASS',
}, null, 2));
