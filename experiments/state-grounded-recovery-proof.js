import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import { ConsequenceContestedRtsSession } from '../src/consequence-contested-rts.js';
import { StateGroundedRecoveryPlayer } from '../src/state-grounded-recovery-player.js';
import {
  replayStateRecoveryContestedRts,
  StateRecoveryContestedRtsSession,
} from '../src/state-recovery-contested-rts.js';
import { ingestVisibleConsequences } from '../src/visible-consequence.js';

const v14 = runV14Control('v15-proof-v14-control');
const v15 = runV15StateGrounded('v15-proof-state-grounded');

const debugReceipt = {
  gate: 'AXM Floorborn v0.15 state-grounded recovery completion',
  phase: 'pre-assert-debug',
  v14TimeBasedControl: v14.metrics,
  v15StateGrounded: v15.metrics,
  v14ReentryBeforeStabilization: reentryBeforeStabilization(v14.metrics.actions),
  v15ReentryBeforeStabilization: reentryBeforeStabilization(v15.metrics.actions),
  v15RecoveryHistory: v15.player.memory.stateGroundedRecoveries,
  v15FloorbornReceipts: v15.game.receipts
    .filter((receipt) => receipt.playerId === 'floorborn-001')
    .map((receipt) => ({
      turn: receipt.turn,
      windowIndex: receipt.windowIndex,
      actionId: receipt.action.id,
      eventId: receipt.outcome.eventId,
      budgetBefore: receipt.budgetBefore,
      budgetAfter: receipt.budgetAfter,
    })),
};
console.log('V15 PRE-ASSERT DEBUG');
console.log(JSON.stringify(debugReceipt, null, 2));

assert.equal(v14.metrics.retreats >= 1, true);
assert.equal(v14.metrics.stabilizes, 0);
assert.equal(reentryBeforeStabilization(v14.metrics.actions), true);

assert.equal(v15.metrics.retreats >= 1, true);
assert.equal(v15.metrics.stabilizes >= 1, true);
assert.equal(reentryBeforeStabilization(v15.metrics.actions), false);
assert.ok(v15.player.memory.stateGroundedRecoveries.length >= 1);
assert.equal(v15.player.activeRecoveries().length, 0);
assert.ok(v15.player.memory.stateGroundedRecoveries.some((entry) => (
  entry.status === 'completed' && entry.retiredEventId.startsWith('stabilized:')
)));

const replayed = replayStateRecoveryContestedRts({
  sessionId: 'v15-proof-state-grounded',
  playerIds: ['floorborn-001', 'pressure-peer-001'],
  receipts: v15.game.receipts,
});
assert.deepEqual(replayed, v15.game.publicState());

const restored = StateGroundedRecoveryPlayer.restore(v15.player.snapshot());
assert.deepEqual(restored.memory.stateGroundedRecoveries, v15.player.memory.stateGroundedRecoveries);

console.log(JSON.stringify({
  gate: 'AXM Floorborn v0.15 state-grounded recovery completion',
  status: 'PASS',
  v14TimeBasedControl: v14.metrics,
  v15StateGrounded: v15.metrics,
  comparison: {
    v14ReentryBeforeStabilization: reentryBeforeStabilization(v14.metrics.actions),
    v15ReentryBeforeStabilization: reentryBeforeStabilization(v15.metrics.actions),
    stabilizationDelta: v15.metrics.stabilizes - v14.metrics.stabilizes,
    actionHistoryChanged: JSON.stringify(v14.metrics.actions) !== JSON.stringify(v15.metrics.actions),
    destroyedCombatGroupDelta: v15.metrics.destroyedCombatGroups - v14.metrics.destroyedCombatGroups,
    survivingCombatGroupDelta: v15.metrics.survivingCombatGroups - v14.metrics.survivingCombatGroups,
    controlDelta: v15.metrics.controlPoints - v14.metrics.controlPoints,
  },
  recoveryHistory: v15.player.memory.stateGroundedRecoveries,
  replay: 'PASS',
  snapshotRestore: 'PASS',
  claimBoundary: 'Recovery completion is tied to visible stabilization, not elapsed action windows. Winning is not required.',
}, null, 2));

function runV14Control(sessionId) {
  const game = new ConsequenceContestedRtsSession({
    sessionId,
    playerIds: ['floorborn-001', 'pressure-peer-001'],
  });
  const player = new FloorbornPlayer({
    playerId: 'floorborn-001',
    perspectives: {
      criticalRecovery: true,
      recoveryLifecycle: true,
    },
  });
  runLoop(game, player, false);
  return { game, player, metrics: metricsFor(game, player) };
}

function runV15StateGrounded(sessionId) {
  const game = new StateRecoveryContestedRtsSession({
    sessionId,
    playerIds: ['floorborn-001', 'pressure-peer-001'],
  });
  const player = new StateGroundedRecoveryPlayer({
    playerId: 'floorborn-001',
    lineageId: 'v15-state-grounded-lineage',
  });
  runLoop(game, player, true);
  return { game, player, metrics: metricsFor(game, player) };
}

function runLoop(game, player, stateGrounded) {
  let guard = 0;
  while (!game.isComplete() && guard < 120) {
    guard += 1;
    const playerId = game.activePlayerId();
    let action;

    if (playerId === 'floorborn-001') {
      const observation = game.observe(playerId);
      ingestVisibleConsequences(player, observation);
      action = player.decide(observation);
    } else {
      action = pressureAction(game, playerId);
    }

    const receipt = game.step(playerId, action);
    if (playerId === 'floorborn-001') player.learn(receipt);
  }

  assert.ok(guard < 120, `${stateGrounded ? 'v15' : 'v14'} contest should terminate`);
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

function metricsFor(game, player) {
  const receipts = game.receipts.filter((receipt) => receipt.playerId === 'floorborn-001');
  const actions = receipts.map((receipt) => receipt.action.id);
  const state = game.publicState();
  const own = state.players['floorborn-001'].groups;
  return {
    actions,
    attacks: actions.filter((id) => id.startsWith('command:attack:')).length,
    retreats: actions.filter((id) => id.startsWith('command:retreat:')).length,
    stabilizes: actions.filter((id) => id.startsWith('command:stabilize:')).length,
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
    observedConsequences: player.memory.observedConsequences.length,
  };
}

function reentryBeforeStabilization(actions) {
  for (let retreatIndex = 0; retreatIndex < actions.length; retreatIndex += 1) {
    const retreat = actions[retreatIndex].match(/^command:retreat:([^:]+):base$/);
    if (!retreat) continue;
    const groupId = retreat[1];
    for (let index = retreatIndex + 1; index < actions.length; index += 1) {
      if (actions[index] === `command:stabilize:${groupId}:base`) break;
      if (actions[index] === `command:move:${groupId}:center`) return true;
      if (actions[index].startsWith(`command:retreat:${groupId}:`)) break;
    }
  }
  return false;
}
