import { digest, stableClone } from './stable.js';

export class CampaignLedger {
  constructor({ campaignId, lineageId, snapshot = null } = {}) {
    if (!campaignId || typeof campaignId !== 'string') throw new Error('campaignId is required');
    if (!lineageId || typeof lineageId !== 'string') throw new Error('lineageId is required');
    this.campaignId = campaignId;
    this.lineageId = lineageId;

    if (snapshot) {
      this.restore(snapshot);
      return;
    }

    this.sequence = 0;
    this.entries = [];
    this.links = [];
  }

  checkpoint({
    stage,
    sessionId,
    kind,
    playerSnapshot,
    receipts = [],
    publicState = null,
    note = null,
  }) {
    if (!stage || !sessionId || !kind || !playerSnapshot) throw new Error('checkpoint fields are required');
    this.sequence += 1;
    const entry = {
      sequence: this.sequence,
      stage,
      sessionId,
      kind,
      playerSnapshotDigest: digest(playerSnapshot),
      receiptsDigest: digest(receipts),
      receiptCount: receipts.length,
      publicStateDigest: publicState === null ? null : digest(publicState),
      activeIntentions: stableClone(
        (playerSnapshot.memory?.intentions ?? []).filter((intention) => intention.status === 'pending'),
      ),
      companionIds: Object.keys(playerSnapshot.memory?.companions ?? {}).sort(),
      note,
    };
    this.entries.push(entry);
    return stableClone(entry);
  }

  link({ fromSequence, toSequence, relation, evidence }) {
    if (!Number.isInteger(fromSequence) || !Number.isInteger(toSequence)) {
      throw new Error('link sequences must be integers');
    }
    if (!this.entries.some((entry) => entry.sequence === fromSequence)) throw new Error('unknown fromSequence');
    if (!this.entries.some((entry) => entry.sequence === toSequence)) throw new Error('unknown toSequence');
    if (fromSequence >= toSequence) throw new Error('campaign links must point forward in time');
    if (!relation || typeof relation !== 'string') throw new Error('relation is required');
    if (!Array.isArray(evidence) || evidence.length === 0) throw new Error('link evidence is required');

    const link = {
      fromSequence,
      toSequence,
      relation,
      evidence: [...evidence],
    };
    this.links.push(link);
    return stableClone(link);
  }

  snapshot() {
    return stableClone({
      schema: 'axm.floorborn.campaign-ledger.v0.1',
      campaignId: this.campaignId,
      lineageId: this.lineageId,
      sequence: this.sequence,
      entries: this.entries,
      links: this.links,
    });
  }

  restore(snapshot) {
    if (!snapshot || snapshot.schema !== 'axm.floorborn.campaign-ledger.v0.1') {
      throw new Error('unsupported campaign ledger snapshot');
    }
    if (snapshot.campaignId !== this.campaignId || snapshot.lineageId !== this.lineageId) {
      throw new Error('campaign ledger snapshot mismatch');
    }
    this.sequence = snapshot.sequence;
    this.entries = stableClone(snapshot.entries ?? []);
    this.links = stableClone(snapshot.links ?? []);
  }

  static restore(snapshot) {
    return new CampaignLedger({
      campaignId: snapshot.campaignId,
      lineageId: snapshot.lineageId,
      snapshot,
    });
  }
}
