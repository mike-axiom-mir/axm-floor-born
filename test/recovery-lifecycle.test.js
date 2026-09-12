import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import { ConsequenceContestedRtsSession } from '../src/consequence-contested-rts.js';
import { ingestVisibleConsequences } from '../src/visible-consequence.js';

function legal(game, playerId, actionId) {
  const action = game.observe(playerId).legalActions.find((candidate) => candidate.id === actionId);
  assert.ok(action, `${actionId} should be legal for ${playerId}`);
  return action;
}

function criticalState(sessionId) {
  const game = new ConsequenceContestedRtsSession({
    sessionId,
    playerIds: ['floorborn-001', 'peer-001'],
  });
  game.step('floorborn-001', legal(game, 'floorborn-001', 'command:move:army-alpha:center'));
  game.step('peer-001', legal(game, 'peer-001', 'command:move:army-alpha:center'));
  game.step('floorborn-001', legal(game, 'floorborn-001', 'wait:yield-window'));
  game.step('peer-001', legal(game, 'peer-001', 'command:attack:army-alpha:army-alpha'));
  game.step('peer-001', legal(game, 'peer-001', 'wait:yield-window'));
  return { game, observation: game.observe('floorborn-001') };
}

function recoveryPlayer({ lifecycle = true } = {}) {
  return new FloorbornPlayer({
    playerId: 'floorborn-001',
    perspectives: {
      criticalRecovery: true,
      recoveryLifecycle: lifecycle,
    },
  });
}

function createRetreat({ sessionId, lifecycle = true } = {}) {
  const { game, observation } = criticalState(sessionId);
  const player = recoveryPlayer({ lifecycle });
  ingestVisibleConsequences(player, observation);
  const retreat = player.decide(observation);
  assert.equal(retreat.id, 'command:retreat:army-alpha:base');
  const receipt = game.step('floorborn-001', retreat);
  player.learn(receipt);
  return { game, player, receipt };
}

function proposal(player, actionId) {
  const found = player.lastDecision.proposals.find((candidate) => candidate.actionId === actionId);
  assert.ok(found, `${actionId} proposal should exist`);
  return found;
}

test('recovery lifecycle is opt-in and disabled players create no pending recovery record', () => {
  const { player } = createRetreat({ sessionId: 'v14-off', lifecycle: false });
  assert.equal(player.perspectives.recoveryLifecycle, false);
  assert.deepEqual(player.activeRecoveries(), []);
});

test('retreat creates an inspectable group-specific pending recovery lifecycle with provenance', () => {
  const { player, receipt } = createRetreat({ sessionId: 'v14-create' });
  const active = player.activeRecoveries();

  assert.equal(active.length, 1);
  assert.equal(active[0].groupId, 'army-alpha');
  assert.equal(active[0].status, 'pending');
  assert.equal(active[0].createdSessionId, 'v14-create');
  assert.equal(active[0].createdTurn, receipt.turn);
  assert.equal(active[0].createdWindowIndex, receipt.windowIndex);
  assert.equal(active[0].sourceActionId, 'command:retreat:army-alpha:base');
  assert.equal(active[0].sourceEventId, 'retreated:army-alpha:base');
});

test('same-window recovery hold penalizes only immediate re-entry by the recovering group', () => {
  const { game, player } = createRetreat({ sessionId: 'v14-hold' });
  const observation = game.observe('floorborn-001');
  const selected = player.decide(observation);

  const alphaReentry = proposal(player, 'command:move:army-alpha:center');
  const betaMove = proposal(player, 'command:move:army-beta:center');

  assert.ok(alphaReentry.evidence.includes('recovery-lifecycle-hold:army-alpha=-3'));
  assert.equal(betaMove.evidence.some((line) => line.startsWith('recovery-lifecycle-hold:')), false);
  assert.notEqual(selected.id, 'command:move:army-alpha:center');
});

test('pending recovery survives snapshot restore and retires when the action window advances', () => {
  const { game, player } = createRetreat({ sessionId: 'v14-window-retire' });
  const restored = FloorbornPlayer.restore(player.snapshot());
  assert.equal(restored.perspectives.recoveryLifecycle, true);
  assert.equal(restored.activeRecoveries().length, 1);

  const observation = game.observe('floorborn-001');
  const selected = restored.decide(observation);
  assert.notEqual(selected.id, 'command:move:army-alpha:center');
  const receipt = game.step('floorborn-001', selected);
  restored.learn(receipt);

  assert.equal(game.publicState().windowIndex > restored.memory.recoveries[0].createdWindowIndex, true);
  const nextObservation = game.observe('floorborn-001');
  restored.decide(nextObservation);

  assert.equal(restored.activeRecoveries().length, 0);
  const retired = restored.memory.recoveries[0];
  assert.equal(retired.status, 'completed');
  assert.equal(retired.retiredEventId, 'recovery-completed:window-advanced');

  const alphaMove = proposal(restored, 'command:move:army-alpha:center');
  assert.equal(alphaMove.evidence.some((line) => line.startsWith('recovery-lifecycle-hold:')), false);
});

test('manual same-window override retires recovery explicitly rather than leaving stale state', () => {
  const { game, player } = createRetreat({ sessionId: 'v14-override' });
  const override = legal(game, 'floorborn-001', 'command:move:army-alpha:center');
  const receipt = game.step('floorborn-001', override);
  player.learn(receipt);

  assert.equal(player.activeRecoveries().length, 0);
  assert.equal(player.memory.recoveries[0].status, 'overridden');
  assert.equal(player.memory.recoveries[0].retiredEventId, 'recovery-overridden:command:move:army-alpha:center');
});

test('missing recovering group invalidates the lifecycle on the next bounded observation', () => {
  const { game, player } = createRetreat({ sessionId: 'v14-invalidate' });
  const observation = structuredClone(game.observe('floorborn-001'));
  observation.rts.ownGroups = observation.rts.ownGroups.filter((group) => group.id !== 'army-alpha');
  observation.legalActions = observation.legalActions.filter(
    (action) => !(action.affectedGroups ?? []).includes('army-alpha'),
  );

  player.decide(observation);
  assert.equal(player.activeRecoveries().length, 0);
  assert.equal(player.memory.recoveries[0].status, 'invalidated');
  assert.equal(player.memory.recoveries[0].retiredEventId, 'recovery-invalidated:group-unavailable');
});
