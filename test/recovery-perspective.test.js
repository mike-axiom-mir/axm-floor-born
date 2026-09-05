import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import {
  ConsequenceContestedRtsSession,
  replayConsequenceContestedRts,
} from '../src/consequence-contested-rts.js';
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

  const observation = game.observe('floorborn-001');
  assert.equal(observation.rts.ownGroups.find((group) => group.id === 'army-alpha').integrity, 1);
  assert.equal(observation.rts.recentVisibleEvents.length, 1);
  assert.ok(observation.legalActions.some((action) => action.id === 'command:retreat:army-alpha:base'));
  assert.ok(observation.legalActions.some((action) => action.id === 'command:attack:army-alpha:army-alpha'));
  return { game, observation };
}

function proposal(player, actionId) {
  const found = player.lastDecision.proposals.find((candidate) => candidate.actionId === actionId);
  assert.ok(found, `${actionId} proposal should exist`);
  return found;
}

test('critical recovery perspective is opt-in and does not rewrite the v0.10 default baseline', () => {
  const { observation } = criticalState('v12-default-off');
  const baseline = new FloorbornPlayer({ playerId: 'floorborn-001' });

  const selected = baseline.decide(observation);
  const retreat = proposal(baseline, 'command:retreat:army-alpha:base');

  assert.equal(selected.id, 'command:attack:army-alpha:army-alpha');
  assert.equal(retreat.evidence.some((line) => line.startsWith('critical-state-recovery:')), false);
});

test('critical state alone makes recovery competitive without forcing retreat', () => {
  const { observation } = criticalState('v12-fresh-perspective');
  const fresh = new FloorbornPlayer({
    playerId: 'floorborn-001',
    perspectives: { criticalRecovery: true },
  });

  const selected = fresh.decide(observation);
  const attack = proposal(fresh, 'command:attack:army-alpha:army-alpha');
  const retreat = proposal(fresh, 'command:retreat:army-alpha:base');

  assert.equal(attack.score, 3);
  assert.equal(retreat.score, 3);
  assert.ok(retreat.evidence.includes('critical-state-recovery:army-alpha=+3'));
  assert.equal(selected.id, 'command:attack:army-alpha:army-alpha');
});

test('incoming damage history can tip the same critical state from attack to recovery', () => {
  const { game, observation } = criticalState('v12-history-tips-recovery');
  const veteran = new FloorbornPlayer({
    playerId: 'floorborn-001',
    perspectives: { criticalRecovery: true },
  });

  const ingested = ingestVisibleConsequences(veteran, observation);
  assert.equal(ingested.length, 1);

  const selected = veteran.decide(observation);
  const attack = proposal(veteran, 'command:attack:army-alpha:army-alpha');
  const retreat = proposal(veteran, 'command:retreat:army-alpha:base');

  assert.equal(selected.id, 'command:retreat:army-alpha:base');
  assert.equal(attack.score, 2.325);
  assert.equal(retreat.score, 3);
  assert.ok(attack.evidence.includes('memory:combat=-0.675'));
  assert.ok(retreat.evidence.includes('critical-state-recovery:army-alpha=+3'));

  const receipt = game.step('floorborn-001', selected);
  veteran.learn(receipt);
  assert.equal(receipt.outcome.eventId, 'retreated:army-alpha:base');
  assert.equal(game.publicState().players['floorborn-001'].groups['army-alpha'].position, 'base');

  const replayed = replayConsequenceContestedRts({
    sessionId: 'v12-history-tips-recovery',
    playerIds: ['floorborn-001', 'peer-001'],
    receipts: game.receipts,
  });
  assert.deepEqual(replayed, game.publicState());
});

test('critical recovery perspective and incoming consequence memory survive snapshot restore', () => {
  const { observation } = criticalState('v12-restore');
  const veteran = new FloorbornPlayer({
    playerId: 'floorborn-001',
    lineageId: 'v12-recovery-lineage',
    perspectives: { criticalRecovery: true },
  });
  ingestVisibleConsequences(veteran, observation);

  const restored = FloorbornPlayer.restore(veteran.snapshot());
  assert.equal(restored.perspectives.criticalRecovery, true);
  assert.deepEqual(restored.memory.observedConsequences, veteran.memory.observedConsequences);

  const selected = restored.decide(observation);
  assert.equal(selected.id, 'command:retreat:army-alpha:base');
  const retreat = proposal(restored, 'command:retreat:army-alpha:base');
  assert.ok(retreat.evidence.includes('critical-state-recovery:army-alpha=+3'));
});
