import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyLiveContestedChatAction,
  createLiveContestedRts,
  inspectLiveContestedSnapshot,
  LIVE_CONTESTED_SNAPSHOT_SCHEMA,
  migrateLiveContestedSnapshot,
} from '../src/live-contested-rts.js';
import { digest } from '../src/stable.js';

test('live contested snapshots separate sealed state, retained history, and replay origin', () => {
  const first = createLiveContestedRts({ sessionId: 'v17-snapshot-contract' });
  const repeated = createLiveContestedRts({ sessionId: 'v17-snapshot-contract' });
  const receipt = inspectLiveContestedSnapshot(first);

  assert.deepEqual(first, repeated);
  assert.equal(first.schema, LIVE_CONTESTED_SNAPSHOT_SCHEMA);
  assert.equal(first.replayAnchor.kind, 'session-origin');
  assert.equal(first.replayAnchor.receiptIndex, 0);
  assert.equal(receipt.schema, 'axm.floorborn.live-contested-rts.validation.v0.1');
  assert.equal(receipt.valid, true);
  assert.equal(receipt.verifiedFromReceiptIndex, 0);
  assert.equal(receipt.receiptCount, 1);
  assert.match(receipt.canonicalStateDigest, /^[0-9a-f]{64}$/);
  assert.match(receipt.retainedHistoryDigest, /^[0-9a-f]{64}$/);
  assert.match(receipt.replayAnchorDigest, /^[0-9a-f]{64}$/);
  assert.match(receipt.snapshotDigest, /^[0-9a-f]{64}$/);
});

test('snapshot integrity rejects changed bytes before resume', () => {
  const snapshot = createLiveContestedRts({ sessionId: 'v17-byte-tamper' });
  snapshot.transcript[0].description = 'rewritten projection';

  assert.throws(
    () => applyLiveContestedChatAction(snapshot, 'command:move:army-alpha:center'),
    /integrity or shape mismatch/,
  );
});

test('recomputed hashes cannot bless canonical game state that disagrees with receipt replay', () => {
  const snapshot = createLiveContestedRts({ sessionId: 'v17-state-replay-tamper' });
  snapshot.game.players['chat-001'].budgetRemaining = 1;
  reseal(snapshot);

  assert.throws(
    () => inspectLiveContestedSnapshot(snapshot),
    /game state does not match canonical receipt replay/,
  );
});

test('recomputed hashes cannot turn a rewritten transcript into canonical history', () => {
  const snapshot = createLiveContestedRts({ sessionId: 'v17-history-replay-tamper' });
  snapshot.transcript[0].actionId = 'wait:yield-window';
  reseal(snapshot);

  assert.throws(
    () => inspectLiveContestedSnapshot(snapshot),
    /transcript does not match canonical game receipts/,
  );
});

test('decision receipts remain causally linked to the exact game receipt', () => {
  const snapshot = createLiveContestedRts({ sessionId: 'v17-decision-link-tamper' });
  snapshot.floorbornDecisionReceipts[0].outcomeEventId = 'invented:event';
  reseal(snapshot);

  assert.throws(
    () => inspectLiveContestedSnapshot(snapshot),
    /is not linked to game history/,
  );
});

test('post-anchor Floorborn decisions replay instead of trusting a recomputed digest', () => {
  const snapshot = createLiveContestedRts({ sessionId: 'v17-anchor-tamper' });
  snapshot.replayAnchor.floorborn.floorborn.memory.seenPlaces['invented-place'] = 1;
  reseal(snapshot);

  assert.throws(
    () => inspectLiveContestedSnapshot(snapshot),
    /resumed Floorborn state diverged from replay anchor/,
  );
});

test('legacy v0.1 import creates an explicit current-state trust anchor then verifies new work', () => {
  const current = createLiveContestedRts({ sessionId: 'v17-legacy-migration' });
  const legacy = toLegacy(current);
  const migrated = migrateLiveContestedSnapshot(legacy);
  const migrationReceipt = inspectLiveContestedSnapshot(legacy);

  assert.equal(migrated.schema, LIVE_CONTESTED_SNAPSHOT_SCHEMA);
  assert.equal(migrated.replayAnchor.kind, 'legacy-v0.1-import');
  assert.equal(migrated.replayAnchor.receiptIndex, legacy.game.receipts.length);
  assert.equal(migrationReceipt.migrated, true);
  assert.equal(migrationReceipt.verifiedFromReceiptIndex, legacy.game.receipts.length);

  const resumed = applyLiveContestedChatAction(
    legacy,
    'command:move:army-alpha:center',
  );
  const resumedReceipt = inspectLiveContestedSnapshot(resumed);
  assert.equal(resumed.schema, LIVE_CONTESTED_SNAPSHOT_SCHEMA);
  assert.equal(resumed.replayAnchor.kind, 'legacy-v0.1-import');
  assert.ok(resumedReceipt.receiptCount > resumed.replayAnchor.receiptIndex);
});

test('legacy import validates its game and projections before establishing a trust anchor', () => {
  const legacy = toLegacy(createLiveContestedRts({ sessionId: 'v17-invalid-legacy' }));
  legacy.transcript = [];

  assert.throws(
    () => migrateLiveContestedSnapshot(legacy),
    /transcript does not match canonical game receipts/,
  );
});

function toLegacy(snapshot) {
  const legacy = structuredClone(snapshot);
  legacy.schema = 'axm.floorborn.live-contested-rts.v0.1';
  delete legacy.integrity;
  delete legacy.replayAnchor;
  return legacy;
}

function reseal(snapshot) {
  const canonicalGame = structuredClone(snapshot.game);
  delete canonicalGame.receipts;
  const integrity = {
    schema: 'axm.floorborn.live-contested-rts.integrity.v0.1',
    algorithm: 'sha256',
    canonicalStateDigest: digest({
      sessionId: snapshot.sessionId,
      floorborn: snapshot.floorborn,
      game: canonicalGame,
    }),
    retainedHistoryDigest: digest({
      gameReceipts: snapshot.game.receipts,
      transcript: snapshot.transcript,
      floorbornDecisionReceipts: snapshot.floorbornDecisionReceipts,
    }),
    replayAnchorDigest: digest(snapshot.replayAnchor),
  };
  integrity.snapshotDigest = digest(integrity);
  snapshot.integrity = integrity;
}
