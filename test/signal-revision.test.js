import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import { SignalTrialSession, replaySignalTrial } from '../src/signal-trial.js';

function train(player, {
  peerId = 'chat-001',
  peerSignal = 'route-safe',
  actualSafe,
  count,
  prefix,
}) {
  const receipts = [];
  for (let index = 0; index < count; index += 1) {
    const game = new SignalTrialSession({
      sessionId: `${prefix}-${index}`,
      peerId,
      peerSignal,
      actualSafe,
      mode: 'training',
    });
    const observation = game.observe();
    const action = player.decide(observation);
    assert.equal(action.id, 'inspect:verify-route');
    const receipt = game.step(action);
    player.learn(receipt);
    player.markSessionComplete(game.sessionId);
    receipts.push({ game, receipt });
  }
  return receipts;
}

function evaluate(player, {
  peerId = 'chat-001',
  peerSignal = 'route-safe',
  sessionId,
}) {
  const game = new SignalTrialSession({
    sessionId,
    peerId,
    peerSignal,
    actualSafe: true,
    mode: 'evaluation',
  });
  const action = player.decide(game.observe());
  return { game, action, decision: structuredClone(player.lastDecision) };
}

test('supported companion signal evidence can change a later legal choice', () => {
  const player = new FloorbornPlayer({ playerId: 'floorborn-001' });
  train(player, { actualSafe: true, count: 4, prefix: 'supported' });

  const evidence = player.memory.companions['chat-001'].signalEvidence['route-safe'];
  assert.deepEqual(evidence, { supported: 4, contradicted: 0 });

  const result = evaluate(player, { sessionId: 'supported-eval' });
  assert.equal(result.action.id, 'signal:follow-peer');
  const proposal = result.decision.proposals.find((item) => item.actionId === 'signal:follow-peer');
  assert.ok(proposal.evidence.includes('signal-evidence:chat-001:route-safe=+2.4'));
});

test('contradicted companion signal evidence can make Floorborn verify instead', () => {
  const player = new FloorbornPlayer({ playerId: 'floorborn-001' });
  train(player, { actualSafe: false, count: 4, prefix: 'contradicted' });

  const evidence = player.memory.companions['chat-001'].signalEvidence['route-safe'];
  assert.deepEqual(evidence, { supported: 0, contradicted: 4 });

  const result = evaluate(player, { sessionId: 'contradicted-eval' });
  assert.equal(result.action.id, 'inspect:verify-current');
  const proposal = result.decision.proposals.find((item) => item.actionId === 'signal:follow-peer');
  assert.ok(proposal.evidence.includes('signal-evidence:chat-001:route-safe=-2.4'));
  assert.ok(proposal.evidence.includes('specific-signal-contradiction=blocks-general-companion-bonus'));
});

test('specific contradicted signal evidence outranks large broad familiarity with the same companion', () => {
  const player = new FloorbornPlayer({ playerId: 'floorborn-001' });
  train(player, { actualSafe: true, count: 4, prefix: 'broad-support' });

  for (let index = 0; index < 10; index += 1) {
    const result = evaluate(player, { sessionId: `broad-positive-follow-${index}` });
    assert.equal(result.action.id, 'signal:follow-peer');
    const receipt = result.game.step(result.action);
    player.learn(receipt);
    player.markSessionComplete(result.game.sessionId);
  }

  const companionBeforeContradiction = player.memory.companions['chat-001'];
  assert.ok(companionBeforeContradiction.observedTurns >= 14);
  assert.ok(companionBeforeContradiction.cooperationOutcomes.count >= 10);

  train(player, { actualSafe: false, count: 30, prefix: 'specific-contradiction' });
  const signalEvidence = player.memory.companions['chat-001'].signalEvidence['route-safe'];
  assert.ok(signalEvidence.contradicted > signalEvidence.supported);

  const result = evaluate(player, { sessionId: 'specific-over-broad-eval' });
  assert.equal(result.action.id, 'inspect:verify-current');

  const follow = result.decision.proposals.find((item) => item.actionId === 'signal:follow-peer');
  assert.ok(follow.evidence.some((line) => line.startsWith('signal-evidence:chat-001:route-safe=-')));
  assert.ok(follow.evidence.includes('specific-signal-contradiction=blocks-general-companion-bonus'));
  assert.equal(follow.evidence.some((line) => line === 'peer-signal=+0.9'), false);
  assert.equal(follow.evidence.some((line) => line.startsWith('companion:chat-001=+')), false);
  assert.equal(follow.evidence.some((line) => line.startsWith('companion-outcome:chat-001=+')), false);
});

test('later contradictory and supporting evidence can revise the same signal memory in both directions', () => {
  const player = new FloorbornPlayer({ playerId: 'floorborn-001' });

  train(player, { actualSafe: true, count: 4, prefix: 'revision-support-a' });
  assert.equal(evaluate(player, { sessionId: 'revision-eval-a' }).action.id, 'signal:follow-peer');

  train(player, { actualSafe: false, count: 8, prefix: 'revision-contradict' });
  let evidence = player.memory.companions['chat-001'].signalEvidence['route-safe'];
  assert.deepEqual(evidence, { supported: 4, contradicted: 8 });
  assert.equal(evaluate(player, { sessionId: 'revision-eval-b' }).action.id, 'inspect:verify-current');

  train(player, { actualSafe: true, count: 12, prefix: 'revision-support-b' });
  evidence = player.memory.companions['chat-001'].signalEvidence['route-safe'];
  assert.deepEqual(evidence, { supported: 16, contradicted: 8 });
  assert.equal(evaluate(player, { sessionId: 'revision-eval-c' }).action.id, 'signal:follow-peer');
});

test('signal evidence stays specific to both companion and signal', () => {
  const player = new FloorbornPlayer({ playerId: 'floorborn-001' });
  train(player, { actualSafe: true, count: 4, prefix: 'specificity' });

  assert.equal(evaluate(player, {
    peerId: 'chat-new',
    peerSignal: 'route-safe',
    sessionId: 'stranger-signal-eval',
  }).action.id, 'inspect:verify-current');

  assert.equal(evaluate(player, {
    peerId: 'chat-001',
    peerSignal: 'route-danger',
    sessionId: 'other-signal-eval',
  }).action.id, 'inspect:verify-current');
});

test('verified signal trials remain exactly replayable and memory survives restore', () => {
  const player = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const [trial] = train(player, {
    actualSafe: false,
    count: 1,
    prefix: 'replay-signal',
  });

  const replayed = replaySignalTrial({
    sessionId: trial.game.sessionId,
    peerId: 'chat-001',
    peerSignal: 'route-safe',
    actualSafe: false,
    mode: 'training',
    receipts: trial.game.receipts,
  });
  assert.deepEqual(replayed, trial.game.publicState());

  const restored = FloorbornPlayer.restore(player.snapshot());
  assert.deepEqual(restored.snapshot(), player.snapshot());
});
