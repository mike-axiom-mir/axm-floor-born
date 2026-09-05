import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import {
  ExpeditionSession,
  layoutForSeed,
  replayExpedition,
} from '../src/expedition-rpg.js';

function stepFloorborn(game, floorborn) {
  const observation = game.observe(floorborn.playerId);
  const action = floorborn.decide(observation);
  const decision = structuredClone(floorborn.lastDecision);
  const receipt = game.step(floorborn.playerId, action);
  floorborn.learn(receipt);
  return { observation, action, decision, receipt };
}

test('companion observations are explicit, idempotent, and survive snapshot restore', () => {
  const floorborn = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const game = new ExpeditionSession({
    sessionId: 'companion-context',
    seed: 0,
    playerIds: ['floorborn-001', 'chat-001'],
  });

  const observation = game.observe('floorborn-001');
  floorborn.decide(observation);
  floorborn.decide(observation);

  const companion = floorborn.memory.companions['chat-001'];
  assert.equal(companion.observedTurns, 1, 'same observation must not be counted twice');
  assert.deepEqual(companion.sharedSessions, ['companion-context']);
  assert.equal('trust' in companion, false);

  const restored = FloorbornPlayer.restore(floorborn.snapshot());
  assert.deepEqual(restored.snapshot(), floorborn.snapshot());
});

test('familiar companion history can change a later coordination choice without affecting a stranger', () => {
  const veteran = new FloorbornPlayer({ playerId: 'floorborn-001' });

  for (let index = 0; index < 7; index += 1) {
    const training = new ExpeditionSession({
      sessionId: `shared-${index}`,
      seed: index,
      playerIds: ['floorborn-001', 'chat-001'],
    });
    veteran.decide(training.observe('floorborn-001'));
  }

  const samePeer = FloorbornPlayer.restore(veteran.snapshot());
  const stranger = FloorbornPlayer.restore(veteran.snapshot());

  const sameGame = new ExpeditionSession({
    sessionId: 'same-peer-later',
    seed: 11,
    playerIds: ['floorborn-001', 'chat-001'],
  });
  const strangerGame = new ExpeditionSession({
    sessionId: 'stranger-later',
    seed: 11,
    playerIds: ['floorborn-001', 'chat-999'],
  });

  const sameAction = samePeer.decide(sameGame.observe('floorborn-001'));
  const strangerAction = stranger.decide(strangerGame.observe('floorborn-001'));

  assert.equal(sameAction.id, 'signal:explore');
  assert.notEqual(strangerAction.id, 'signal:explore');

  const coordination = samePeer.lastDecision.proposals.find((proposal) => proposal.actionId === 'signal:explore');
  assert.ok(coordination.evidence.some((line) => line.startsWith('companion:chat-001=+')));
});

test('Floorborn can make a bad exploration choice, learn from it, recover, and still finish the same session', () => {
  let trapSeed = null;
  for (let seed = 0; seed < 32; seed += 1) {
    if (layoutForSeed(seed).archive.kind === 'trap') {
      trapSeed = seed;
      break;
    }
  }
  assert.notEqual(trapSeed, null);

  const floorborn = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const game = new ExpeditionSession({ sessionId: 'mistake-recovery', seed: trapSeed });

  const first = stepFloorborn(game, floorborn);
  assert.equal(first.action.id, 'move:archive');

  const second = stepFloorborn(game, floorborn);
  assert.equal(second.action.id, 'inspect:archive');
  assert.match(second.receipt.outcome.eventId, /^trap:/);
  assert.ok(second.receipt.outcome.utility < 0);

  const third = stepFloorborn(game, floorborn);
  assert.equal(third.action.id, 'move:camp');

  const recoveryObservation = game.observe('floorborn-001');
  const recoveryAction = floorborn.decide(recoveryObservation);
  const recoveryDecision = structuredClone(floorborn.lastDecision);
  assert.notEqual(recoveryAction.id, 'move:archive');

  const archiveProposal = recoveryDecision.proposals.find((proposal) => proposal.actionId === 'move:archive');
  assert.ok(archiveProposal.evidence.some((line) => (
    line.startsWith('memory:ancient=-') || line.startsWith('memory:knowledge=-')
  )));

  let receipt = game.step('floorborn-001', recoveryAction);
  floorborn.learn(receipt);

  while (!game.isComplete() && game.turn < 40) {
    ({ receipt } = stepFloorborn(game, floorborn));
  }

  assert.equal(game.isComplete(), true);
  assert.ok(game.receipts.some((entry) => entry.outcome.eventId.startsWith('trap:')));

  const replayed = replayExpedition({
    sessionId: 'mistake-recovery',
    seed: trapSeed,
    receipts: game.receipts,
  });
  assert.deepEqual(replayed, game.publicState());
});

test('companion memory is lineage-local and does not leak into a fresh Floorborn identity', () => {
  const experienced = new FloorbornPlayer({ playerId: 'floorborn-001', lineageId: 'lineage-a' });
  for (let index = 0; index < 3; index += 1) {
    const game = new ExpeditionSession({
      sessionId: `lineage-session-${index}`,
      seed: index,
      playerIds: ['floorborn-001', 'chat-001'],
    });
    experienced.decide(game.observe('floorborn-001'));
  }

  const fresh = new FloorbornPlayer({ playerId: 'floorborn-001', lineageId: 'lineage-b' });
  assert.ok(experienced.memory.companions['chat-001']);
  assert.equal(fresh.memory.companions['chat-001'], undefined);
});
