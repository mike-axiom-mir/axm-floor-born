import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import { ContestedRtsSession } from '../src/contested-rts.js';
import {
  ConsequenceContestedRtsSession,
  replayConsequenceContestedRts,
} from '../src/consequence-contested-rts.js';
import { ingestVisibleConsequences } from '../src/visible-consequence.js';

function pressureAction(game, playerId) {
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

function runBaseline(sessionId) {
  const game = new ContestedRtsSession({
    sessionId,
    playerIds: ['floorborn-001', 'pressure-peer-001'],
  });
  const floorborn = new FloorbornPlayer({ playerId: 'floorborn-001' });
  runLoop({ game, floorborn, ingestIncoming: false });
  return { game, floorborn, metrics: metricsFor(game, floorborn) };
}

function runAdapted(sessionId) {
  const game = new ConsequenceContestedRtsSession({
    sessionId,
    playerIds: ['floorborn-001', 'pressure-peer-001'],
  });
  const floorborn = new FloorbornPlayer({
    playerId: 'floorborn-001',
    perspectives: { criticalRecovery: true },
  });
  runLoop({ game, floorborn, ingestIncoming: true });
  return { game, floorborn, metrics: metricsFor(game, floorborn) };
}

function runLoop({ game, floorborn, ingestIncoming }) {
  let guard = 0;
  while (!game.isComplete() && guard < 100) {
    guard += 1;
    const playerId = game.activePlayerId();
    let action;

    if (playerId === 'floorborn-001') {
      const observation = game.observe(playerId);
      if (ingestIncoming) ingestVisibleConsequences(floorborn, observation);
      action = floorborn.decide(observation);
    } else {
      action = pressureAction(game, playerId);
    }

    const receipt = game.step(playerId, action);
    if (playerId === 'floorborn-001') floorborn.learn(receipt);
  }

  assert.ok(guard < 100, 'integrated contest should terminate inside guard');
  assert.equal(game.isComplete(), true);
}

function metricsFor(game, floorborn) {
  const floorReceipts = game.receipts.filter((receipt) => receipt.playerId === 'floorborn-001');
  const actions = floorReceipts.map((receipt) => receipt.action.id);
  const state = game.publicState();
  const ownGroups = state.players['floorborn-001'].groups;
  return {
    actions,
    attacks: actions.filter((id) => id.startsWith('command:attack:')).length,
    retreats: actions.filter((id) => id.startsWith('command:retreat:')).length,
    fortifies: actions.filter((id) => id.startsWith('command:fortify:')).length,
    moves: actions.filter((id) => id.startsWith('command:move:')).length,
    scouts: actions.filter((id) => id === 'command:scout:center').length,
    yields: actions.filter((id) => id === 'wait:yield-window').length,
    effectiveActions: floorReceipts.reduce((sum, receipt) => sum + receipt.effectiveCost, 0),
    destroyedCombatGroups: Object.values(ownGroups).filter(
      (group) => group.role === 'combat' && group.position === 'destroyed',
    ).length,
    survivingCombatGroups: Object.values(ownGroups).filter(
      (group) => group.role === 'combat' && group.integrity > 0,
    ).length,
    controlPoints: state.players['floorborn-001'].controlPoints,
    opponentControlPoints: state.players['pressure-peer-001'].controlPoints,
    winnerPlayerId: state.winnerPlayerId,
    observedConsequences: floorborn.memory.observedConsequences.length,
  };
}

test('integrated contested adaptation changes lived action history and introduces recovery without rewriting baseline', () => {
  const baseline = runBaseline('v13-baseline');
  const adapted = runAdapted('v13-adapted');

  assert.equal(baseline.metrics.retreats, 0);
  assert.ok(adapted.metrics.observedConsequences > 0);
  assert.ok(adapted.metrics.retreats >= 1);
  assert.notDeepEqual(adapted.metrics.actions, baseline.metrics.actions);
  assert.equal(baseline.floorborn.perspectives.criticalRecovery, false);
  assert.equal(adapted.floorborn.perspectives.criticalRecovery, true);
});

test('integrated adapted contest remains exactly replayable even when incoming experience changes Floorborn decisions', () => {
  const adapted = runAdapted('v13-adapted-replay');
  const replayed = replayConsequenceContestedRts({
    sessionId: 'v13-adapted-replay',
    playerIds: ['floorborn-001', 'pressure-peer-001'],
    receipts: adapted.game.receipts,
  });
  assert.deepEqual(replayed, adapted.game.publicState());
});
