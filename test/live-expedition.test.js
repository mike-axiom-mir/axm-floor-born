import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyExpeditionChatAction,
  createLiveExpedition,
  liveExpeditionView,
} from '../src/live-expedition.js';

test('live expedition gives Floorborn first turn then exposes bounded chat actions', () => {
  const live = createLiveExpedition({ sessionId: 'live-exp-start', seed: 5 });
  const view = liveExpeditionView(live);

  assert.equal(view.complete, false);
  assert.equal(view.transcript[0].actor, 'floorborn');
  assert.ok(view.chatObservation);
  assert.equal(view.chatObservation.protocol, 'axm.player.v0.1');
  assert.equal(JSON.stringify(view.chatObservation).includes('ember-seal'), false);
});

test('live expedition resumes through alternating independent turns', () => {
  let live = createLiveExpedition({ sessionId: 'live-exp-resume', seed: 5 });
  let view = liveExpeditionView(live);
  const firstMove = view.chatObservation.legalActions.find((action) => action.kind === 'move');

  live = applyExpeditionChatAction(live, firstMove.id);
  view = liveExpeditionView(live);

  assert.equal(view.transcript.at(-1).actor, 'floorborn');
  assert.ok(view.chatObservation);
  assert.ok(view.transcript.some((turn) => turn.actor === 'chat'));
});
