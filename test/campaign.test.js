import test from 'node:test';
import assert from 'node:assert/strict';

import { CampaignLedger } from '../src/campaign-ledger.js';
import { runCampaignProof } from '../src/campaign.js';
import { FloorbornPlayer } from '../src/floorborn.js';

test('multi-session campaign combines player continuity without hidden-state shortcuts', () => {
  const report = runCampaignProof({ campaignId: 'campaign-test-main' });

  assert.equal(report.status, 'PASS');
  assert.ok(report.metrics.completedSessions >= 20);
  assert.ok(report.metrics.campaignCheckpoints >= 12);
  assert.ok(report.metrics.causalLinks >= 7);
  assert.deepEqual(report.metrics.companionIds, ['chat-001', 'chat-new']);
  assert.equal(report.metrics.activeIntentions, 0);
  assert.equal(report.metrics.finalChoice, 'signal:finish-journey');
  assert.ok(Number.isInteger(report.metrics.trapSeed));
  assert.ok(Number.isInteger(report.metrics.relicSeed));
});

test('campaign ledger explicitly links earlier evidence to later behavioral effects', () => {
  const report = runCampaignProof({ campaignId: 'campaign-test-links' });
  const relations = new Set(report.causalLinks.map((link) => link.relation));

  assert.ok(relations.has('shared-companion-history-influenced-reunion-choice'));
  assert.ok(relations.has('negative-hidden-outcome-influenced-recovery-route'));
  assert.ok(relations.has('supported-peer-signal-influenced-follow-choice'));
  assert.ok(relations.has('contradictory-peer-evidence-revised-later-choice'));
  assert.ok(relations.has('optional-relic-experience-influenced-future-intent'));
  assert.ok(relations.has('snapshot-preserved-pending-intention-and-lineage-history'));
  assert.ok(relations.has('pending-intention-influenced-later-matching-opportunity'));
  assert.ok(relations.has('fulfillment-retired-intention-before-later-closure-choice'));

  for (const link of report.causalLinks) {
    assert.ok(link.fromSequence < link.toSequence);
    assert.ok(link.evidence.length > 0);
  }
});

test('campaign final player and ledger snapshots restore exactly', () => {
  const report = runCampaignProof({ campaignId: 'campaign-test-restore' });

  const player = FloorbornPlayer.restore(report.finalPlayer);
  assert.deepEqual(player.snapshot(), report.finalPlayer);

  const ledger = CampaignLedger.restore(report.ledger);
  assert.deepEqual(ledger.snapshot(), report.ledger);
});

test('campaign history retains retired intention rather than silently deleting it', () => {
  const report = runCampaignProof({ campaignId: 'campaign-test-intention-history' });
  const intentions = report.finalPlayer.memory.intentions;

  assert.ok(intentions.length >= 1);
  assert.equal(intentions.at(-1).status, 'fulfilled');
  assert.equal(intentions.at(-1).retiredEventId, 'gathered:memory-relic');
  assert.equal(report.metrics.activeIntentions, 0);
});
