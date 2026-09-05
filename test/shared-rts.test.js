import test from 'node:test';
import assert from 'node:assert/strict';

import {
  replaySharedRts,
  SharedRtsSession,
} from '../src/shared-rts.js';

function actionById(game, playerId, id) {
  const action = game.observe(playerId).legalActions.find((candidate) => candidate.id === id);
  assert.ok(action, `${id} should be legal for ${playerId}`);
  return action;
}

function comparableObservation(observation) {
  return {
    protocol: observation.protocol,
    legal: observation.legalActions.map((action) => ({
      id: action.id,
      effectiveCost: action.effectiveCost,
      affectedGroups: action.affectedGroups ?? [],
    })),
    rts: {
      windowSeconds: observation.rts.windowSeconds,
      maxEffectiveActionsPerWindow: observation.rts.maxEffectiveActionsPerWindow,
      effectiveApmLimit: observation.rts.effectiveApmLimit,
      budgetRemaining: observation.rts.budgetRemaining,
      resources: observation.rts.resources,
      powerNodes: observation.rts.powerNodes,
      scouted: observation.rts.scouted,
      ownGroups: observation.rts.ownGroups,
      visibleEnemyContacts: observation.rts.visibleEnemyContacts,
    },
  };
}

test('mirrored player slots receive the same RTS boundary, vocabulary, and initial action budget', () => {
  const a = new SharedRtsSession({
    sessionId: 'shared-equality-a',
    playerIds: ['floorborn-001', 'chat-001'],
  });
  const b = new SharedRtsSession({
    sessionId: 'shared-equality-b',
    playerIds: ['chat-001', 'floorborn-001'],
  });

  assert.deepEqual(
    comparableObservation(a.observe('floorborn-001')),
    comparableObservation(b.observe('chat-001')),
  );
});

test('one player cannot consume the other player action budget', () => {
  const game = new SharedRtsSession({ sessionId: 'shared-budget-isolation' });
  const pair = actionById(game, 'floorborn-001', 'command:move:army-pair:center');
  const receipt = game.step('floorborn-001', pair);

  assert.equal(receipt.effectiveCost, 2);
  assert.equal(receipt.budgetBefore, 2);
  assert.equal(receipt.budgetAfter, 0);
  assert.equal(receipt.opponentBudgetBefore, 2);
  assert.equal(receipt.opponentBudgetAfter, 2);
  assert.equal(game.publicState().players['chat-001'].budgetRemaining, 2);
  assert.equal(game.activePlayerId(), 'chat-001');
});

test('fog hides opponent center movement until the observing player scouts center', () => {
  const game = new SharedRtsSession({ sessionId: 'shared-fog-interaction' });

  let observation = game.observe('floorborn-001');
  assert.equal(JSON.stringify(observation).includes('hidden-peer-doctrine'), false);
  assert.deepEqual(observation.rts.visibleEnemyContacts, []);

  const pair = actionById(game, 'floorborn-001', 'command:move:army-pair:center');
  game.step('floorborn-001', pair);

  observation = game.observe('chat-001');
  assert.deepEqual(observation.rts.visibleEnemyContacts, []);
  assert.equal(JSON.stringify(observation).includes('hidden-floorborn-doctrine'), false);
  assert.equal(JSON.stringify(observation).includes('floorborn-001'), true);

  const scout = actionById(game, 'chat-001', 'command:scout:center');
  game.step('chat-001', scout);

  observation = game.observe('chat-001');
  assert.deepEqual(
    observation.rts.visibleEnemyContacts.map((contact) => contact.contactId),
    ['enemy-contact:army-alpha', 'enemy-contact:army-beta'],
  );
});

