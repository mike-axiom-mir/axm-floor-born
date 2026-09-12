import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyLiveContestedChatAction,
  createLiveContestedRts,
  liveContestedRtsView,
  revealCompletedLiveContestedRts,
} from '../src/live-contested-rts.js';

test('live contested bridge exposes only the chat bounded RTS view and public transcript', () => {
  const live = createLiveContestedRts({ sessionId: 'v16-live-start' });
  const view = liveContestedRtsView(live);

  assert.equal(view.complete, false);
  assert.ok(view.chatObservation);
  assert.equal(view.chatObservation.protocol, 'axm.player.rts.v0.1');
  assert.equal(view.chatObservation.self.playerId, 'chat-001');
  assert.equal(view.chatObservation.rts.effectiveApmLimit, 24);
  assert.equal(view.chatObservation.rts.budgetRemaining, 2);
  assert.equal(view.transcript[0].actor, 'floorborn');
  assert.equal(view.transcript[0].actionId, 'command:move:army-alpha:center');

  const text = JSON.stringify(view);
  assert.equal(text.includes('hidden-contested-doctrine'), false);
  assert.equal(text.includes('selectedActionId'), false);
  assert.equal(text.includes('floorbornDecisionReceipts'), false);
});

test('pending incoming damage survives live snapshot restore until the chat commits its next action', () => {
  let live = createLiveContestedRts({ sessionId: 'v16-live-inbox' });
  let view = liveContestedRtsView(live);
  assert.ok(view.chatObservation.legalActions.some(
    (action) => action.id === 'command:move:army-alpha:center',
  ));

  live = applyLiveContestedChatAction(live, 'command:move:army-alpha:center');
  const serialized = JSON.parse(JSON.stringify(live));
  view = liveContestedRtsView(serialized);

  assert.equal(view.chatObservation.rts.recentVisibleEvents.length, 1);
  assert.equal(view.chatObservation.rts.recentVisibleEvents[0].eventId, 'incoming:damaged:army-alpha');
  assert.equal(view.chatObservation.rts.recentVisibleEvents[0].sourcePlayerId, 'floorborn-001');

  const retreat = view.chatObservation.legalActions.find(
    (action) => action.id === 'command:retreat:army-alpha:base',
  );
  assert.ok(retreat);
  live = applyLiveContestedChatAction(serialized, retreat.id);
  view = liveContestedRtsView(live);

  if (!view.complete && view.chatObservation) {
    assert.equal(view.chatObservation.rts.recentVisibleEvents.some(
      (event) => event.eventKey === serialized.game.visibleEventsByPlayer['chat-001'][0].eventKey,
    ), false);
  }
});

test('live contested bridge can finish one shared fight and reveal exact replay without exposing internal decisions during play', () => {
  let live = createLiveContestedRts({ sessionId: 'v16-live-finish' });
  let guard = 0;

  while (!liveContestedRtsView(live).complete && guard < 80) {
    guard += 1;
    const view = liveContestedRtsView(live);
    assert.ok(view.chatObservation);
    const action = chooseChatAction(view.chatObservation);
    live = applyLiveContestedChatAction(live, action.id);
  }

  assert.ok(guard < 80);
  const view = liveContestedRtsView(live);
  assert.equal(view.complete, true);
  assert.equal(view.chatObservation, null);

  const completed = revealCompletedLiveContestedRts(live);
  assert.deepEqual(completed.replayedPublicState, completed.publicState);
  assert.ok(completed.receipts.some((receipt) => receipt.playerId === 'floorborn-001'));
  assert.ok(completed.receipts.some((receipt) => receipt.playerId === 'chat-001'));
  assert.ok(completed.floorbornDecisionReceipts.length > 0);

  // Internal decision evidence is host research data and never appeared in the live player view.
  assert.equal(JSON.stringify(view).includes('floorbornDecisionReceipts'), false);
});

function chooseChatAction(observation) {
  const legal = observation.legalActions;
  const criticalOwn = new Set(
    observation.rts.ownGroups
      .filter((group) => group.role === 'combat' && group.position === 'center' && group.integrity === 1)
      .map((group) => group.id),
  );

  return legal.find((action) => (
    action.id.startsWith('command:retreat:')
    && (action.affectedGroups ?? []).some((groupId) => criticalOwn.has(groupId))
  ))
    ?? legal.find((action) => action.id.startsWith('command:stabilize:'))
    ?? legal.find((action) => action.id.startsWith('command:attack:'))
    ?? legal.find((action) => action.id === 'command:move:army-alpha:center')
    ?? legal.find((action) => action.id === 'command:move:army-beta:center')
    ?? legal.find((action) => action.id.startsWith('command:fortify:'))
    ?? legal.find((action) => action.id === 'command:scout:center')
    ?? legal.find((action) => action.id === 'wait:yield-window')
    ?? legal[0];
}
