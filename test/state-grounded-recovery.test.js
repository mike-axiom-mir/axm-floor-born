import test from 'node:test';
import assert from 'node:assert/strict';

import { StateGroundedRecoveryPlayer } from '../src/state-grounded-recovery-player.js';
import {
  replayStateRecoveryContestedRts,
  StateRecoveryContestedRtsSession,
} from '../src/state-recovery-contested-rts.js';
import { ingestVisibleConsequences } from '../src/visible-consequence.js';

function legal(game, playerId, actionId) {
  const action = game.observe(playerId).legalActions.find((candidate) => candidate.id === actionId);
  assert.ok(action, `${actionId} should be legal for ${playerId}`);
  return action;
}

function makeCriticalRetreat(sessionId) {
  const game = new StateRecoveryContestedRtsSession({
    sessionId,
    playerIds: ['floorborn-001', 'peer-001'],
  });
  const player = new StateGroundedRecoveryPlayer({ playerId: 'floorborn-001' });

  game.step('floorborn-001', legal(game, 'floorborn-001', 'command:move:army-alpha:center'));
  game.step('peer-001', legal(game, 'peer-001', 'command:move:army-alpha:center'));
  game.step('floorborn-001', legal(game, 'floorborn-001', 'wait:yield-window'));
  game.step('peer-001', legal(game, 'peer-001', 'command:attack:army-alpha:army-alpha'));
  game.step('peer-001', legal(game, 'peer-001', 'wait:yield-window'));

  const observation = game.observe('floorborn-001');
  ingestVisibleConsequences(player, observation);
  const retreat = player.decide(observation);
  assert.equal(retreat.id, 'command:retreat:army-alpha:base');
  const receipt = game.step('floorborn-001', retreat);
  player.learn(receipt);

  assert.equal(player.activeRecoveries().length, 1);
  assert.equal(game.publicState().players['floorborn-001'].groups['army-alpha'].integrity, 1);
  assert.equal(game.publicState().players['floorborn-001'].groups['army-alpha'].position, 'base');
  return { game, player };
}

function proposal(player, actionId) {
  const found = player.lastDecision.proposals.find((candidate) => candidate.actionId === actionId);
  assert.ok(found, `${actionId} proposal should exist`);
  return found;
}

test('damaged base combat group receives an ordinary one-action stabilization affordance', () => {
  const { game } = makeCriticalRetreat('v15-stabilize-affordance');
  const observation = game.observe('floorborn-001');
  const stabilize = observation.legalActions.find(
    (action) => action.id === 'command:stabilize:army-alpha:base',
  );

  assert.ok(stabilize);
  assert.equal(stabilize.effectiveCost, 1);
  assert.deepEqual(stabilize.affectedGroups, ['army-alpha']);
  assert.ok(stabilize.affordanceTags.includes('stabilization'));
});

test('state-grounded player chooses visible stabilization over immediate re-entry while recovery is pending', () => {
  const { game, player } = makeCriticalRetreat('v15-choose-stabilize');
  const observation = game.observe('floorborn-001');
  const selected = player.decide(observation);

  const stabilize = proposal(player, 'command:stabilize:army-alpha:base');
  const reentry = proposal(player, 'command:move:army-alpha:center');

  assert.equal(selected.id, 'command:stabilize:army-alpha:base');
  assert.ok(stabilize.evidence.includes('state-recovery-stabilize:army-alpha=+3'));
  assert.ok(reentry.evidence.includes('state-recovery-hold:army-alpha=-3'));
});

test('stabilization visibly restores integrity and retires the matching recovery lifecycle', () => {
  const { game, player } = makeCriticalRetreat('v15-complete-by-state');
  const observation = game.observe('floorborn-001');
  const stabilize = player.decide(observation);
  const receipt = game.step('floorborn-001', stabilize);
  player.learn(receipt);

  assert.equal(receipt.outcome.eventId, 'stabilized:army-alpha:base');
  assert.equal(game.publicState().players['floorborn-001'].groups['army-alpha'].integrity, 2);
  assert.equal(player.activeRecoveries().length, 0);
  assert.equal(player.memory.stateGroundedRecoveries[0].status, 'completed');
  assert.equal(
    player.memory.stateGroundedRecoveries[0].retiredEventId,
    'stabilized:army-alpha:base',
  );
});

test('window advancement alone does not complete recovery while the group remains critical', () => {
  const { game, player } = makeCriticalRetreat('v15-no-clock-recovery');

  game.step('floorborn-001', legal(game, 'floorborn-001', 'wait:yield-window'));
  assert.equal(game.publicState().windowIndex, 2);

  if (game.activePlayerId() === 'peer-001') {
    game.step('peer-001', legal(game, 'peer-001', 'wait:yield-window'));
  }

  const observation = game.observe('floorborn-001');
  player.decide(observation);

  assert.equal(game.publicState().players['floorborn-001'].groups['army-alpha'].integrity, 1);
  assert.equal(player.activeRecoveries().length, 1);
  const reentry = proposal(player, 'command:move:army-alpha:center');
  assert.ok(reentry.evidence.includes('state-recovery-hold:army-alpha=-3'));
});

test('state-grounded recovery history survives wrapper snapshot and restore', () => {
  const { game, player } = makeCriticalRetreat('v15-wrapper-restore');
  const restored = StateGroundedRecoveryPlayer.restore(player.snapshot());

  assert.deepEqual(restored.memory.stateGroundedRecoveries, player.memory.stateGroundedRecoveries);
  assert.equal(restored.activeRecoveries().length, 1);

  const selected = restored.decide(game.observe('floorborn-001'));
  assert.equal(selected.id, 'command:stabilize:army-alpha:base');
});

test('state-recovery world replays exact stabilization and integrity state', () => {
  const { game, player } = makeCriticalRetreat('v15-replay');
  let observation = game.observe('floorborn-001');
  const stabilize = player.decide(observation);
  let receipt = game.step('floorborn-001', stabilize);
  player.learn(receipt);

  if (!game.isComplete() && game.activePlayerId() === 'peer-001') {
    receipt = game.step('peer-001', legal(game, 'peer-001', 'wait:yield-window'));
  }

  const replayed = replayStateRecoveryContestedRts({
    sessionId: 'v15-replay',
    playerIds: ['floorborn-001', 'peer-001'],
    receipts: game.receipts,
  });
  assert.deepEqual(replayed, game.publicState());
});
