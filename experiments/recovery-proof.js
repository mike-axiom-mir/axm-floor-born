import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import {
  ConsequenceContestedRtsSession,
  replayConsequenceContestedRts,
} from '../src/consequence-contested-rts.js';
import { ingestVisibleConsequences } from '../src/visible-consequence.js';

const { game, observation } = buildCriticalState('v12-recovery-proof');

const baseline = new FloorbornPlayer({ playerId: 'floorborn-001' });
const baselineChoice = baseline.decide(observation);
const baselineAttack = proposal(baseline, 'command:attack:army-alpha:army-alpha');
const baselineRetreat = proposal(baseline, 'command:retreat:army-alpha:base');
assert.equal(baselineChoice.id, 'command:attack:army-alpha:army-alpha');
assert.equal(hasCriticalEvidence(baselineRetreat), false);

const freshPerspective = new FloorbornPlayer({
  playerId: 'floorborn-001',
  lineageId: 'v12-fresh-perspective',
  perspectives: { criticalRecovery: true },
});
const freshChoice = freshPerspective.decide(observation);
const freshAttack = proposal(freshPerspective, 'command:attack:army-alpha:army-alpha');
const freshRetreat = proposal(freshPerspective, 'command:retreat:army-alpha:base');
assert.equal(freshAttack.score, 3);
assert.equal(freshRetreat.score, 3);
assert.equal(freshChoice.id, 'command:attack:army-alpha:army-alpha');
assert.equal(hasCriticalEvidence(freshRetreat), true);

const veteran = new FloorbornPlayer({
  playerId: 'floorborn-001',
  lineageId: 'v12-experienced-perspective',
  perspectives: { criticalRecovery: true },
});
const ingested = ingestVisibleConsequences(veteran, observation);
assert.equal(ingested.length, 1);
const veteranChoice = veteran.decide(observation);
const veteranAttack = proposal(veteran, 'command:attack:army-alpha:army-alpha');
const veteranRetreat = proposal(veteran, 'command:retreat:army-alpha:base');
assert.equal(veteranChoice.id, 'command:retreat:army-alpha:base');
assert.equal(veteranAttack.score, 2.325);
assert.equal(veteranRetreat.score, 3);

const receipt = game.step('floorborn-001', veteranChoice);
veteran.learn(receipt);
assert.equal(receipt.outcome.eventId, 'retreated:army-alpha:base');

const replayed = replayConsequenceContestedRts({
  sessionId: 'v12-recovery-proof',
  playerIds: ['floorborn-001', 'peer-001'],
  receipts: game.receipts,
});
assert.deepEqual(replayed, game.publicState());

const restored = FloorbornPlayer.restore(veteran.snapshot());
assert.equal(restored.perspectives.criticalRecovery, true);
assert.deepEqual(restored.memory.observedConsequences, veteran.memory.observedConsequences);

console.log(JSON.stringify({
  gate: 'AXM Floorborn v0.12 critical-state recovery perspective',
  status: 'PASS',
  sameCriticalState: {
    ownGroup: 'army-alpha',
    integrity: 1,
    position: 'center',
    legalAttack: true,
    legalRetreat: true,
  },
  baselinePerspectiveOff: {
    selected: baselineChoice.id,
    attackScore: baselineAttack.score,
    retreatScore: baselineRetreat.score,
    retreatEvidence: baselineRetreat.evidence,
  },
  freshPerspectiveOn: {
    selected: freshChoice.id,
    attackScore: freshAttack.score,
    retreatScore: freshRetreat.score,
    attackEvidence: freshAttack.evidence,
    retreatEvidence: freshRetreat.evidence,
  },
  experiencedPerspectiveOn: {
    incomingEvent: ingested[0],
    selected: veteranChoice.id,
    attackScore: veteranAttack.score,
    retreatScore: veteranRetreat.score,
    attackEvidence: veteranAttack.evidence,
    retreatEvidence: veteranRetreat.evidence,
    committedOutcome: receipt.outcome.eventId,
  },
  separation: {
    baselinePreserved: baselineChoice.id === 'command:attack:army-alpha:army-alpha',
    currentStateAloneForcedRetreat: false,
    historyPlusCurrentStateChangedChoice: true,
  },
  replay: 'PASS',
  snapshotRestore: 'PASS',
}, null, 2));

function buildCriticalState(sessionId) {
  const session = new ConsequenceContestedRtsSession({
    sessionId,
    playerIds: ['floorborn-001', 'peer-001'],
  });
  session.step('floorborn-001', legal(session, 'floorborn-001', 'command:move:army-alpha:center'));
  session.step('peer-001', legal(session, 'peer-001', 'command:move:army-alpha:center'));
  session.step('floorborn-001', legal(session, 'floorborn-001', 'wait:yield-window'));
  session.step('peer-001', legal(session, 'peer-001', 'command:attack:army-alpha:army-alpha'));
  session.step('peer-001', legal(session, 'peer-001', 'wait:yield-window'));
  const bounded = session.observe('floorborn-001');
  return { game: session, observation: bounded };
}

function legal(session, playerId, actionId) {
  const action = session.observe(playerId).legalActions.find((candidate) => candidate.id === actionId);
  assert.ok(action, `${actionId} should be legal for ${playerId}`);
  return action;
}

function proposal(player, actionId) {
  const found = player.lastDecision.proposals.find((candidate) => candidate.actionId === actionId);
  assert.ok(found, `${actionId} proposal should exist`);
  return found;
}

function hasCriticalEvidence(proposalValue) {
  return proposalValue.evidence.some((line) => line.startsWith('critical-state-recovery:'));
}
