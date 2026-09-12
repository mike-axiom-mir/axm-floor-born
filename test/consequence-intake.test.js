import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import {
  ConsequenceContestedRtsSession,
  replayConsequenceContestedRts,
} from '../src/consequence-contested-rts.js';
import { ingestVisibleConsequences } from '../src/visible-consequence.js';

function actionById(game, playerId, id) {
  const action = game.observe(playerId).legalActions.find((candidate) => candidate.id === id);
  assert.ok(action, `${id} should be legal for ${playerId}`);
  return action;
}

function produceIncomingDamage(sessionId = 'incoming-damage') {
  const game = new ConsequenceContestedRtsSession({
    sessionId,
    playerIds: ['floorborn-001', 'peer-001'],
  });

  game.step('floorborn-001', actionById(game, 'floorborn-001', 'command:move:army-alpha:center'));
  game.step('peer-001', actionById(game, 'peer-001', 'command:move:army-alpha:center'));
  game.step('floorborn-001', actionById(game, 'floorborn-001', 'wait:yield-window'));
  game.step('peer-001', actionById(game, 'peer-001', 'command:attack:army-alpha:army-alpha'));

  // Window 1 starts on peer-001. Peer yields so Floorborn gets the next bounded
  // command opportunity with the incoming damage event in its own observation.
  game.step('peer-001', actionById(game, 'peer-001', 'wait:yield-window'));
  const observation = game.observe('floorborn-001');
  return { game, observation };
}

test('opponent-caused damage becomes a bounded visible event only for the affected player', () => {
  const game = new ConsequenceContestedRtsSession({
    sessionId: 'incoming-privacy',
    playerIds: ['floorborn-001', 'peer-001'],
  });

  game.step('floorborn-001', actionById(game, 'floorborn-001', 'command:move:army-alpha:center'));
  game.step('peer-001', actionById(game, 'peer-001', 'command:move:army-alpha:center'));
  game.step('floorborn-001', actionById(game, 'floorborn-001', 'wait:yield-window'));
  game.step('peer-001', actionById(game, 'peer-001', 'command:attack:army-alpha:army-alpha'));

  assert.equal(game.publicState().visibleEventsByPlayer['floorborn-001'].length, 1);
  assert.equal(game.publicState().visibleEventsByPlayer['peer-001'].length, 0);

  const peerView = game.observe('peer-001');
  assert.deepEqual(peerView.rts.recentVisibleEvents, []);
  assert.equal(JSON.stringify(peerView).includes('hidden-contested-doctrine'), false);

  game.step('peer-001', actionById(game, 'peer-001', 'wait:yield-window'));
  const floorView = game.observe('floorborn-001');
  assert.equal(floorView.rts.recentVisibleEvents.length, 1);
  assert.equal(floorView.rts.recentVisibleEvents[0].eventId, 'incoming:damaged:army-alpha');
  assert.equal(floorView.rts.recentVisibleEvents[0].sourcePlayerId, 'peer-001');
  assert.equal(floorView.rts.recentVisibleEvents[0].utility < 0, true);
});

test('visible consequence intake is idempotent and creates explicit negative combat evidence', () => {
  const { observation } = produceIncomingDamage('incoming-idempotent');
  const floorborn = new FloorbornPlayer({ playerId: 'floorborn-001' });

  const first = ingestVisibleConsequences(floorborn, observation);
  const second = ingestVisibleConsequences(floorborn, observation);

  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
  assert.equal(floorborn.memory.observedConsequences.length, 1);
  assert.equal(floorborn.memory.observedConsequences[0].kind, 'combat-damage');
  assert.equal(floorborn.memory.tagPatterns.combat.count, 1);
  assert.equal(floorborn.memory.tagPatterns.combat.totalSignal < 0, true);
});

test('incoming consequence memory survives Floorborn snapshot and restore without becoming hidden engine state', () => {
  const { observation } = produceIncomingDamage('incoming-restore');
  const floorborn = new FloorbornPlayer({ playerId: 'floorborn-001' });
  ingestVisibleConsequences(floorborn, observation);

  const restored = FloorbornPlayer.restore(floorborn.snapshot());
  assert.deepEqual(restored.memory.observedConsequences, floorborn.memory.observedConsequences);
  assert.deepEqual(restored.memory.visibleConsequenceKeys, floorborn.memory.visibleConsequenceKeys);
  assert.deepEqual(restored.memory.tagPatterns.combat, floorborn.memory.tagPatterns.combat);
  assert.equal(JSON.stringify(restored.memory).includes('hidden-contested-doctrine'), false);
});

test('a veteran exposed to incoming damage values the same later attack less than a fresh Floorborn', () => {
  const { observation: damageObservation } = produceIncomingDamage('incoming-training');
  const veteran = new FloorbornPlayer({ playerId: 'floorborn-001' });
  ingestVisibleConsequences(veteran, damageObservation);

  const fresh = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const later = new ConsequenceContestedRtsSession({
    sessionId: 'same-later-combat-state',
    playerIds: ['floorborn-001', 'peer-001'],
  });
  later.step('floorborn-001', actionById(later, 'floorborn-001', 'command:move:army-alpha:center'));
  later.step('peer-001', actionById(later, 'peer-001', 'command:move:army-alpha:center'));
  const sameObservation = later.observe('floorborn-001');

  fresh.decide(sameObservation);
  const freshAttack = fresh.lastDecision.proposals.find(
    (proposal) => proposal.actionId === 'command:attack:army-alpha:army-alpha',
  );
  veteran.decide(sameObservation);
  const veteranAttack = veteran.lastDecision.proposals.find(
    (proposal) => proposal.actionId === 'command:attack:army-alpha:army-alpha',
  );

  assert.ok(freshAttack);
  assert.ok(veteranAttack);
  assert.equal(veteranAttack.score < freshAttack.score, true);
  assert.ok(veteranAttack.evidence.some((line) => line.startsWith('memory:combat=-')));
});

test('incoming consequence queues and combat effects replay exactly', () => {
  const { game } = produceIncomingDamage('incoming-replay');
  game.step('floorborn-001', actionById(game, 'floorborn-001', 'wait:yield-window'));

  const replayed = replayConsequenceContestedRts({
    sessionId: 'incoming-replay',
    playerIds: ['floorborn-001', 'peer-001'],
    receipts: game.receipts,
  });
  assert.deepEqual(replayed, game.publicState());
});
