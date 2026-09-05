import { assertLegalAction, freezeObservation, PLAYER_PROTOCOL_VERSION } from './protocol.js';
import { digest, stableClone } from './stable.js';

const WORLDS = Object.freeze({
  'ruins-lesson': {
    start: 'ruins',
    maxTurns: 2,
    places: {
      ruins: {
        label: 'Quiet Ruins',
        tags: ['ancient', 'structure'],
        exits: [],
        hiddenDiscovery: 'sealed-cache',
      },
    },
  },
  crossroads: {
    start: 'crossroads',
    maxTurns: 1,
    places: {
      crossroads: {
        label: 'Crossroads',
        tags: ['junction'],
        exits: ['forest', 'ruins'],
      },
      forest: {
        label: 'Green Forest',
        tags: ['wild', 'resource'],
        exits: ['crossroads'],
      },
      ruins: {
        label: 'Old Ruins',
        tags: ['ancient', 'structure'],
        exits: ['crossroads'],
      },
    },
  },
});

export class TinyRpgSession {
  constructor({ scenario, playerId, sessionId }) {
    if (!WORLDS[scenario]) throw new Error(`unknown scenario: ${scenario}`);
    this.scenario = scenario;
    this.world = stableClone(WORLDS[scenario]);
    this.playerId = playerId;
    this.sessionId = sessionId;
    this.turn = 0;
    this.placeId = this.world.start;
    this.inspectedPlaces = new Set();
    this.inventory = [];
    this.receipts = [];
  }

  observe() {
    const place = this.currentPlace();
    const legalActions = [];

    if (this.scenario === 'ruins-lesson') {
      if (!this.inspectedPlaces.has(this.placeId)) {
        legalActions.push(action('inspect:ruins', 'inspect', this.placeId, [...place.tags, 'unknown']));
      } else if (!this.inventory.includes('sealed-cache')) {
        legalActions.push(action('gather:sealed-cache', 'gather', 'sealed-cache', [...place.tags, 'cache']));
      } else {
        legalActions.push(action('wait:complete', 'wait', undefined, ['complete']));
      }
    } else {
      for (const exitId of place.exits) {
        const destination = this.world.places[exitId];
        legalActions.push(action(`move:${exitId}`, 'move', exitId, destination.tags));
      }
      legalActions.push(action('wait:crossroads', 'wait', undefined, ['junction']));
    }

    const observation = {
      protocol: PLAYER_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      turn: this.turn,
      self: {
        playerId: this.playerId,
        inventory: [...this.inventory],
      },
      place: {
        id: this.placeId,
        label: place.label,
        tags: [...place.tags],
        known: this.inspectedPlaces.has(this.placeId),
      },
      exits: place.exits.map((exitId) => ({
        id: exitId,
        label: this.world.places[exitId].label,
        tags: [...this.world.places[exitId].tags],
      })),
      legalActions,
    };

    return freezeObservation(observation);
  }

  step(action) {
    const observation = this.observe();
    assertLegalAction(action, observation);

    const preStateDigest = digest(this.publicState());
    let outcome;

    if (action.kind === 'inspect') {
      this.inspectedPlaces.add(this.placeId);
      outcome = {
        eventId: 'discovered:sealed-cache',
        placeId: this.placeId,
        description: 'Inspection revealed a sealed cache in the ruins.',
        utility: 0.5,
        novelty: 1.0,
      };
    } else if (action.kind === 'gather') {
      this.inventory.push('sealed-cache');
      outcome = {
        eventId: 'gathered:sealed-cache',
        placeId: this.placeId,
        description: 'The sealed cache was collected.',
        utility: 2.0,
        novelty: 0.5,
      };
    } else if (action.kind === 'move') {
      this.placeId = action.target;
      outcome = {
        eventId: `moved:${action.target}`,
        placeId: this.placeId,
        description: `Moved to ${this.currentPlace().label}.`,
        utility: 0,
        novelty: 0.25,
      };
    } else {
      outcome = {
        eventId: 'waited',
        placeId: this.placeId,
        description: 'No action beyond waiting.',
        utility: 0,
        novelty: 0,
      };
    }

    this.turn += 1;
    const receipt = {
      schema: 'axm.floorborn.receipt.v0.1',
      sessionId: this.sessionId,
      playerId: this.playerId,
      turn: observation.turn,
      observationDigest: digest(observation),
      action: stableClone(action),
      outcome,
      preStateDigest,
      postStateDigest: digest(this.publicState()),
    };
    this.receipts.push(receipt);
    return stableClone(receipt);
  }

  isComplete() {
    if (this.scenario === 'ruins-lesson') return this.inventory.includes('sealed-cache') || this.turn >= this.world.maxTurns;
    return this.turn >= this.world.maxTurns;
  }

  publicState() {
    return {
      scenario: this.scenario,
      turn: this.turn,
      placeId: this.placeId,
      inventory: [...this.inventory],
      inspectedPlaces: [...this.inspectedPlaces].sort(),
    };
  }

  currentPlace() {
    return this.world.places[this.placeId];
  }
}

export function runSession({ player, scenario, sessionId }) {
  const game = new TinyRpgSession({ scenario, playerId: player.playerId, sessionId });
  const decisions = [];

  while (!game.isComplete()) {
    const observation = game.observe();
    const action = player.decide(observation);
    decisions.push(stableClone(player.lastDecision));
    const receipt = game.step(action);
    player.learn(receipt);
  }

  player.markSessionComplete(sessionId);
  return {
    finalState: game.publicState(),
    receipts: stableClone(game.receipts),
    decisions,
  };
}

export function replaySession({ scenario, playerId, sessionId, receipts }) {
  const game = new TinyRpgSession({ scenario, playerId, sessionId });
  for (const expected of receipts) {
    const observation = game.observe();
    if (digest(observation) !== expected.observationDigest) {
      throw new Error(`replay observation mismatch at turn ${expected.turn}`);
    }
    const actual = game.step(expected.action);
    if (actual.preStateDigest !== expected.preStateDigest || actual.postStateDigest !== expected.postStateDigest) {
      throw new Error(`replay state mismatch at turn ${expected.turn}`);
    }
    if (digest(actual.outcome) !== digest(expected.outcome)) {
      throw new Error(`replay outcome mismatch at turn ${expected.turn}`);
    }
  }
  return game.publicState();
}

function action(id, kind, target, affordanceTags) {
  const result = { id, kind, affordanceTags: [...affordanceTags].sort() };
  if (target !== undefined) result.target = target;
  return result;
}
