import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import { ExpeditionSession, layoutForSeed } from '../src/expedition-rpg.js';
import { InterludeSession } from '../src/interlude.js';
import { SignalTrialSession } from '../src/signal-trial.js';

const REGIONS = ['archive', 'grove', 'quarry', 'marsh'];

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
  const move = legal.find((action) => (
    action.kind === 'move'
    && REGIONS.includes(action.target)
    && !visited.has(action.target)
  ));
  if (move) {
    visited.add(move.target);
    return move;
  }
  return legal.find((action) => action.kind === 'move') ?? legal[0];
}

function runShared(player) {
  const game = new ExpeditionSession({
    sessionId: 'signal-probe-shared',
    seed: 0,
    playerIds: ['floorborn-001', 'chat-001'],
  });
  const visited = new Set();
  while (!game.isComplete() && game.turn < 80) {
    const active = game.activePlayerId();
    const observation = game.observe(active);
    const action = active === player.playerId
      ? player.decide(observation)
      : choosePeerAction(observation, visited);
    const receipt = game.step(active, action);
    if (active === player.playerId) player.learn(receipt);
  }
  assert.equal(game.isComplete(), true);
  player.markSessionComplete(game.sessionId);
}

function findTrapSeed(player) {
  for (let seed = 0; seed < 64; seed += 1) {
    const clone = FloorbornPlayer.restore(player.snapshot());
    const game = new ExpeditionSession({ sessionId: `signal-probe-trap-candidate-${seed}`, seed });
    while (!game.isComplete() && game.turn < 70) {
      const action = clone.decide(game.observe(clone.playerId));
      const receipt = game.step(clone.playerId, action);
      clone.learn(receipt);
      if (receipt.outcome.eventId.startsWith('trap:')) return seed;
    }
  }
  return null;
}

function runSolo(player, seed) {
  const game = new ExpeditionSession({ sessionId: 'signal-probe-trap', seed });
  while (!game.isComplete() && game.turn < 70) {
    const action = player.decide(game.observe(player.playerId));
    const receipt = game.step(player.playerId, action);
    player.learn(receipt);
  }
  assert.equal(game.isComplete(), true);
  assert.ok(game.receipts.some((receipt) => receipt.outcome.eventId.startsWith('trap:')));
  player.markSessionComplete(game.sessionId);
}

function train(player, actualSafe, count, prefix) {
  for (let index = 0; index < count; index += 1) {
    const game = new SignalTrialSession({
      sessionId: `${prefix}-${index}`,
      peerId: 'chat-001',
      peerSignal: 'route-safe',
      actualSafe,
      mode: 'training',
    });
    const action = player.decide(game.observe());
    assert.equal(action.id, 'inspect:verify-route');
    const receipt = game.step(action);
    player.learn(receipt);
    player.markSessionComplete(game.sessionId);
  }
}

function evaluate(player, sessionId) {
  const game = new SignalTrialSession({
    sessionId,
    peerId: 'chat-001',
    peerSignal: 'route-safe',
    actualSafe: true,
    mode: 'evaluation',
  });
  const action = player.decide(game.observe());
  return { game, action, decision: structuredClone(player.lastDecision) };
}

test('campaign-scale companion history still yields to four latest contradicted receipts for the exact signal', () => {
  const player = new FloorbornPlayer({ playerId: 'floorborn-001' });

  runShared(player);

  const reunion = new InterludeSession({
    sessionId: 'signal-probe-reunion',
    playerId: 'floorborn-001',
    peerId: 'chat-001',
  });
  assert.equal(player.decide(reunion.observe()).id, 'signal:continue-with-peer');

  const stranger = new InterludeSession({
    sessionId: 'signal-probe-stranger',
    playerId: 'floorborn-001',
    peerId: 'chat-new',
  });
  const strangerAction = player.decide(stranger.observe());
  const strangerReceipt = stranger.step(strangerAction);
  player.learn(strangerReceipt);
  player.markSessionComplete(stranger.sessionId);

  const trapSeed = findTrapSeed(player);
  assert.notEqual(trapSeed, null);
  assert.equal(Object.values(layoutForSeed(trapSeed)).some((item) => item.kind === 'trap'), true);
  runSolo(player, trapSeed);

  train(player, true, 4, 'signal-probe-support');
  const followed = evaluate(player, 'signal-probe-follow');
  assert.equal(followed.action.id, 'signal:follow-peer');
  const followReceipt = followed.game.step(followed.action);
  player.learn(followReceipt);
  player.markSessionComplete(followed.game.sessionId);

  train(player, false, 10, 'signal-probe-contradict');

  const companion = player.memory.companions['chat-001'];
  const result = evaluate(player, 'signal-probe-verify');
  const followProposal = result.decision.proposals.find((proposal) => proposal.actionId === 'signal:follow-peer');
  const verifyProposal = result.decision.proposals.find((proposal) => proposal.actionId === 'inspect:verify-current');
  const diagnostic = {
    trapSeed,
    signalEvidence: companion.signalEvidence['route-safe'],
    recentSignalVerdicts: companion.recentSignalVerdicts['route-safe'],
    observedTurns: companion.observedTurns,
    sharedSessions: companion.sharedSessions.length,
    cooperationOutcomes: companion.cooperationOutcomes,
    globalTagPatterns: {
      cooperation: player.memory.tagPatterns.cooperation ?? null,
      communication: player.memory.tagPatterns.communication ?? null,
      route: player.memory.tagPatterns.route ?? null,
      verification: player.memory.tagPatterns.verification ?? null,
    },
    selected: result.action.id,
    followProposal,
    verifyProposal,
  };

  assert.equal(
    result.action.id,
    'inspect:verify-current',
    `campaign signal diagnostic:\n${JSON.stringify(diagnostic, null, 2)}`,
  );
  assert.ok(followProposal.evidence.includes('signal-evidence-basis:chat-001:route-safe=recent-contradiction-streak'));
  assert.ok(followProposal.evidence.includes('specific-signal-contradiction=blocks-general-companion-bonus'));
});
