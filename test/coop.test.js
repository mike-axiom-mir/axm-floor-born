import test from 'node:test';
import assert from 'node:assert/strict';

import { CoopRpgSession, replayCoopSession } from '../src/coop-rpg.js';
import { createLiveCoop, applyChatAction, liveView, LIVE_CHAT_ID, LIVE_FLOORBORN_ID } from '../src/live-coop.js';

function actionById(game, playerId, id) {
  const observation = game.observe(playerId);
  const action = observation.legalActions.find((candidate) => candidate.id === id);
  assert.ok(action, `${id} should be legal for ${playerId}`);
  return action;
}

function stepById(game, playerId, id) {
  return game.step(playerId, actionById(game, playerId, id));
}

test('co-op gives both architectures the same player protocol boundary', () => {
  const game = new CoopRpgSession({ sessionId: 'same-door' });
  const floorObservation = game.observe(LIVE_FLOORBORN_ID);
  assert.equal(floorObservation.protocol, 'axm.player.v0.1');
  stepById(game, LIVE_FLOORBORN_ID, 'move:forest');
  const chatObservation = game.observe(LIVE_CHAT_ID);
  assert.equal(chatObservation.protocol, floorObservation.protocol);
  assert.deepEqual(chatObservation.legalActions.map((a) => a.kind).sort(), ['move', 'move', 'wait']);
});

test('hidden shard identity is not exposed in an uninspected player observation', () => {
  const game = new CoopRpgSession({ sessionId: 'hidden' });
  stepById(game, LIVE_FLOORBORN_ID, 'move:forest');
  stepById(game, LIVE_CHAT_ID, 'move:ruins');
  stepById(game, LIVE_FLOORBORN_ID, 'inspect:forest');
  const chatObservation = game.observe(LIVE_CHAT_ID);
  assert.equal(chatObservation.place.known, false);
  assert.equal(JSON.stringify(chatObservation.place).includes('moon-shard'), false);
});

test('turn ownership is enforced', () => {
  const game = new CoopRpgSession({ sessionId: 'turns' });
  assert.throws(() => game.observe(LIVE_CHAT_ID), /not chat-001's turn/);
});

test('shards are globally unique and cannot be gathered twice', () => {
  const game = new CoopRpgSession({ sessionId: 'unique' });
  stepById(game, LIVE_FLOORBORN_ID, 'move:forest');
  stepById(game, LIVE_CHAT_ID, 'move:forest');
  stepById(game, LIVE_FLOORBORN_ID, 'inspect:forest');
  stepById(game, LIVE_CHAT_ID, 'inspect:forest');
  stepById(game, LIVE_FLOORBORN_ID, 'gather:sun-shard');
  const chatObservation = game.observe(LIVE_CHAT_ID);
  assert.equal(chatObservation.legalActions.some((a) => a.id === 'gather:sun-shard'), false);
});

test('a split two-player route can cooperatively open the gate', () => {
  const game = new CoopRpgSession({ sessionId: 'coop-complete' });
  const receipts = [];
  receipts.push(stepById(game, LIVE_FLOORBORN_ID, 'move:forest'));
  receipts.push(stepById(game, LIVE_CHAT_ID, 'move:ruins'));
  receipts.push(stepById(game, LIVE_FLOORBORN_ID, 'inspect:forest'));
  receipts.push(stepById(game, LIVE_CHAT_ID, 'inspect:ruins'));
  receipts.push(stepById(game, LIVE_FLOORBORN_ID, 'gather:sun-shard'));
  receipts.push(stepById(game, LIVE_CHAT_ID, 'gather:moon-shard'));
  receipts.push(stepById(game, LIVE_FLOORBORN_ID, 'move:gate'));
  receipts.push(stepById(game, LIVE_CHAT_ID, 'move:gate'));
  receipts.push(stepById(game, LIVE_FLOORBORN_ID, 'signal:open-gate'));

  assert.equal(game.isComplete(), true);
  assert.equal(game.publicState().gateOpen, true);
  const replayed = replayCoopSession({ sessionId: 'coop-complete', receipts });
  assert.deepEqual(replayed, game.publicState());
});

test('live bridge advances Floorborn then exposes only a legal chat turn', () => {
  const live = createLiveCoop({ sessionId: 'live-start' });
  const view = liveView(live);
  assert.equal(view.complete, false);
  assert.equal(view.publicState.activePlayerId, LIVE_CHAT_ID);
  assert.equal(view.transcript[0].actor, 'floorborn');
  assert.equal(view.transcript[0].actionId, 'move:forest');
  assert.ok(view.chatObservation.legalActions.some((a) => a.id === 'move:ruins'));
});

test('live bridge snapshot resumes across chat turns and Floorborn turns', () => {
  let live = createLiveCoop({ sessionId: 'live-resume' });
  live = applyChatAction(live, 'move:ruins');
  let view = liveView(live);
  assert.equal(view.transcript.at(-1).actor, 'floorborn');
  assert.equal(view.transcript.at(-1).actionId, 'inspect:forest');
  assert.equal(view.chatObservation.place.id, 'ruins');

  live = JSON.parse(JSON.stringify(live));
  live = applyChatAction(live, 'inspect:ruins');
  view = liveView(live);
  assert.equal(view.chatObservation.place.id, 'ruins');
  assert.ok(view.chatObservation.legalActions.some((a) => a.id === 'gather:moon-shard'));
});

test('live chat plus Floorborn can finish the mission without privileged actions', () => {
  let live = createLiveCoop({ sessionId: 'live-finish' });
  for (const actionId of ['move:ruins', 'inspect:ruins', 'gather:moon-shard', 'move:gate']) {
    live = applyChatAction(live, actionId);
  }
  const view = liveView(live);
  assert.equal(view.complete, true);
  assert.equal(view.publicState.gateOpen, true);
  assert.equal(view.transcript.at(-1).actor, 'floorborn');
  assert.equal(view.transcript.at(-1).actionId, 'signal:open-gate');
});
