import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import { RTS_PLAYER_PROTOCOL_VERSION } from '../src/protocol.js';
import {
  effectiveCommandCost,
  replayRtsSession,
  RtsActionBudgetSession,
  RTS_EFFECTIVE_ACTIONS_PER_WINDOW,
  RTS_EFFECTIVE_APM_LIMIT,
  RTS_WINDOW_SECONDS,
  runRtsFloorbornProof,
} from '../src/rts-lab.js';

function actionById(game, id) {
  const action = game.observe().legalActions.find((candidate) => candidate.id === id);
  assert.ok(action, `${id} should be legal`);
  return action;
}

test('RTS observation uses a bounded sibling player protocol and hides engine-only enemy truth', () => {
  const game = new RtsActionBudgetSession({ sessionId: 'rts-hidden-boundary' });
  const observation = game.observe();
  const text = JSON.stringify(observation);

  assert.equal(observation.protocol, RTS_PLAYER_PROTOCOL_VERSION);
  assert.equal(observation.rts.effectiveApmLimit, 24);
  assert.equal(text.includes('hidden-engine-only'), false);
  assert.equal(text.includes('enemy-reserve'), false);
  assert.equal(text.includes('enemy-base'), false);
  assert.equal('hiddenEnemy' in observation, false);
});

test('equivalent player architectures receive the same RTS action budget and command vocabulary', () => {
  const floorbornGame = new RtsActionBudgetSession({
    sessionId: 'rts-equality-floorborn',
    playerId: 'floorborn-001',
  });
  const chatGame = new RtsActionBudgetSession({
    sessionId: 'rts-equality-chat',
    playerId: 'chat-001',
  });

  const floorObservation = floorbornGame.observe();
  const chatObservation = chatGame.observe();

  assert.equal(floorObservation.rts.windowSeconds, chatObservation.rts.windowSeconds);
  assert.equal(floorObservation.rts.maxEffectiveActionsPerWindow, chatObservation.rts.maxEffectiveActionsPerWindow);
  assert.equal(floorObservation.rts.effectiveApmLimit, chatObservation.rts.effectiveApmLimit);
  assert.equal(floorObservation.rts.budgetRemaining, chatObservation.rts.budgetRemaining);
  assert.deepEqual(
    floorObservation.legalActions.map((action) => action.id).sort(),
    chatObservation.legalActions.map((action) => action.id).sort(),
  );
});

test('effective APM is derived from deterministic action budget and window length', () => {
  assert.equal(RTS_WINDOW_SECONDS, 5);
  assert.equal(RTS_EFFECTIVE_ACTIONS_PER_WINDOW, 2);
  assert.equal(RTS_EFFECTIVE_APM_LIMIT, 24);
});

test('one API command cannot hide multiple independently retasked squads behind cost one', () => {
  const game = new RtsActionBudgetSession({ sessionId: 'rts-multi-group-cost' });
  const pair = actionById(game, 'command:move:army-pair:hill');

  assert.deepEqual(pair.affectedGroups, ['army-alpha', 'army-beta']);
  assert.equal(effectiveCommandCost(pair), 2);
  assert.equal(pair.effectiveCost, 2);

  const dishonest = { ...pair, effectiveCost: 1 };
  const before = game.publicState();
  assert.throws(() => game.step(dishonest), /effective cost mismatch/);
  assert.deepEqual(game.publicState(), before);
});

test('a stale command that exceeds remaining budget is rejected before world mutation', () => {
  const game = new RtsActionBudgetSession({ sessionId: 'rts-over-budget' });
  const pair = actionById(game, 'command:move:army-pair:hill');
  const build = actionById(game, 'command:build:power-node');

  game.step(build);
  assert.equal(game.publicState().budgetRemaining, 1);
  const before = game.publicState();

  assert.throws(() => game.step(pair), /action budget exceeded/);
  assert.deepEqual(game.publicState(), before);
  assert.equal(game.publicState().groups['army-alpha'].position, 'base');
  assert.equal(game.publicState().groups['army-beta'].position, 'base');
});

test('budget exhaustion removes unaffordable commands and deterministic window advance replenishes the budget', () => {
  const game = new RtsActionBudgetSession({ sessionId: 'rts-window-refresh' });
  const pair = actionById(game, 'command:move:army-pair:hill');
  const receipts = [game.step(pair)];

  let observation = game.observe();
  assert.equal(observation.rts.budgetRemaining, 0);
  assert.deepEqual(observation.legalActions.map((action) => action.id), ['wait:advance-window']);

  const advance = observation.legalActions[0];
  receipts.push(game.step(advance));
  observation = game.observe();

  assert.equal(observation.rts.windowIndex, 1);
  assert.equal(observation.rts.budgetRemaining, 2);
  assert.equal(observation.rts.resources, 55);

  const replayed = replayRtsSession({
    sessionId: 'rts-window-refresh',
    receipts,
  });
  assert.deepEqual(replayed, game.publicState());
});

test('RTS receipts expose effective action cost and exact budget consumption', () => {
  const game = new RtsActionBudgetSession({ sessionId: 'rts-receipt-budget' });
  const pair = actionById(game, 'command:move:army-pair:hill');
  const receipt = game.step(pair);

  assert.equal(receipt.effectiveCost, 2);
  assert.equal(receipt.budgetBefore, 2);
  assert.equal(receipt.budgetAfter, 0);
  assert.equal(receipt.action.affectedGroups.length, 2);
});

test('Floorborn transfers into the RTS player door and allocates scarce first-window agency to the objective', () => {
  const floorborn = new FloorbornPlayer({
    playerId: 'floorborn-001',
    lineageId: 'rts-transfer',
  });
  const run = runRtsFloorbornProof({
    player: floorborn,
    sessionId: 'rts-floorborn-transfer',
  });

  assert.equal(run.game.isComplete(), true);
  assert.equal(run.finalState.powerNodes, 1);
  assert.equal(run.finalState.scouted.north, true);
  assert.equal(run.finalState.windowIndex, 0);

  const commands = run.decisions.map((decision) => decision.action.id);
  assert.deepEqual(commands, [
    'command:build:power-node',
    'command:scout:north',
  ]);

  const spent = run.decisions.reduce(
    (total, decision) => total + decision.receipt.effectiveCost,
    0,
  );
  assert.equal(spent, 2);
  assert.equal(run.finalState.budgetRemaining, 0);
  assert.equal(commands.includes('command:scout:south'), false);
  assert.equal(commands.includes('command:move:army-alpha:hill'), false);
  assert.equal(commands.includes('command:move:army-pair:hill'), false);
});

test('Floorborn RTS run is exactly replayable from command receipts', () => {
  const floorborn = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const run = runRtsFloorbornProof({
    player: floorborn,
    sessionId: 'rts-floorborn-replay',
  });

  const replayed = replayRtsSession({
    sessionId: 'rts-floorborn-replay',
    receipts: run.game.receipts,
  });
  assert.deepEqual(replayed, run.finalState);
});