test('stale over-budget command is rejected before either player world state mutates', () => {
  const game = new SharedRtsSession({ sessionId: 'shared-stale-budget' });
  const build = actionById(game, 'floorborn-001', 'command:build:power-node');
  const pair = actionById(game, 'floorborn-001', 'command:move:army-pair:center');

  game.step('floorborn-001', build);
  const chatYield = actionById(game, 'chat-001', 'wait:yield-window');
  game.step('chat-001', chatYield);

  assert.equal(game.activePlayerId(), 'floorborn-001');
  assert.equal(game.publicState().players['floorborn-001'].budgetRemaining, 1);
  const before = game.publicState();

  assert.throws(() => game.step('floorborn-001', pair), /action budget exceeded/);
  assert.deepEqual(game.publicState(), before);
});

test('both players can independently complete the same bounded objective in one shared action window', () => {
  const game = new SharedRtsSession({ sessionId: 'shared-objective' });

  game.step('floorborn-001', actionById(game, 'floorborn-001', 'command:build:power-node'));
  game.step('chat-001', actionById(game, 'chat-001', 'command:build:power-node'));
  game.step('floorborn-001', actionById(game, 'floorborn-001', 'command:scout:center'));
  game.step('chat-001', actionById(game, 'chat-001', 'command:scout:center'));

  const state = game.publicState();
  assert.equal(game.isComplete(), true);
  assert.equal(state.windowIndex, 0);
  assert.equal(state.players['floorborn-001'].powerNodes, 1);
  assert.equal(state.players['chat-001'].powerNodes, 1);
  assert.equal(state.players['floorborn-001'].scouted.center, true);
  assert.equal(state.players['chat-001'].scouted.center, true);
  assert.equal(state.players['floorborn-001'].budgetRemaining, 0);
  assert.equal(state.players['chat-001'].budgetRemaining, 0);

  const floorCost = game.receipts
    .filter((receipt) => receipt.playerId === 'floorborn-001')
    .reduce((sum, receipt) => sum + receipt.effectiveCost, 0);
  const chatCost = game.receipts
    .filter((receipt) => receipt.playerId === 'chat-001')
    .reduce((sum, receipt) => sum + receipt.effectiveCost, 0);
  assert.equal(floorCost, 2);
  assert.equal(chatCost, 2);
});

test('yield and exhaustion advance the window only after both independent budgets are done', () => {
  const game = new SharedRtsSession({ sessionId: 'shared-window-advance' });

  game.step('floorborn-001', actionById(game, 'floorborn-001', 'command:move:army-pair:center'));
  assert.equal(game.publicState().windowIndex, 0);
  assert.equal(game.publicState().players['chat-001'].budgetRemaining, 2);

  game.step('chat-001', actionById(game, 'chat-001', 'wait:yield-window'));
  const state = game.publicState();

  assert.equal(state.windowIndex, 1);
  assert.equal(state.players['floorborn-001'].budgetRemaining, 2);
  assert.equal(state.players['chat-001'].budgetRemaining, 2);
  assert.equal(state.players['floorborn-001'].resources, 55);
  assert.equal(state.players['chat-001'].resources, 55);
  assert.equal(game.activePlayerId(), 'chat-001');
});

test('shared RTS receipts replay the exact two-player world and per-player budgets', () => {
  const game = new SharedRtsSession({ sessionId: 'shared-replay' });

  game.step('floorborn-001', actionById(game, 'floorborn-001', 'command:move:army-pair:center'));
  game.step('chat-001', actionById(game, 'chat-001', 'command:scout:center'));
  game.step('chat-001', actionById(game, 'chat-001', 'command:build:power-node'));
  game.step('floorborn-001', actionById(game, 'floorborn-001', 'command:build:power-node'));
  game.step('chat-001', actionById(game, 'chat-001', 'wait:yield-window'));
  game.step('floorborn-001', actionById(game, 'floorborn-001', 'command:scout:center'));

  const replayed = replaySharedRts({
    sessionId: 'shared-replay',
    receipts: game.receipts,
  });
  assert.deepEqual(replayed, game.publicState());
});
