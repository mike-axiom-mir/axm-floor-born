import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import { ContestedRtsSession } from '../src/contested-rts.js';
import {
  ConsequenceContestedRtsSession,
  replayConsequenceContestedRts,
} from '../src/consequence-contested-rts.js';
import { ingestVisibleConsequences } from '../src/visible-consequence.js';

const baseline = runBaseline('v13-proof-baseline');
const adapted = runAdapted('v13-proof-adapted');

assert.equal(baseline.metrics.retreats, 0);
assert.ok(adapted.metrics.observedConsequences > 0);
assert.ok(adapted.metrics.retreats >= 1);
assert.notDeepEqual(adapted.metrics.actions, baseline.metrics.actions);

const replayed = replayConsequenceContestedRts({
  sessionId: 'v13-proof-adapted',
  playerIds: ['floorborn-001', 'pressure-peer-001'],
  receipts: adapted.game.receipts,
});
assert.deepEqual(replayed, adapted.game.publicState());

console.log(JSON.stringify({
  gate: 'AXM Floorborn v0.13 integrated contested adaptation',
  status: 'PASS',
  frozenBaseline: baseline.metrics,
  adapted: adapted.metrics,
  comparison: {
    actionHistoryChanged: JSON.stringify(adapted.metrics.actions) !== JSON.stringify(baseline.metrics.actions),
    retreatDelta: adapted.metrics.retreats - baseline.metrics.retreats,
    destroyedCombatGroupDelta: adapted.metrics.destroyedCombatGroups - baseline.metrics.destroyedCombatGroups,
    survivingCombatGroupDelta: adapted.metrics.survivingCombatGroups - baseline.metrics.survivingCombatGroups,
    controlDelta: adapted.metrics.controlPoints - baseline.metrics.controlPoints,
  },
  adaptedObservedConsequences: adapted.floorborn.memory.observedConsequences,
  replay: 'PASS',
  claimBoundary: 'Behavior change is the target. Winning or preserving more units is not required.',
}, null, 2));

function runBaseline(sessionId) {
  const game = new ContestedRtsSession({
    sessionId,
    playerIds: ['floorborn-001', 'pressure-peer-001'],
  });
  const floorborn = new FloorbornPlayer({ playerId: 'floorborn-001' });
  runLoop(game, floorborn, false);
  return { game, floorborn, metrics: metricsFor(game, floorborn) };
}

function runAdapted(sessionId) {
  const game = new ConsequenceContestedRtsSession({
    sessionId,
    playerIds: ['floorborn-001', 'pressure-peer-001'],
  });
  const floorborn = new FloorbornPlayer({
    playerId: 'floorborn-001',
    lineageId: 'v13-adapted-lineage',
    perspectives: { criticalRecovery: true },
  });
  runLoop(game, floorborn, true);
  return { game, floorborn, metrics: metricsFor(game, floorborn) };
}

function runLoop(game, floorborn, ingestIncoming) {
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

  assert.ok(guard < 100);
  assert.equal(game.isComplete(), true);
}

function pressureAction(game, playerId) {
  const legal = game.observe(playerId).legalActions;
  return legal.find((action) => action.id.startsWith('command:attack:'))
    ?? legal.find((action) => action.id === 'command:move:army-alpha:center')
    ?? legal.find((action) => action.id === 'command:move:army-beta:center')
    ?? legal.find((action) => action.id.startsWith('command:fortify:'))
    ?? legal.find((action) => action.id === 'command:scout:center')
    ?? legal.find((action) => action.id === 'wait:yield-window')
    ?? legal[0];
}

function metricsFor(game, floorborn) {
  const receipts = game.receipts.filter((receipt) => receipt.playerId === 'floorborn-001');
  const actions = receipts.map((receipt) => receipt.action.id);
  const state = game.publicState();
  const own = state.players['floorborn-001'].groups;
  return {
    actions,
    attacks: actions.filter((id) => id.startsWith('command:attack:')).length,
    retreats: actions.filter((id) => id.startsWith('command:retreat:')).length,
    fortifies: actions.filter((id) => id.startsWith('command:fortify:')).length,
    moves: actions.filter((id) => id.startsWith('command:move:')).length,
    scouts: actions.filter((id) => id === 'command:scout:center').length,
    yields: actions.filter((id) => id === 'wait:yield-window').length,
    effectiveActions: receipts.reduce((sum, receipt) => sum + receipt.effectiveCost, 0),
    destroyedCombatGroups: Object.values(own).filter(
      (group) => group.role === 'combat' && group.position === 'destroyed',
    ).length,
    survivingCombatGroups: Object.values(own).filter(
      (group) => group.role === 'combat' && group.integrity > 0,
    ).length,
    controlPoints: state.players['floorborn-001'].controlPoints,
    opponentControlPoints: state.players['pressure-peer-001'].controlPoints,
    winnerPlayerId: state.winnerPlayerId,
    observedConsequences: floorborn.memory.observedConsequences.length,
  };
}
