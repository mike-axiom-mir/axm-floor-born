import { assertLegalAction, freezeObservation, PLAYER_PROTOCOL_VERSION } from './protocol.js';
import { digest, stableClone } from './stable.js';

const PLACE = Object.freeze({
  id: 'waypoint',
  label: 'Wayfarer Waypoint',
  tags: ['safe', 'junction'],
});

export class IntentionOpportunitySession {
  constructor({
    sessionId,
    playerId = 'floorborn-001',
    availability = 'available',
    snapshot = null,
  } = {}) {
    if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
    if (!playerId || typeof playerId !== 'string') throw new Error('playerId is required');
    if (!['available', 'blocked'].includes(availability)) throw new Error('unsupported opportunity availability');

    this.sessionId = sessionId;
    this.playerId = playerId;
    this.availability = availability;

    if (snapshot) {
      this.restoreSnapshot(snapshot);
      return;
    }

    this.turn = 0;
    this.stage = 'choice';
    this.complete = false;
    this.receipts = [];
  }

  isComplete() {
    return this.complete;
  }

  observe() {
    if (this.complete) throw new Error('intention opportunity is complete');

    let legalActions;
    let objective;
    if (this.availability === 'blocked') {
      legalActions = [action(
        'signal:acknowledge-no-relic',
        'signal',
        'acknowledge-no-relic',
        ['completion', 'intent-resolution'],
      )];
      objective = 'The previously possible relic route is no longer available. Acknowledge the changed world state.';
    } else if (this.stage === 'choice') {
      legalActions = [
        action('signal:stay-course', 'signal', 'stay-course', ['completion']),
        action('signal:pursue-relic-route', 'signal', 'pursue-relic-route', ['optional', 'relic']),
      ];
      objective = 'A non-required relic route is available beside the ordinary onward path.';
    } else {
      legalActions = [action('gather:memory-relic', 'gather', 'memory-relic', ['optional', 'relic'])];
      objective = 'The chosen relic route has produced a memory relic that may be collected.';
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
        ...PLACE,
        known: true,
      },
      exits: [],
      party: {
        objective,
        peer: null,
      },
      legalActions,
    });
  }

  step(actionTaken) {
    if (this.complete) throw new Error('intention opportunity is complete');
    const observation = this.observe();
    assertLegalAction(actionTaken, observation);
    const preStateDigest = digest(this.publicState());

    let result;
    if (this.availability === 'blocked') {
      this.complete = true;
      result = outcome(
        'intent-invalidated:seek-relic',
        'The relic route is no longer available; the pending relic intention is invalidated by current world state.',
        0,
        0.2,
      );
    } else if (this.stage === 'choice' && actionTaken.id === 'signal:pursue-relic-route') {
      this.stage = 'relic';
      result = outcome(
        'pursued:relic-opportunity',
        'Committed this session to the optional relic route.',
        0.1,
        0.4,
      );
    } else if (this.stage === 'choice') {
      this.complete = true;
      result = outcome(
        'continued:ordinary-route',
        'Continued along the ordinary route without taking the optional relic branch.',
        0.1,
        0.1,
      );
    } else {
      this.complete = true;
      result = outcome(
        'gathered:memory-relic',
        'Collected the memory relic and fulfilled the pending relic intention if one existed.',
        0.4,
        0.5,
      );
    }

    this.turn += 1;
    const receipt = {
      schema: 'axm.floorborn.intention-opportunity.receipt.v0.1',
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
      availability: this.availability,
      turn: this.turn,
      stage: this.stage,
      complete: this.complete,
    };
  }

  snapshot() {
    return stableClone({
      schema: 'axm.floorborn.intention-opportunity.game.v0.1',
      ...this.publicState(),
      receipts: this.receipts,
    });
  }

  restoreSnapshot(snapshot) {
    if (snapshot.schema !== 'axm.floorborn.intention-opportunity.game.v0.1') {
      throw new Error('unsupported intention opportunity snapshot');
    }
    if (
      snapshot.sessionId !== this.sessionId
      || snapshot.playerId !== this.playerId
      || snapshot.availability !== this.availability
    ) {
      throw new Error('intention opportunity snapshot mismatch');
    }
    this.turn = snapshot.turn;
    this.stage = snapshot.stage;
    this.complete = Boolean(snapshot.complete);
    this.receipts = stableClone(snapshot.receipts ?? []);
  }
}

export function replayIntentionOpportunity({
  sessionId,
  playerId = 'floorborn-001',
  availability = 'available',
  receipts,
}) {
  const game = new IntentionOpportunitySession({ sessionId, playerId, availability });
  for (const expected of receipts) {
    const observation = game.observe();
    if (digest(observation) !== expected.observationDigest) {
      throw new Error(`intention replay observation mismatch at turn ${expected.turn}`);
    }
    const actual = game.step(expected.action);
    if (actual.preStateDigest !== expected.preStateDigest || actual.postStateDigest !== expected.postStateDigest) {
      throw new Error(`intention replay state mismatch at turn ${expected.turn}`);
    }
    if (digest(actual.outcome) !== digest(expected.outcome)) {
      throw new Error(`intention replay outcome mismatch at turn ${expected.turn}`);
    }
  }
  return game.publicState();
}

function action(id, kind, target, affordanceTags) {
  return {
    id,
    kind,
    target,
    affordanceTags: [...affordanceTags].sort(),
  };
}

function outcome(eventId, description, utility, novelty) {
  return {
    eventId,
    placeId: PLACE.id,
    description,
    utility,
    novelty,
  };
}
