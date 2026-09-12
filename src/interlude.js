import { assertLegalAction, freezeObservation, PLAYER_PROTOCOL_VERSION } from './protocol.js';
import { digest, stableClone } from './stable.js';

const CAMPFIRE = Object.freeze({
  id: 'campfire',
  label: 'Quiet Campfire',
  tags: ['reflection', 'safe'],
});

export class InterludeSession {
  constructor({ sessionId, playerId = 'floorborn-001', peerId = null, snapshot = null } = {}) {
    if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
    if (!playerId || typeof playerId !== 'string') throw new Error('playerId is required');
    if (peerId !== null && typeof peerId !== 'string') throw new Error('peerId must be a string or null');

    this.sessionId = sessionId;
    this.playerId = playerId;
    this.peerId = peerId;

    if (snapshot) {
      this.restoreSnapshot(snapshot);
      return;
    }

    this.turn = 0;
    this.selectedIntent = null;
    this.receipts = [];
  }

  isComplete() {
    return this.selectedIntent !== null;
  }

  observe() {
    if (this.isComplete()) throw new Error('interlude is already complete');

    const legalActions = [
      action('signal:finish-journey', 'finish-journey', ['completion']),
      action('signal:seek-relic', 'seek-relic', ['optional', 'relic']),
    ];
    if (this.peerId) {
      legalActions.push(action('signal:continue-with-peer', 'continue-with-peer', ['cooperation', 'optional']));
    }

    return freezeObservation({
      protocol: PLAYER_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      turn: this.turn,
      self: {
        playerId: this.playerId,
        inventory: [],
      },
      place: {
        ...CAMPFIRE,
        known: true,
      },
      exits: [],
      party: {
        objective: 'Choose what to pursue after the completed adventure. None of these choices is required to win the previous expedition.',
        peer: this.peerId ? {
          playerId: this.peerId,
          placeId: CAMPFIRE.id,
          inventory: [],
          signal: null,
        } : null,
      },
      legalActions,
    });
  }

  step(actionTaken) {
    if (this.isComplete()) throw new Error('interlude is already complete');
    const observation = this.observe();
    assertLegalAction(actionTaken, observation);
    const preStateDigest = digest(this.publicState());

    this.selectedIntent = actionTaken.target;
    this.turn += 1;

    const result = outcomeForIntent(this.selectedIntent);
    const receipt = {
      schema: 'axm.floorborn.interlude.receipt.v0.1',
      sessionId: this.sessionId,
      playerId: this.playerId,
      turn: observation.turn,
      observationDigest: digest(observation),
      action: stableClone(actionTaken),
      outcome: result,
      preStateDigest,
      postStateDigest: digest(this.publicState()),
    };
    this.receipts.push(receipt);
    return stableClone(receipt);
  }

  publicState() {
    return {
      sessionId: this.sessionId,
      playerId: this.playerId,
      peerId: this.peerId,
      turn: this.turn,
      selectedIntent: this.selectedIntent,
    };
  }

  snapshot() {
    return stableClone({
      schema: 'axm.floorborn.interlude.game.v0.1',
      ...this.publicState(),
      receipts: this.receipts,
    });
  }

  restoreSnapshot(snapshot) {
    if (snapshot.schema !== 'axm.floorborn.interlude.game.v0.1') throw new Error('unsupported interlude snapshot');
    if (snapshot.sessionId !== this.sessionId || snapshot.playerId !== this.playerId || snapshot.peerId !== this.peerId) {
      throw new Error('interlude snapshot mismatch');
    }
    this.turn = snapshot.turn;
    this.selectedIntent = snapshot.selectedIntent;
    this.receipts = stableClone(snapshot.receipts ?? []);
  }
}

export function replayInterlude({ sessionId, playerId = 'floorborn-001', peerId = null, receipts }) {
  const game = new InterludeSession({ sessionId, playerId, peerId });
  for (const expected of receipts) {
    const observation = game.observe();
    if (digest(observation) !== expected.observationDigest) {
      throw new Error(`interlude replay observation mismatch at turn ${expected.turn}`);
    }
    const actual = game.step(expected.action);
    if (actual.preStateDigest !== expected.preStateDigest || actual.postStateDigest !== expected.postStateDigest) {
      throw new Error(`interlude replay state mismatch at turn ${expected.turn}`);
    }
    if (digest(actual.outcome) !== digest(expected.outcome)) {
      throw new Error(`interlude replay outcome mismatch at turn ${expected.turn}`);
    }
  }
  return game.publicState();
}

function action(id, target, affordanceTags) {
  return {
    id,
    kind: 'signal',
    target,
    affordanceTags: [...affordanceTags].sort(),
  };
}

function outcomeForIntent(intent) {
  if (intent === 'seek-relic') {
    return {
      eventId: 'intent:seek-relic',
      placeId: CAMPFIRE.id,
      description: 'Chose to pursue another optional memory relic.',
      utility: 0,
      novelty: 0.2,
    };
  }
  if (intent === 'continue-with-peer') {
    return {
      eventId: 'intent:continue-with-peer',
      placeId: CAMPFIRE.id,
      description: 'Chose to continue the next adventure with the current companion.',
      utility: 0,
      novelty: 0.2,
    };
  }
  return {
    eventId: 'intent:finish-journey',
    placeId: CAMPFIRE.id,
    description: 'Chose to end the journey here.',
    utility: 0,
    novelty: 0.1,
  };
}
