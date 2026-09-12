import { assertLegalAction, freezeObservation, PLAYER_PROTOCOL_VERSION } from './protocol.js';
import { digest, stableClone } from './stable.js';

const PLACE = Object.freeze({
  id: 'signal-crossing',
  label: 'Signal Crossing',
  tags: ['route', 'uncertain'],
});

export class SignalTrialSession {
  constructor({
    sessionId,
    playerId = 'floorborn-001',
    peerId = 'chat-001',
    peerSignal = 'route-safe',
    actualSafe = true,
    mode = 'training',
    snapshot = null,
  } = {}) {
    if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
    if (!playerId || typeof playerId !== 'string') throw new Error('playerId is required');
    if (!peerId || typeof peerId !== 'string') throw new Error('peerId is required');
    if (!peerSignal || typeof peerSignal !== 'string') throw new Error('peerSignal is required');
    if (!['training', 'evaluation'].includes(mode)) throw new Error('unsupported signal trial mode');

    this.sessionId = sessionId;
    this.playerId = playerId;
    this.peerId = peerId;
    this.peerSignal = peerSignal;
    this.actualSafe = Boolean(actualSafe);
    this.mode = mode;

    if (snapshot) {
      this.restoreSnapshot(snapshot);
      return;
    }

    this.turn = 0;
    this.complete = false;
    this.receipts = [];
  }

  isComplete() {
    return this.complete;
  }

  observe() {
    if (this.complete) throw new Error('signal trial is complete');

    const legalActions = this.mode === 'training'
      ? [action('inspect:verify-route', 'inspect', 'route', ['route', 'verification'])]
      : [
        action('signal:follow-peer', 'signal', 'follow-peer', ['communication', 'cooperation', 'route']),
        action('inspect:verify-current', 'inspect', 'route', ['route', 'verification']),
      ];

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
        known: false,
      },
      exits: [],
      party: {
        objective: this.mode === 'training'
          ? 'Verify the route and compare the result with the companion signal.'
          : 'Choose whether to act on the companion signal or verify the route yourself.',
        peer: {
          playerId: this.peerId,
          placeId: PLACE.id,
          inventory: [],
          signal: this.peerSignal,
        },
      },
      legalActions,
    });
  }

  step(actionTaken) {
    if (this.complete) throw new Error('signal trial is complete');
    const observation = this.observe();
    assertLegalAction(actionTaken, observation);
    const preStateDigest = digest(this.publicState());

    const verdict = signalVerdict(this.peerSignal, this.actualSafe);
    const followed = actionTaken.id === 'signal:follow-peer';
    const result = followed
      ? {
        eventId: this.actualSafe ? 'followed:safe-route' : 'followed:danger-route',
        placeId: PLACE.id,
        description: this.actualSafe
          ? 'Followed the companion signal and the route was safe.'
          : 'Followed the companion signal and encountered danger.',
        utility: this.actualSafe ? 1.2 : -2.0,
        novelty: 0.25,
        peerSignalVerdict: verdict,
      }
      : {
        eventId: this.actualSafe ? 'verified:safe-route' : 'verified:danger-route',
        placeId: PLACE.id,
        description: this.actualSafe
          ? 'Verified the route independently; it was safe.'
          : 'Verified the route independently; it was dangerous.',
        utility: 0.1,
        novelty: 0.5,
        peerSignalVerdict: verdict,
      };

    this.turn += 1;
    this.complete = true;

    const receipt = {
      schema: 'axm.floorborn.signal-trial.receipt.v0.1',
      sessionId: this.sessionId,
      playerId: this.playerId,
      turn: observation.turn,
      observationDigest: digest(observation),
      action: stableClone(actionTaken),
      outcome: stableClone(result),
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
      peerSignal: this.peerSignal,
      mode: this.mode,
      turn: this.turn,
      complete: this.complete,
    };
  }

  snapshot() {
    return stableClone({
      schema: 'axm.floorborn.signal-trial.game.v0.1',
      ...this.publicState(),
      actualSafe: this.actualSafe,
      receipts: this.receipts,
    });
  }

  restoreSnapshot(snapshot) {
    if (snapshot.schema !== 'axm.floorborn.signal-trial.game.v0.1') throw new Error('unsupported signal trial snapshot');
    if (
      snapshot.sessionId !== this.sessionId
      || snapshot.playerId !== this.playerId
      || snapshot.peerId !== this.peerId
      || snapshot.peerSignal !== this.peerSignal
      || snapshot.mode !== this.mode
    ) {
      throw new Error('signal trial snapshot mismatch');
    }
    this.actualSafe = Boolean(snapshot.actualSafe);
    this.turn = snapshot.turn;
    this.complete = Boolean(snapshot.complete);
    this.receipts = stableClone(snapshot.receipts ?? []);
  }
}

export function replaySignalTrial({
  sessionId,
  playerId = 'floorborn-001',
  peerId = 'chat-001',
  peerSignal = 'route-safe',
  actualSafe = true,
  mode = 'training',
  receipts,
}) {
  const game = new SignalTrialSession({
    sessionId,
    playerId,
    peerId,
    peerSignal,
    actualSafe,
    mode,
  });

  for (const expected of receipts) {
    const observation = game.observe();
    if (digest(observation) !== expected.observationDigest) {
      throw new Error(`signal trial replay observation mismatch at turn ${expected.turn}`);
    }
    const actual = game.step(expected.action);
    if (actual.preStateDigest !== expected.preStateDigest || actual.postStateDigest !== expected.postStateDigest) {
      throw new Error(`signal trial replay state mismatch at turn ${expected.turn}`);
    }
    if (digest(actual.outcome) !== digest(expected.outcome)) {
      throw new Error(`signal trial replay outcome mismatch at turn ${expected.turn}`);
    }
  }
  return game.publicState();
}

function signalVerdict(signal, actualSafe) {
  if (signal === 'route-safe') return actualSafe ? 'supported' : 'contradicted';
  if (signal === 'route-danger') return actualSafe ? 'contradicted' : 'supported';
  return 'contradicted';
}

function action(id, kind, target, affordanceTags) {
  return {
    id,
    kind,
    target,
    affordanceTags: [...affordanceTags].sort(),
  };
}
