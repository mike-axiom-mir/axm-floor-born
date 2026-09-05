import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import {
  ExpeditionSession,
  layoutForSeed,
  replayExpedition,
} from '../src/expedition-rpg.js';
import { InterludeSession, replayInterlude } from '../src/interlude.js';

function actionById(game, playerId, id) {
  const observation = game.observe(playerId);
  const action = observation.legalActions.find((candidate) => candidate.id === id);
  assert.ok(action, `${id} should be legal for ${playerId}`);
  return action;
}

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
    const action = playerId === floorborn.playerId
      ? floorborn.decide(observation)
      : choosePeerAction(observation, visited);
    const receipt = game.step(playerId, action);
    if (playerId === floorborn.playerId) floorborn.learn(receipt);
  }

  assert.equal(game.isComplete(), true, 'shared continuity session should complete');
  floorborn.markSessionComplete(sessionId);
  return game;
}

function teachRelicExperience(player) {
  let seed = null;
  let regionId = null;
  for (let candidate = 0; candidate < 32; candidate += 1) {
    const entry = Object.entries(layoutForSeed(candidate)).find(([, discovery]) => discovery.kind === 'relic');
    if (entry) {
      seed = candidate;
      [regionId] = entry;
      break;
    }
  }
  assert.notEqual(seed, null);

  const game = new ExpeditionSession({ sessionId: 'v04-relic-lesson', seed });
  for (const id of [`move:${regionId}`, `inspect:${regionId}`, 'gather:memory-relic']) {
    const receipt = game.step('floorborn-001', actionById(game, 'floorborn-001', id));
    player.learn(receipt);
  }
  return { seed, regionId };
}

function proveCompanionContinuity() {
  const veteran = new FloorbornPlayer({ playerId: 'floorborn-001', lineageId: 'v04-continuity' });
  const game = runSharedSession(veteran, 'chat-001', 'v04-shared-history', 0);
  const companion = veteran.memory.companions['chat-001'];

  assert.ok(companion.observedTurns > 0);
  assert.ok(companion.sharedSessions.includes('v04-shared-history'));
  assert.ok(companion.cooperationOutcomes.count > 0);
  assert.equal(veteran.memory.tagPatterns.cooperation, undefined);

  const reunionPlayer = FloorbornPlayer.restore(veteran.snapshot());
  const strangerPlayer = FloorbornPlayer.restore(veteran.snapshot());
  const reunion = new InterludeSession({
    sessionId: 'v04-reunion',
    playerId: 'floorborn-001',
    peerId: 'chat-001',
  });
  const stranger = new InterludeSession({
    sessionId: 'v04-stranger',
    playerId: 'floorborn-001',
    peerId: 'chat-new',
  });

  const reunionAction = reunionPlayer.decide(reunion.observe());
  const reunionDecision = structuredClone(reunionPlayer.lastDecision);
  const strangerAction = strangerPlayer.decide(stranger.observe());

  assert.equal(reunionAction.id, 'signal:continue-with-peer');
  assert.notEqual(strangerAction.id, 'signal:continue-with-peer');

  const reunionProposal = reunionDecision.proposals.find(
    (proposal) => proposal.actionId === 'signal:continue-with-peer',
  );
  assert.ok(reunionProposal.evidence.some((line) => line.startsWith('companion:chat-001=+')));
  assert.ok(reunionProposal.evidence.some((line) => line.startsWith('companion-outcome:chat-001=+')));

  return {
    trainingTurns: game.turn,
    observedTurns: companion.observedTurns,
    sharedSessions: companion.sharedSessions.length,
    cooperationOutcomeCount: companion.cooperationOutcomes.count,
    reunionChoice: reunionAction.id,
    strangerChoice: strangerAction.id,
    reunionEvidence: reunionProposal.evidence,
  };
}

