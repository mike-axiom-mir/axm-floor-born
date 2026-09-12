import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import {
  ConsequenceContestedRtsSession,
  replayConsequenceContestedRts,
} from '../src/consequence-contested-rts.js';
import { ingestVisibleConsequences } from '../src/visible-consequence.js';

const training = new ConsequenceContestedRtsSession({
  sessionId: 'v11-incoming-training',
  playerIds: ['floorborn-001', 'peer-001'],
});

training.step('floorborn-001', legal(training, 'floorborn-001', 'command:move:army-alpha:center'));
training.step('peer-001', legal(training, 'peer-001', 'command:move:army-alpha:center'));
training.step('floorborn-001', legal(training, 'floorborn-001', 'wait:yield-window'));
training.step('peer-001', legal(training, 'peer-001', 'command:attack:army-alpha:army-alpha'));
training.step('peer-001', legal(training, 'peer-001', 'wait:yield-window'));

const damageObservation = training.observe('floorborn-001');
assert.equal(damageObservation.rts.recentVisibleEvents.length, 1);
assert.equal(damageObservation.rts.recentVisibleEvents[0].eventId, 'incoming:damaged:army-alpha');

const veteran = new FloorbornPlayer({
  playerId: 'floorborn-001',
  lineageId: 'v11-visible-consequence-veteran',
});
const ingested = ingestVisibleConsequences(veteran, damageObservation);
assert.equal(ingested.length, 1);
assert.equal(ingestVisibleConsequences(veteran, damageObservation).length, 0);

training.step('floorborn-001', legal(training, 'floorborn-001', 'wait:yield-window'));
const trainingReplay = replayConsequenceContestedRts({
  sessionId: 'v11-incoming-training',
  playerIds: ['floorborn-001', 'peer-001'],
  receipts: training.receipts,
});
assert.deepEqual(trainingReplay, training.publicState());

const restored = FloorbornPlayer.restore(veteran.snapshot());
assert.deepEqual(restored.memory.observedConsequences, veteran.memory.observedConsequences);
assert.deepEqual(restored.memory.visibleConsequenceKeys, veteran.memory.visibleConsequenceKeys);

const later = new ConsequenceContestedRtsSession({
  sessionId: 'v11-same-later-state',
  playerIds: ['floorborn-001', 'peer-001'],
});
later.step('floorborn-001', legal(later, 'floorborn-001', 'command:move:army-alpha:center'));
later.step('peer-001', legal(later, 'peer-001', 'command:move:army-alpha:center'));
const sameLaterObservation = later.observe('floorborn-001');

const fresh = new FloorbornPlayer({
  playerId: 'floorborn-001',
  lineageId: 'v11-visible-consequence-fresh',
});
fresh.decide(sameLaterObservation);
const freshAttack = proposal(fresh, 'command:attack:army-alpha:army-alpha');

veteran.decide(sameLaterObservation);
const veteranAttack = proposal(veteran, 'command:attack:army-alpha:army-alpha');

assert.ok(veteranAttack.score < freshAttack.score);
assert.ok(veteranAttack.evidence.some((line) => line.startsWith('memory:combat=-')));

console.log(JSON.stringify({
  gate: 'AXM Floorborn v0.11 visible consequence intake',
  status: 'PASS',
  trainingEvent: ingested[0],
  intake: {
    firstIngestCount: ingested.length,
    duplicateIngestCount: 0,
    combatPattern: veteran.memory.tagPatterns.combat,
    snapshotRestore: 'PASS',
  },
  sameLaterAttackOpportunity: {
    actionId: 'command:attack:army-alpha:army-alpha',
    freshScore: freshAttack.score,
    freshEvidence: freshAttack.evidence,
    veteranScore: veteranAttack.score,
    veteranEvidence: veteranAttack.evidence,
    scoreDelta: Math.round((veteranAttack.score - freshAttack.score) * 1000) / 1000,
  },
  trainingReplay: 'PASS',
  claimBoundary: 'Incoming player-visible combat consequences can alter later inspectable arbitration. No retreat policy or subjective-state claim is added.',
}, null, 2));

function legal(game, playerId, actionId) {
  const action = game.observe(playerId).legalActions.find((candidate) => candidate.id === actionId);
  assert.ok(action, `${actionId} should be legal for ${playerId}`);
  return action;
}

function proposal(player, actionId) {
  const found = player.lastDecision.proposals.find((candidate) => candidate.actionId === actionId);
  assert.ok(found, `${actionId} proposal should exist`);
  return found;
}
