import test from 'node:test';
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

  const game = new ExpeditionSession({ sessionId: 'intent-relic-history', seed });
  for (const id of [`move:${regionId}`, `inspect:${regionId}`, 'gather:memory-relic']) {
    const receipt = game.step('floorborn-001', legalById(game, 'floorborn-001', id));
    player.learn(receipt);
  }
}

function adoptSeekRelicIntention(player, sessionId) {
  const interlude = new InterludeSession({ sessionId });
  const action = player.decide(interlude.observe());
  assert.equal(action.id, 'signal:seek-relic');
  const receipt = interlude.step(action);
  player.learn(receipt);
  player.markSessionComplete(sessionId);
  return interlude;
}

test('a self-selected optional intent becomes explicit pending lineage state', () => {
  const player = new FloorbornPlayer({ playerId: 'floorborn-001' });
  teachRelicHistory(player);
  adoptSeekRelicIntention(player, 'intent-created');

  const active = player.activeIntentions();
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'seek-relic');
  assert.equal(active[0].status, 'pending');
  assert.equal(active[0].createdSessionId, 'intent-created');
});

test('pending intention survives an unrelated later session and snapshot restore', () => {
  const player = new FloorbornPlayer({ playerId: 'floorborn-001' });
  teachRelicHistory(player);
  adoptSeekRelicIntention(player, 'intent-before-unrelated');

  const unrelated = new SignalTrialSession({
    sessionId: 'unrelated-signal-session',
    peerId: 'chat-001',
    peerSignal: 'route-safe',
    actualSafe: true,
    mode: 'training',
  });
  const unrelatedAction = player.decide(unrelated.observe());
  const unrelatedReceipt = unrelated.step(unrelatedAction);
  player.learn(unrelatedReceipt);
  player.markSessionComplete(unrelated.sessionId);

  assert.equal(player.activeIntentions()[0].id, 'seek-relic');
  const restored = FloorbornPlayer.restore(player.snapshot());
  assert.deepEqual(restored.activeIntentions(), player.activeIntentions());
  assert.deepEqual(restored.snapshot(), player.snapshot());
});

test('pending intention influences a later matching legal opportunity and fulfillment retires it', () => {
  const fresh = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const freshOpportunity = new IntentionOpportunitySession({ sessionId: 'fresh-opportunity' });
  assert.equal(fresh.decide(freshOpportunity.observe()).id, 'signal:stay-course');

  const player = new FloorbornPlayer({ playerId: 'floorborn-001' });
  teachRelicHistory(player);
  adoptSeekRelicIntention(player, 'intent-for-opportunity');

  const opportunity = new IntentionOpportunitySession({ sessionId: 'matching-opportunity' });
  const pursue = player.decide(opportunity.observe());
  assert.equal(pursue.id, 'signal:pursue-relic-route');
  const pursueProposal = player.lastDecision.proposals.find(
    (proposal) => proposal.actionId === 'signal:pursue-relic-route',
  );
  assert.ok(pursueProposal.evidence.includes('intention:seek-relic=+1.8'));

  let receipt = opportunity.step(pursue);
  player.learn(receipt);
  assert.equal(player.activeIntentions().length, 1);

  const gather = player.decide(opportunity.observe());
  assert.equal(gather.id, 'gather:memory-relic');
  receipt = opportunity.step(gather);
  player.learn(receipt);

  assert.equal(player.activeIntentions().length, 0);
  const fulfilled = player.memory.intentions.find((intention) => intention.id === 'seek-relic');
  assert.equal(fulfilled.status, 'fulfilled');
  assert.equal(fulfilled.retiredEventId, 'gathered:memory-relic');

  const replayed = replayIntentionOpportunity({
    sessionId: 'matching-opportunity',
    receipts: opportunity.receipts,
  });
  assert.deepEqual(replayed, opportunity.publicState());

  const later = new IntentionOpportunitySession({ sessionId: 'after-fulfillment' });
  player.decide(later.observe());
  const laterPursue = player.lastDecision.proposals.find(
    (proposal) => proposal.actionId === 'signal:pursue-relic-route',
  );
  assert.equal(laterPursue.evidence.includes('intention:seek-relic=+1.8'), false);
});

test('changed world state can invalidate a pending intention without deleting its history', () => {
  const player = new FloorbornPlayer({ playerId: 'floorborn-001' });
  teachRelicHistory(player);
  adoptSeekRelicIntention(player, 'intent-to-invalidate');

  const blocked = new IntentionOpportunitySession({
    sessionId: 'blocked-opportunity',
    availability: 'blocked',
  });
  const action = player.decide(blocked.observe());
  assert.equal(action.id, 'signal:acknowledge-no-relic');
  const receipt = blocked.step(action);
  player.learn(receipt);

  assert.equal(player.activeIntentions().length, 0);
  const invalidated = player.memory.intentions.find((intention) => intention.createdSessionId === 'intent-to-invalidate');
  assert.equal(invalidated.status, 'invalidated');
  assert.equal(invalidated.retiredEventId, 'intent-invalidated:seek-relic');
});

test('a fulfilled intention can be chosen again later as a new lifecycle rather than resurrecting the retired record', () => {
  const player = new FloorbornPlayer({ playerId: 'floorborn-001' });
  teachRelicHistory(player);
  adoptSeekRelicIntention(player, 'first-intent');

  const opportunity = new IntentionOpportunitySession({ sessionId: 'first-fulfillment' });
  let action = player.decide(opportunity.observe());
  let receipt = opportunity.step(action);
  player.learn(receipt);
  action = player.decide(opportunity.observe());
  receipt = opportunity.step(action);
  player.learn(receipt);
  assert.equal(player.memory.intentions[0].status, 'fulfilled');

  adoptSeekRelicIntention(player, 'second-intent');
  assert.equal(player.memory.intentions.length, 2);
  assert.equal(player.memory.intentions[0].status, 'fulfilled');
  assert.equal(player.memory.intentions[1].status, 'pending');
  assert.ok(player.memory.intentions[1].sequence > player.memory.intentions[0].sequence);
});