function proveOptionalGoal() {
  const fresh = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const veteran = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const lesson = teachRelicExperience(veteran);

  const freshInterlude = new InterludeSession({ sessionId: 'v04-fresh-choice' });
  const veteranInterlude = new InterludeSession({ sessionId: 'v04-veteran-choice' });
  const freshAction = fresh.decide(freshInterlude.observe());
  const veteranAction = veteran.decide(veteranInterlude.observe());
  const decision = structuredClone(veteran.lastDecision);

  assert.equal(freshAction.id, 'signal:finish-journey');
  assert.equal(veteranAction.id, 'signal:seek-relic');
  const receipt = veteranInterlude.step(veteranAction);
  veteran.learn(receipt);
  const replayed = replayInterlude({
    sessionId: 'v04-veteran-choice',
    receipts: veteranInterlude.receipts,
  });
  assert.deepEqual(replayed, veteranInterlude.publicState());

  const proposal = decision.proposals.find((candidate) => candidate.actionId === 'signal:seek-relic');
  return {
    lessonSeed: lesson.seed,
    lessonRegion: lesson.regionId,
    freshChoice: freshAction.id,
    experiencedChoice: veteranAction.id,
    evidence: proposal.evidence,
    replay: 'PASS',
  };
}

function proveMistakeRecovery() {
  let trapSeed = null;
  for (let seed = 0; seed < 32; seed += 1) {
    if (layoutForSeed(seed).archive.kind === 'trap') {
      trapSeed = seed;
      break;
    }
  }
  assert.notEqual(trapSeed, null);

  const floorborn = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const game = new ExpeditionSession({ sessionId: 'v04-mistake-recovery', seed: trapSeed });

  const firstObservation = game.observe('floorborn-001');
  const firstAction = floorborn.decide(firstObservation);
  let receipt = game.step('floorborn-001', firstAction);
  floorborn.learn(receipt);
  assert.equal(firstAction.id, 'move:archive');

  const secondAction = floorborn.decide(game.observe('floorborn-001'));
  receipt = game.step('floorborn-001', secondAction);
  floorborn.learn(receipt);
  assert.match(receipt.outcome.eventId, /^trap:/);

  const thirdAction = floorborn.decide(game.observe('floorborn-001'));
  receipt = game.step('floorborn-001', thirdAction);
  floorborn.learn(receipt);
  assert.equal(thirdAction.id, 'move:camp');

  const recoveryAction = floorborn.decide(game.observe('floorborn-001'));
  const recoveryDecision = structuredClone(floorborn.lastDecision);
  assert.notEqual(recoveryAction.id, 'move:archive');
  receipt = game.step('floorborn-001', recoveryAction);
  floorborn.learn(receipt);

  while (!game.isComplete() && game.turn < 40) {
    const action = floorborn.decide(game.observe('floorborn-001'));
    receipt = game.step('floorborn-001', action);
    floorborn.learn(receipt);
  }
  assert.equal(game.isComplete(), true);

  const replayed = replayExpedition({
    sessionId: 'v04-mistake-recovery',
    seed: trapSeed,
    receipts: game.receipts,
  });
  assert.deepEqual(replayed, game.publicState());

  const archiveProposal = recoveryDecision.proposals.find((proposal) => proposal.actionId === 'move:archive');
  return {
    trapSeed,
    firstChoice: firstAction.id,
    trapEvent: game.receipts.find((entry) => entry.outcome.eventId.startsWith('trap:')).outcome.eventId,
    recoveryChoice: recoveryAction.id,
    recoveryEvidence: archiveProposal.evidence,
    completed: game.isComplete(),
    turns: game.turn,
    replay: 'PASS',
  };
}

const report = {
  gate: 'AXM Floorborn v0.4 continuity',
  status: 'PASS',
  companionContinuity: proveCompanionContinuity(),
  optionalGoal: proveOptionalGoal(),
  mistakeRecovery: proveMistakeRecovery(),
};

console.log(JSON.stringify(report, null, 2));
