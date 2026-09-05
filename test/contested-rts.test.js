import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import {
  CONTESTED_RTS_MAX_WINDOWS,
  ContestedRtsSession,
  replayContestedRts,
} from '../src/contested-rts.js';

function actionById(game, playerId, id) {
  const action = game.observe(playerId).legalActions.find((candidate) => candidate.id === id);
  assert.ok(action, `${id} should be legal for ${playerId}`);
  return action;
}

function peerAction(game, playerId) {
  const observation = game.observe(playerId);
  const legal = observation.legalActions;
  return legal.find((action) => action.id.startsWith('command:attack:'))
    ?? legal.find((action) => action.id === 'command:move:army-alpha:center')
    ?? legal.find((action) => action.id === 'command:move:army-beta:center')
    ?? legal.find((action) => action.id.startsWith('command:fortify:'))
    ?? legal.find((action) => action.id === 'command:scout:center')
    ?? legal.find((action) => action.id === 'wait:yield-window')
    ?? legal[0];
}

function runFloorbornContest(sessionId = 'contested-floorborn-run') {
  const game = new ContestedRtsSession({
    sessionId,
    playerIds: ['floorborn-001', 'peer-001'],
  });
  const floorborn = new FloorbornPlayer({
    playerId: 'floorborn-001',
    lineageId: 'contested-rts-root',
  });
  const decisions = [];
  let guard = 0;

  while (!game.isComplete() && guard < 80) {
    guard += 1;
    const playerId = game.activePlayerId();
    let action;
    if (playerId === 'floorborn-001') {
      const observation = game.observe(playerId);
      action = floorborn.decide(observation);
      decisions.push({
        turn: observation.turn,
        actionId: action.id,
        decision: structuredClone(floorborn.lastDecision),
      });
    } else {
      action = peerAction(game, playerId);
    }

    const receipt = game.step(playerId, action);
    if (playerId === 'floorborn-001') floorborn.learn(receipt);
  }

  assert.ok(guard < 80, 'contest should terminate inside guard');
  assert.equal(game.isComplete(), true);
  return { game, floorborn, decisions };
}

test('contested slots preserve the same APM boundary and hide engine-only doctrine', () => {
  const a = new ContestedRtsSession({
    sessionId: 'contested-equality-a',
    playerIds: ['floorborn-001', 'peer-001'],
  });
  const b = new ContestedRtsSession({
    sessionId: 'contested-equality-b',
    playerIds: ['peer-001', 'floorborn-001'],
  });

  const floor = a.observe('floorborn-001');
  const peer = b.observe('peer-001');
  assert.equal(floor.rts.effectiveApmLimit, peer.rts.effectiveApmLimit);
  assert.equal(floor.rts.budgetRemaining, peer.rts.budgetRemaining);
  assert.deepEqual(
    floor.legalActions.map((action) => action.id),
    peer.legalActions.map((action) => action.id),
  );
  assert.equal(JSON.stringify(floor).includes('hidden-contested-doctrine'), false);
});

test('enemy center position stays hidden until legal line-of-sight exists', () => {
  const game = new ContestedRtsSession({ sessionId: 'contested-fog' });

  game.step('floorborn-001', actionById(game, 'floorborn-001', 'command:move:army-alpha:center'));
  let peerView = game.observe('peer-001');
  assert.deepEqual(peerView.rts.visibleEnemyContacts, []);

  game.step('peer-001', actionById(game, 'peer-001', 'command:scout:center'));
  peerView = game.observe('peer-001');
  assert.deepEqual(peerView.rts.visibleEnemyContacts.map((contact) => contact.groupId), ['army-alpha']);
});

test('attack, fortification, damage, destruction, and retreat are deterministic legal consequences', () => {
  const game = new ContestedRtsSession({ sessionId: 'contested-combat-mechanics' });

  game.step('floorborn-001', actionById(game, 'floorborn-001', 'command:move:army-alpha:center'));
  game.step('peer-001', actionById(game, 'peer-001', 'command:move:army-alpha:center'));

  game.step('floorborn-001', actionById(game, 'floorborn-001', 'command:fortify:army-alpha:center'));
  let receipt = game.step('peer-001', actionById(game, 'peer-001', 'command:attack:army-alpha:army-alpha'));
  assert.equal(receipt.outcome.eventId, 'fortification-hit:army-alpha');
  assert.equal(game.publicState().players['floorborn-001'].groups['army-alpha'].integrity, 2);
  assert.equal(game.publicState().players['floorborn-001'].groups['army-alpha'].fortification, 0);

  assert.equal(game.publicState().windowIndex, 1);
  receipt = game.step('peer-001', actionById(game, 'peer-001', 'command:attack:army-alpha:army-alpha'));
  assert.equal(receipt.outcome.eventId, 'damaged:army-alpha');
  assert.equal(game.publicState().players['floorborn-001'].groups['army-alpha'].integrity, 1);

  const retreat = actionById(game, 'floorborn-001', 'command:retreat:army-alpha:base');
  receipt = game.step('floorborn-001', retreat);
  assert.equal(receipt.outcome.eventId, 'retreated:army-alpha:base');
  assert.equal(game.publicState().players['floorborn-001'].groups['army-alpha'].position, 'base');
});

test('uncontested center presence earns control only when the action window closes', () => {
  const game = new ContestedRtsSession({ sessionId: 'contested-control' });

  game.step('floorborn-001', actionById(game, 'floorborn-001', 'command:move:army-alpha:center'));
  assert.equal(game.publicState().players['floorborn-001'].controlPoints, 0);
  game.step('peer-001', actionById(game, 'peer-001', 'wait:yield-window'));
  game.step('floorborn-001', actionById(game, 'floorborn-001', 'wait:yield-window'));

  assert.equal(game.publicState().windowIndex, 1);
  assert.equal(game.publicState().players['floorborn-001'].controlPoints, 1);
  assert.equal(game.publicState().controlLog[0].awardedPlayerId, 'floorborn-001');
});

test('Floorborn can enter a deterministic contested run with damage and center pressure without a combat personality script', () => {
  const { game, decisions } = runFloorbornContest('contested-floorborn-behavior');
  const state = game.publicState();
  const events = game.receipts.map((receipt) => receipt.outcome.eventId);

  assert.equal(state.windowIndex <= CONTESTED_RTS_MAX_WINDOWS, true);
  assert.ok(events.some((eventId) => eventId.startsWith('damaged:') || eventId.startsWith('destroyed:')));
  assert.ok(decisions.some((decision) => decision.actionId.startsWith('command:attack:')));
  assert.ok(state.controlLog.length >= 1);

  const floorActions = decisions.map((decision) => decision.actionId);
  assert.ok(floorActions.includes('command:move:army-alpha:center'));
  assert.equal(floorActions.every((actionId) => typeof actionId === 'string'), true);
});

test('contested Floorborn run replays exact combat, budget, and control consequences', () => {
  const { game } = runFloorbornContest('contested-floorborn-replay');
  const replayed = replayContestedRts({
    sessionId: 'contested-floorborn-replay',
    receipts: game.receipts,
  });
  assert.deepEqual(replayed, game.publicState());
});
