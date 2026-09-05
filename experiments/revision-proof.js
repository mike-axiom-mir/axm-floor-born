import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import { SignalTrialSession, replaySignalTrial } from '../src/signal-trial.js';

function train(player, { actualSafe, count, prefix, peerId = 'chat-001', peerSignal = 'route-safe' }) {
  let firstTrial = null;
  for (let index = 0; index < count; index += 1) {
    const game = new SignalTrialSession({
      sessionId: `${prefix}-${index}`,
      peerId,
      peerSignal,
      actualSafe,
      mode: 'training',
    });
    const action = player.decide(game.observe());
    assert.equal(action.id, 'inspect:verify-route');
    const receipt = game.step(action);
    player.learn(receipt);
    player.markSessionComplete(game.sessionId);
    firstTrial ??= game;
  }
  return firstTrial;
}

function evaluate(player, { sessionId, peerId = 'chat-001', peerSignal = 'route-safe' }) {
  const game = new SignalTrialSession({
    sessionId,
    peerId,
    peerSignal,
    actualSafe: true,
    mode: 'evaluation',
  });
  const action = player.decide(game.observe());
  const proposal = player.lastDecision.proposals.find((item) => item.actionId === 'signal:follow-peer');
  return { actionId: action.id, followEvidence: proposal.evidence };
}

const player = new FloorbornPlayer({ playerId: 'floorborn-001', lineageId: 'v05-revision' });

const fresh = evaluate(player, { sessionId: 'v05-fresh' });
assert.equal(fresh.actionId, 'inspect:verify-current');

const replayTrial = train(player, {
  actualSafe: true,
  count: 4,
  prefix: 'v05-support-a',
});
let evidence = player.memory.companions['chat-001'].signalEvidence['route-safe'];
assert.deepEqual(evidence, { supported: 4, contradicted: 0 });
const afterSupport = evaluate(player, { sessionId: 'v05-after-support' });
assert.equal(afterSupport.actionId, 'signal:follow-peer');

train(player, {
  actualSafe: false,
  count: 8,
  prefix: 'v05-contradict',
});
evidence = player.memory.companions['chat-001'].signalEvidence['route-safe'];
assert.deepEqual(evidence, { supported: 4, contradicted: 8 });
const afterContradiction = evaluate(player, { sessionId: 'v05-after-contradiction' });
assert.equal(afterContradiction.actionId, 'inspect:verify-current');

train(player, {
  actualSafe: true,
  count: 12,
  prefix: 'v05-support-b',
});
evidence = player.memory.companions['chat-001'].signalEvidence['route-safe'];
assert.deepEqual(evidence, { supported: 16, contradicted: 8 });
const afterRevision = evaluate(player, { sessionId: 'v05-after-revision' });
assert.equal(afterRevision.actionId, 'signal:follow-peer');

const stranger = evaluate(player, {
  sessionId: 'v05-stranger',
  peerId: 'chat-new',
  peerSignal: 'route-safe',
});
assert.equal(stranger.actionId, 'inspect:verify-current');

const otherSignal = evaluate(player, {
  sessionId: 'v05-other-signal',
  peerId: 'chat-001',
  peerSignal: 'route-danger',
});
assert.equal(otherSignal.actionId, 'inspect:verify-current');

const replayed = replaySignalTrial({
  sessionId: replayTrial.sessionId,
  peerId: 'chat-001',
  peerSignal: 'route-safe',
  actualSafe: true,
  mode: 'training',
  receipts: replayTrial.receipts,
});
assert.deepEqual(replayed, replayTrial.publicState());

const restored = FloorbornPlayer.restore(player.snapshot());
assert.deepEqual(restored.snapshot(), player.snapshot());

console.log(JSON.stringify({
  gate: 'AXM Floorborn v0.5 evidence revision',
  status: 'PASS',
  freshChoice: fresh.actionId,
  afterSupport: {
    evidence: { supported: 4, contradicted: 0 },
    choice: afterSupport.actionId,
    trace: afterSupport.followEvidence,
  },
  afterContradiction: {
    evidence: { supported: 4, contradicted: 8 },
    choice: afterContradiction.actionId,
    trace: afterContradiction.followEvidence,
  },
  afterLaterSupport: {
    evidence: { supported: 16, contradicted: 8 },
    choice: afterRevision.actionId,
    trace: afterRevision.followEvidence,
  },
  specificity: {
    strangerChoice: stranger.actionId,
    otherSignalChoice: otherSignal.actionId,
  },
  replay: 'PASS',
  snapshotRestore: 'PASS',
}, null, 2));
