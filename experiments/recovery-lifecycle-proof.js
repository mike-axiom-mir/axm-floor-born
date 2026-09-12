import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import {
  ConsequenceContestedRtsSession,
  replayConsequenceContestedRts,
} from '../src/consequence-contested-rts.js';
import { ingestVisibleConsequences } from '../src/visible-consequence.js';

const v13 = runContest({
  sessionId: 'v14-proof-v13-control',
  recoveryLifecycle: false,
});
const v14 = runContest({
  sessionId: 'v14-proof-lifecycle',
  recoveryLifecycle: true,
});

const v13Immediate = immediateRetreatReentry(v13.metrics.actions);
const v14Immediate = immediateRetreatReentry(v14.metrics.actions);

assert.equal(v13.metrics.retreats >= 1, true);
assert.equal(v13Immediate, true);
assert.equal(v14.metrics.retreats >= 1, true);
assert.equal(v14Immediate, false);
assert.ok(v14.floorborn.memory.recoveries.length >= 1);
assert.equal(v14.floorborn.activeRecoveries().length, 0);

const replayed = replayConsequenceContestedRts({
  sessionId: 'v14-proof-lifecycle',
  playerIds: ['floorborn-001', 'pressure-peer-001'],
  receipts: v14.game.receipts,
});
assert.deepEqual(replayed, v14.game.publicState());

const restored = FloorbornPlayer.restore(v14.floorborn.snapshot());
assert.equal(restored.perspectives.recoveryLifecycle, true);
assert.deepEqual(restored.memory.recoveries, v14.floorborn.memory.recoveries);

console.log(JSON.stringify({
  gate: 'AXM Floorborn v0.14 bounded recovery lifecycle',
  status: 'PASS',
  v13Control: v13.metrics,
  v14Lifecycle: v14.metrics,
  comparison: {
    v13ImmediateRetreatReentry: v13Immediate,
    v14ImmediateRetreatReentry: v14Immediate,
    actionHistoryChanged: JSON.stringify(v13.metrics.actions) !== JSON.stringify(v14.metrics.actions),
    resultChanged: v13.metrics.winnerPlayerId !== v14.metrics.winnerPlayerId
      || v13.metrics.controlPoints !== v14.metrics.controlPoints
      || v13.metrics.opponentControlPoints !== v14.metrics.opponentControlPoints,
  },
  recoveryHistory: v14.floorborn.memory.recoveries,
  replay: 'PASS',
  snapshotRestore: 'PASS',
  claimBoundary: 'The lifecycle blocks immediate same-window re-entry only. Winning or later re-entry is not constrained by this gate.',
}, null, 2));

function runContest({ sessionId, recoveryLifecycle }) {
  const game = new ConsequenceContestedRtsSession({
    sessionId,
    playerIds: ['floorborn-001', 'pressure-peer-001'],
  });
  const floorborn = new FloorbornPlayer({
    playerId: 'floorborn-001',
    lineageId: recoveryLifecycle ? 'v14-lifecycle-lineage' : 'v13-control-lineage',
    perspectives: {
      criticalRecovery: true,
      recoveryLifecycle,
    },
  });

  let guard = 0;
  while (!game.isComplete() && guard < 100) {
    guard += 1;
    const playerId = game.activePlayerId();
    let action;

    if (playerId === 'floorborn-001') {
      const observation = game.observe(playerId);
      ingestVisibleConsequences(floorborn, observation);
      action = floorborn.decide(observation);
    } else {
      action = pressureAction(game, playerId);
    }

    const receipt = game.step(playerId, action);
    if (playerId === 'floorborn-001') floorborn.learn(receipt);
  }

  assert.ok(guard < 100);
  assert.equal(game.isComplete(), true);
  return { game, floorborn, metrics: metricsFor(game, floorborn) };
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
    recoveries: floorborn.memory.recoveries.length,
  };
}

function immediateRetreatReentry(actions) {
  for (let index = 0; index < actions.length - 1; index += 1) {
    const retreat = actions[index].match(/^command:retreat:([^:]+):base$/);
    if (!retreat) continue;
    if (actions[index + 1] === `command:move:${retreat[1]}:center`) return true;
  }
  return false;
}
