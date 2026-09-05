import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import { ExpeditionSession, layoutForSeed } from '../src/expedition-rpg.js';
import { InterludeSession } from '../src/interlude.js';
import { SignalTrialSession } from '../src/signal-trial.js';
import {
  IntentionOpportunitySession,
  replayIntentionOpportunity,
} from '../src/intention-opportunity.js';

function legalById(game, playerId, id) {
  const observation = playerId ? game.observe(playerId) : game.observe();
  const action = observation.legalActions.find((candidate) => candidate.id === id);
  assert.ok(action, `${id} should be legal`);
  return action;
}

function teachRelicHistory(player) {
  let lesson = null;
  for (let seed = 0; seed < 32; seed += 1) {
    const entry = Object.entries(layoutForSeed(seed)).find(([, discovery]) => discovery.kind === 'relic');
    if (entry) {
      lesson = { seed, regionId: entry[0] };
      break;
    }
  }
  assert.ok(lesson);

  const game = new ExpeditionSession({ sessionId: 'v06-relic-history', seed: lesson.seed });
  for (const id of [`move:${lesson.regionId}`, `inspect:${lesson.regionId}`, 'gather:memory-relic']) {
    const receipt = game.step('floorborn-001', legalById(game, 'floorborn-001', id));
    player.learn(receipt);
  }
  return lesson;
}

function adoptIntent(player, sessionId) {
  const interlude = new InterludeSession({ sessionId });
  const action = player.decide(interlude.observe());
  assert.equal(action.id, 'signal:seek-relic');
  const receipt = interlude.step(action);
  player.learn(receipt);
  player.markSessionComplete(sessionId);
  assert.equal(player.activeIntentions().length, 1);
  return { interlude, action, receipt };
}

function unrelatedSession(player) {
  const game = new SignalTrialSession({
    sessionId: 'v06-unrelated',
    peerId: 'chat-001',
    peerSignal: 'route-safe',
    actualSafe: true,
    mode: 'training',
  });
  const action = player.decide(game.observe());
  const receipt = game.step(action);
  player.learn(receipt);
  player.markSessionComplete(game.sessionId);
  return { actionId: action.id, eventId: receipt.outcome.eventId };
}

const player = new FloorbornPlayer({ playerId: 'floorborn-001', lineageId: 'v06-intention' });
const lesson = teachRelicHistory(player);
const adopted = adoptIntent(player, 'v06-intent-created');
const created = structuredClone(player.activeIntentions()[0]);

const unrelated = unrelatedSession(player);
assert.equal(player.activeIntentions()[0].sequence, created.sequence);

const restored = FloorbornPlayer.restore(player.snapshot());
assert.deepEqual(restored.activeIntentions(), player.activeIntentions());

const opportunity = new IntentionOpportunitySession({ sessionId: 'v06-opportunity' });
const pursue = restored.decide(opportunity.observe());
assert.equal(pursue.id, 'signal:pursue-relic-route');
const pursueTrace = structuredClone(restored.lastDecision);
let receipt = opportunity.step(pursue);
restored.learn(receipt);
assert.equal(restored.activeIntentions().length, 1);

const gather = restored.decide(opportunity.observe());
assert.equal(gather.id, 'gather:memory-relic');
receipt = opportunity.step(gather);
restored.learn(receipt);
assert.equal(restored.activeIntentions().length, 0);

const replayed = replayIntentionOpportunity({
  sessionId: 'v06-opportunity',
  receipts: opportunity.receipts,
});
assert.deepEqual(replayed, opportunity.publicState());

const firstLifecycle = restored.memory.intentions[0];
assert.equal(firstLifecycle.status, 'fulfilled');
assert.equal(firstLifecycle.retiredEventId, 'gathered:memory-relic');

const afterFulfillment = new InterludeSession({ sessionId: 'v06-after-fulfillment' });
const postAction = restored.decide(afterFulfillment.observe());
assert.equal(postAction.id, 'signal:finish-journey');
const postTrace = structuredClone(restored.lastDecision);
const postSeek = postTrace.proposals.find((proposal) => proposal.actionId === 'signal:seek-relic');
assert.equal(postSeek.evidence.includes('intention:seek-relic=+1.8'), false);

const readopt = new InterludeSession({ sessionId: 'v06-readopt' });
const legalSeek = legalById(readopt, null, 'signal:seek-relic');
const readoptReceipt = readopt.step(legalSeek);
restored.learn(readoptReceipt);
restored.markSessionComplete(readopt.sessionId);
assert.equal(restored.memory.intentions.length, 2);
assert.equal(restored.memory.intentions[0].status, 'fulfilled');
assert.equal(restored.memory.intentions[1].status, 'pending');
assert.ok(restored.memory.intentions[1].sequence > restored.memory.intentions[0].sequence);

const invalidationPlayer = new FloorbornPlayer({ playerId: 'floorborn-001', lineageId: 'v06-invalidation' });
teachRelicHistory(invalidationPlayer);
adoptIntent(invalidationPlayer, 'v06-invalidated-intent');
const blocked = new IntentionOpportunitySession({
  sessionId: 'v06-blocked',
  availability: 'blocked',
});
const acknowledge = invalidationPlayer.decide(blocked.observe());
const invalidationReceipt = blocked.step(acknowledge);
invalidationPlayer.learn(invalidationReceipt);
assert.equal(invalidationPlayer.activeIntentions().length, 0);
assert.equal(invalidationPlayer.memory.intentions[0].status, 'invalidated');

console.log(JSON.stringify({
  gate: 'AXM Floorborn v0.6 intention lifecycle',
  status: 'PASS',
  lesson,
  creation: {
    selectedAction: adopted.action.id,
    intention: created,
  },
  unrelatedSession: unrelated,
  survivedUnrelatedSession: player.activeIntentions()[0].sequence === created.sequence,
  snapshotRestore: 'PASS',
  laterOpportunity: {
    selectedAction: pursue.id,
    trace: pursueTrace.proposals.find((proposal) => proposal.actionId === 'signal:pursue-relic-route').evidence,
    fulfillmentAction: gather.id,
  },
  fulfilledLifecycle: firstLifecycle,
  replay: 'PASS',
  afterFulfillment: {
    autonomousChoice: postAction.id,
    oldIntentionStillInfluences: postSeek.evidence.includes('intention:seek-relic=+1.8'),
  },
  readoption: {
    oldStatus: restored.memory.intentions[0].status,
    newStatus: restored.memory.intentions[1].status,
    oldSequence: restored.memory.intentions[0].sequence,
    newSequence: restored.memory.intentions[1].sequence,
  },
  invalidation: {
    action: acknowledge.id,
    status: invalidationPlayer.memory.intentions[0].status,
    retiredEventId: invalidationPlayer.memory.intentions[0].retiredEventId,
  },
}, null, 2));
