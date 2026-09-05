import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import {
  ExpeditionSession,
  layoutForSeed,
  replayExpedition,
  runFloorbornExpedition,
} from '../src/expedition-rpg.js';

function actionById(game, playerId, id) {
  const observation = game.observe(playerId);
  const action = observation.legalActions.find((candidate) => candidate.id === id);
  assert.ok(action, `${id} should be legal for ${playerId}`);
  return action;
}

test('hidden expedition contents stay hidden until inspect', () => {
  const game = new ExpeditionSession({ sessionId: 'hidden', seed: 3 });
  const observation = game.observe('floorborn-001');
  assert.equal(JSON.stringify(observation).includes('ember-seal'), false);

  game.step('floorborn-001', actionById(game, 'floorborn-001', 'move:archive'));
  const atArchive = game.observe('floorborn-001');
  assert.equal(atArchive.place.known, false);
  assert.equal('discovery' in atArchive.place, false);
});

test('Floorborn completes many unseen layouts without a scripted action sequence', () => {
  for (let seed = 0; seed < 16; seed += 1) {
    const floorborn = new FloorbornPlayer({ playerId: 'floorborn-001' });
    const { game } = runFloorbornExpedition({
      floorborn,
      sessionId: `seed-${seed}`,
      seed,
      maxTurns: 40,
    });

    assert.equal(game.isComplete(), true, `seed ${seed} should complete`);
    assert.ok(game.turn <= 40);

    const replayed = replayExpedition({
      sessionId: `seed-${seed}`,
      seed,
      receipts: game.receipts,
    });
    assert.deepEqual(replayed, game.publicState());
  }
});

test('different hidden layouts create different lived action histories', () => {
  const traces = [];
  for (const seed of [0, 1, 2, 3]) {
    const floorborn = new FloorbornPlayer({ playerId: 'floorborn-001' });
    const { game } = runFloorbornExpedition({
      floorborn,
      sessionId: `trace-${seed}`,
      seed,
      maxTurns: 40,
    });
    traces.push(game.receipts.map((receipt) => receipt.action.id).join('|'));
  }
  assert.ok(new Set(traces).size >= 3);
});

test('a bad prior experience can causally change the first route in a later world', () => {
  let trainingSeed = null;
  for (let seed = 0; seed < 20; seed += 1) {
    if (layoutForSeed(seed).archive.kind === 'trap') {
      trainingSeed = seed;
      break;
    }
  }
  assert.notEqual(trainingSeed, null);

  const veteran = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const training = new ExpeditionSession({ sessionId: 'training', seed: trainingSeed });

  let observation = training.observe('floorborn-001');
  let action = observation.legalActions.find((candidate) => candidate.id === 'move:archive');
  let receipt = training.step('floorborn-001', action);
  veteran.learn(receipt);

  observation = training.observe('floorborn-001');
  action = observation.legalActions[0];
  receipt = training.step('floorborn-001', action);
  veteran.learn(receipt);

  const fresh = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const freshGame = new ExpeditionSession({ sessionId: 'fresh-later', seed: 7 });
  const veteranGame = new ExpeditionSession({ sessionId: 'veteran-later', seed: 7 });

  const freshAction = fresh.decide(freshGame.observe('floorborn-001'));
  const veteranAction = veteran.decide(veteranGame.observe('floorborn-001'));

  assert.equal(freshAction.id, 'move:archive');
  assert.notEqual(veteranAction.id, 'move:archive');

  const archiveProposal = veteran.lastDecision.proposals.find((proposal) => proposal.actionId === 'move:archive');
  assert.ok(archiveProposal.evidence.some(
    (line) => line.startsWith('memory:ancient=') || line.startsWith('memory:knowledge='),
  ));
});

test('two-player disturbance is absorbed through world state rather than a fixed script', () => {
  const game = new ExpeditionSession({
    sessionId: 'disturbance',
    seed: 0,
    playerIds: ['floorborn-001', 'peer-001'],
  });
  const floorborn = new FloorbornPlayer({ playerId: 'floorborn-001' });

  let safety = 0;
  while (!game.isComplete() && safety < 50) {
    safety += 1;
    const playerId = game.activePlayerId();
    const observation = game.observe(playerId);
    let action;

    if (playerId === 'floorborn-001') {
      action = floorborn.decide(observation);
    } else {
      action = observation.legalActions.find((candidate) => candidate.kind === 'gather')
        ?? observation.legalActions.find((candidate) => candidate.id === 'move:grove')
        ?? observation.legalActions.find((candidate) => candidate.kind === 'inspect')
        ?? observation.legalActions.find((candidate) => candidate.id === 'move:camp')
        ?? observation.legalActions[0];
    }

    const receipt = game.step(playerId, action);
    if (playerId === 'floorborn-001') floorborn.learn(receipt);
  }

  assert.equal(game.isComplete(), true);
  assert.ok(game.receipts.some((receipt) => receipt.playerId === 'peer-001'));
  assert.ok(game.receipts.some(
    (receipt) => receipt.playerId === 'floorborn-001' && receipt.action.id === 'signal:open-gate',
  ));
});
