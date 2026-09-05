import fs from 'node:fs';
import assert from 'node:assert/strict';

import {
  applyLiveContestedChatAction,
  createLiveContestedRts,
  liveContestedRtsView,
  revealCompletedLiveContestedRts,
} from '../src/live-contested-rts.js';

const ledger = JSON.parse(
  fs.readFileSync(new URL('./live-contested-session-001-decisions.json', import.meta.url), 'utf8'),
);

let live = createLiveContestedRts({ sessionId: ledger.sessionId });
const applied = [];

for (const [index, actionId] of ledger.chatChoices.entries()) {
  const view = liveContestedRtsView(live);
  assert.equal(view.complete, false, `session completed before chat choice ${index + 1}`);
  assert.ok(view.chatObservation, `chat observation missing before choice ${index + 1}`);

  const legal = view.chatObservation.legalActions.find((action) => action.id === actionId);
  assert.ok(legal, `chat choice ${index + 1} is not legal in its bounded observation: ${actionId}`);

  applied.push({
    choiceNumber: index + 1,
    turn: view.chatObservation.turn,
    windowIndex: view.chatObservation.rts.windowIndex,
    actionId,
    effectiveCost: legal.effectiveCost,
  });
  live = applyLiveContestedChatAction(live, actionId);
}

const view = liveContestedRtsView(live);

if (!view.complete) {
  assert.ok(view.chatObservation, 'incomplete live session must end on a chat command opportunity');
  console.log(JSON.stringify({
    sessionId: ledger.sessionId,
    status: 'AWAITING_CHAT_ACTION',
    appliedChatChoices: applied,
    chatObservation: view.chatObservation,
    publicTranscript: view.transcript,
    privacyBoundary: {
      hostSnapshotExposed: false,
      floorbornDecisionTraceExposed: false,
      hiddenDoctrineExposed: false,
    },
  }, null, 2));
} else {
  const completed = revealCompletedLiveContestedRts(live);
  assert.deepEqual(completed.replayedPublicState, completed.publicState);

  const chatReceipts = completed.receipts.filter((receipt) => receipt.playerId === 'chat-001');
  const floorReceipts = completed.receipts.filter((receipt) => receipt.playerId === 'floorborn-001');

  console.log(JSON.stringify({
    sessionId: ledger.sessionId,
    status: 'COMPLETE',
    appliedChatChoices: applied,
    publicTranscript: completed.transcript,
    finalPublicState: completed.publicState,
    agencySpent: {
      chat: chatReceipts.reduce((sum, receipt) => sum + receipt.effectiveCost, 0),
      floorborn: floorReceipts.reduce((sum, receipt) => sum + receipt.effectiveCost, 0),
    },
    actionCounts: {
      chat: countActions(chatReceipts),
      floorborn: countActions(floorReceipts),
    },
    replay: 'PASS',
    privacyBoundary: {
      hostSnapshotExposedDuringPlay: false,
      floorbornDecisionTraceExposedDuringPlay: false,
      hiddenDoctrineExposedDuringPlay: false,
    },
  }, null, 2));
}

function countActions(receipts) {
  const counts = {
    attack: 0,
    move: 0,
    retreat: 0,
    stabilize: 0,
    fortify: 0,
    scout: 0,
    yield: 0,
  };
  for (const receipt of receipts) {
    const id = receipt.action.id;
    if (id.startsWith('command:attack:')) counts.attack += 1;
    else if (id.startsWith('command:move:')) counts.move += 1;
    else if (id.startsWith('command:retreat:')) counts.retreat += 1;
    else if (id.startsWith('command:stabilize:')) counts.stabilize += 1;
    else if (id.startsWith('command:fortify:')) counts.fortify += 1;
    else if (id === 'command:scout:center') counts.scout += 1;
    else if (id === 'wait:yield-window') counts.yield += 1;
  }
  return counts;
}
