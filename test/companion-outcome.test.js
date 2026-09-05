import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import { ExpeditionSession } from '../src/expedition-rpg.js';

function choosePeerAction(observation, visited) {
  const legal = observation.legalActions;
  const gather = legal.find((action) => action.kind === 'gather');
  if (gather) return gather;

  const inspect = legal.find((action) => action.kind === 'inspect');
  if (inspect) return inspect;

  if (observation.place.id === 'gate') {
    return legal.find((action) => action.id === 'wait:gate')
      ?? legal.find((action) => action.id === 'move:camp')
      ?? legal[0];
  }

  if (observation.place.id !== 'camp') {
    return legal.find((action) => action.id === 'move:camp') ?? legal[0];
  }

  if (observation.party.sealsCollected >= 2) {
    return legal.find((action) => action.id === 'move:gate') ?? legal[0];
  }

  const regionMove = legal.find((action) => (
    action.kind === 'move'
    && ['archive', 'grove', 'quarry', 'marsh'].includes(action.target)
    && !visited.has(action.target)
  ));
  if (regionMove) {
    visited.add(regionMove.target);
    return regionMove;
  }

  return legal.find((action) => action.kind === 'move') ?? legal[0];
}

function runSharedSession(floorborn, peerId, sessionId, seed) {
  const game = new ExpeditionSession({
    sessionId,
    seed,
    playerIds: [floorborn.playerId, peerId],
  });
  const visited = new Set();
  let safety = 0;

  while (!game.isComplete() && safety < 70) {
    safety += 1;
    const playerId = game.activePlayerId();
    const observation = game.observe(playerId);
    let action;

    if (playerId === floorborn.playerId) {
      action = floorborn.decide(observation);
    } else {
      action = choosePeerAction(observation, visited);
    }

    const receipt = game.step(playerId, action);
    if (playerId === floorborn.playerId) floorborn.learn(receipt);
  }

  assert.equal(game.isComplete(), true, 'shared training session should complete');
  floorborn.markSessionComplete(sessionId);
  return game;
}

test('successful cooperation is retained on the observed companion rather than generalized to every stranger', () => {
  const veteran = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const training = runSharedSession(veteran, 'chat-001', 'actual-shared-history', 0);

  assert.ok(training.receipts.some((receipt) => receipt.playerId === 'chat-001'));
  const companion = veteran.memory.companions['chat-001'];
  assert.ok(companion.observedTurns > 0);
  assert.ok(companion.sharedSessions.includes('actual-shared-history'));
  assert.ok(companion.cooperationOutcomes.count > 0);
  assert.equal(veteran.memory.tagPatterns.cooperation, undefined);

  const samePeer = FloorbornPlayer.restore(veteran.snapshot());
  const stranger = FloorbornPlayer.restore(veteran.snapshot());

  const sameGame = new ExpeditionSession({
    sessionId: 'reunion',
    seed: 13,
    playerIds: ['floorborn-001', 'chat-001'],
  });
  const strangerGame = new ExpeditionSession({
    sessionId: 'new-person',
    seed: 13,
    playerIds: ['floorborn-001', 'chat-new'],
  });

  const sameAction = samePeer.decide(sameGame.observe('floorborn-001'));
  const strangerAction = stranger.decide(strangerGame.observe('floorborn-001'));

  assert.equal(sameAction.id, 'signal:explore');
  assert.notEqual(strangerAction.id, 'signal:explore');

  const familiarProposal = samePeer.lastDecision.proposals.find((proposal) => proposal.actionId === 'signal:explore');
  assert.ok(familiarProposal.evidence.some((line) => line.startsWith('companion:chat-001=+')));
  assert.ok(familiarProposal.evidence.some((line) => line.startsWith('companion-outcome:chat-001=+')));

  const strangerProposal = stranger.lastDecision.proposals.find((proposal) => proposal.actionId === 'signal:explore');
  assert.equal(strangerProposal.evidence.some((line) => line.startsWith('companion-outcome:chat-001=')), false);
});
