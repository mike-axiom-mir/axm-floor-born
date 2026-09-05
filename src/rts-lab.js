import {
  assertLegalAction,
  freezeObservation,
  RTS_PLAYER_PROTOCOL_VERSION,
  validateActionShape,
} from './protocol.js';
import { digest, stableClone } from './stable.js';

export const RTS_WINDOW_SECONDS = 5;
export const RTS_EFFECTIVE_ACTIONS_PER_WINDOW = 2;
export const RTS_EFFECTIVE_APM_LIMIT = (RTS_EFFECTIVE_ACTIONS_PER_WINDOW / RTS_WINDOW_SECONDS) * 60;

const MAP = Object.freeze({
  id: 'rts-command-map',
  label: 'RTS Command Map',
  tags: ['rts', 'strategy'],
});

const INITIAL_GROUPS = Object.freeze({
  workers: { role: 'worker', position: 'base' },
  scout: { role: 'scout', position: 'base' },
  'army-alpha': { role: 'combat', position: 'base' },
  'army-beta': { role: 'combat', position: 'base' },
});

export class RtsActionBudgetSession {
  constructor({ sessionId, playerId = 'floorborn-001', snapshot = null } = {}) {
    if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
    if (!playerId || typeof playerId !== 'string') throw new Error('playerId is required');

    this.sessionId = sessionId;
    this.playerId = playerId;

    if (snapshot) {
      this.restoreSnapshot(snapshot);
      return;
    }

    this.turn = 0;
    this.windowIndex = 0;
    this.budgetRemaining = RTS_EFFECTIVE_ACTIONS_PER_WINDOW;
    this.resources = 50;
    this.powerNodes = 0;
    this.scouted = { north: false, south: false };
    this.groups = stableClone(INITIAL_GROUPS);
    this.visibleContacts = [];
    this.receipts = [];

    this.hiddenEnemy = {
      secretDoctrine: 'hidden-engine-only',
      baseRegion: 'north-ridge',
      resources: 80,
      squads: {
        'enemy-screen': { position: 'north-ridge', strength: 3 },
        'enemy-reserve': { position: 'enemy-base', strength: 5 },
      },
    };
  }

  isComplete() {
    return this.powerNodes >= 1 && this.scouted.north;
  }

  observe() {
    if (this.isComplete()) throw new Error('RTS proof objective is complete');

    const legalActions = this.legalActions();
    return freezeObservation({
      protocol: RTS_PLAYER_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      turn: this.turn,
      self: {
        playerId: this.playerId,
        inventory: [],
      },
      place: {
        ...MAP,
        known: true,
      },
      exits: [],
      party: {
        objective: 'Build one power node and scout the north ridge while respecting the effective APM budget.',
        peer: null,
      },
      rts: {
        windowIndex: this.windowIndex,
        windowSeconds: RTS_WINDOW_SECONDS,
        maxEffectiveActionsPerWindow: RTS_EFFECTIVE_ACTIONS_PER_WINDOW,
        effectiveApmLimit: RTS_EFFECTIVE_APM_LIMIT,
        budgetRemaining: this.budgetRemaining,
        resources: this.resources,
        powerNodes: this.powerNodes,
        ownGroups: Object.entries(this.groups).map(([id, group]) => ({ id, ...stableClone(group) })),
        scouted: stableClone(this.scouted),
        visibleEnemyContacts: stableClone(this.visibleContacts),
        objectiveProgress: {
          powerNodeBuilt: this.powerNodes >= 1,
          northScouted: this.scouted.north,
        },
      },
      legalActions,
    });
  }

  legalActions() {
    const candidates = [];

    if (this.powerNodes < 1 && this.resources >= 20) {
      candidates.push(command(
        'command:build:power-node',
        'power-node',
        ['workers'],
        ['economy', 'goal', 'resource'],
      ));
    }

    if (!this.scouted.north) {
      candidates.push(command(
        'command:scout:north',
        'north-ridge',
        ['scout'],
        ['exploration', 'goal', 'information'],
      ));
    }

    if (!this.scouted.south) {
      candidates.push(command(
        'command:scout:south',
        'south-ridge',
        ['scout'],
        ['exploration', 'information', 'optional'],
      ));
    }

    if (this.groups['army-alpha'].position !== 'hill') {
      candidates.push(command(
        'command:move:army-alpha:hill',
        'hill',
        ['army-alpha'],
        ['positioning'],
      ));
    }

    if (
      this.groups['army-alpha'].position !== 'hill'
      || this.groups['army-beta'].position !== 'hill'
    ) {
      candidates.push(command(
        'command:move:army-pair:hill',
        'hill',
        ['army-alpha', 'army-beta'],
        ['coordination', 'positioning'],
      ));
    }

    const affordable = candidates.filter((action) => action.effectiveCost <= this.budgetRemaining);
    affordable.push({
      id: 'wait:advance-window',
      kind: 'wait',
      target: 'next-window',
      affordanceTags: ['budget-refresh', 'time'],
      effectiveCost: 0,
    });
    return affordable;
  }

  step(actionTaken) {
    if (this.isComplete()) throw new Error('RTS proof objective is complete');
    validateActionShape(actionTaken);

    const computedCost = effectiveCommandCost(actionTaken);
    if (actionTaken.effectiveCost !== computedCost) {
      throw new Error(`effective cost mismatch: declared ${actionTaken.effectiveCost}, computed ${computedCost}`);
    }
    if (computedCost > this.budgetRemaining) {
      throw new Error(`action budget exceeded: need ${computedCost}, have ${this.budgetRemaining}`);
    }

    const observation = this.observe();
    assertLegalAction(actionTaken, observation);

    const preStateDigest = digest(this.publicState());
    const budgetBefore = this.budgetRemaining;
    const windowBefore = this.windowIndex;
    const outcome = this.applyAction(actionTaken);

    this.turn += 1;
    const receipt = {
      schema: 'axm.floorborn.rts.receipt.v0.1',
      sessionId: this.sessionId,
      playerId: this.playerId,
      turn: observation.turn,
      windowIndex: windowBefore,
      observationDigest: digest(observation),
      action: stableClone(actionTaken),
      effectiveCost: computedCost,
      budgetBefore,
      budgetAfter: this.budgetRemaining,
      outcome,
      preStateDigest,
      postStateDigest: digest(this.publicState()),
    };
    this.receipts.push(receipt);
    return stableClone(receipt);
  }

  applyAction(actionTaken) {
    if (actionTaken.id === 'wait:advance-window') {
      this.windowIndex += 1;
      this.budgetRemaining = RTS_EFFECTIVE_ACTIONS_PER_WINDOW;
      const income = 5 + this.powerNodes * 5;
      this.resources += income;
      return outcome(
        `window-advanced:${this.windowIndex}`,
        `Advanced to action window ${this.windowIndex}; gained ${income} resources.`,
        0,
        0.1,
      );
    }

    this.budgetRemaining -= actionTaken.effectiveCost;

    if (actionTaken.id === 'command:build:power-node') {
      this.resources -= 20;
      this.powerNodes += 1;
      return outcome('built:power-node', 'Built one power node.', 1.2, 0.25);
    }

    if (actionTaken.id === 'command:scout:north') {
      this.groups.scout.position = 'north-ridge';
      this.scouted.north = true;
      this.visibleContacts = [{
        id: 'enemy-screen-contact',
        region: 'north-ridge',
        classification: 'combat-contact',
      }];
      return outcome('scouted:north', 'Scouted north ridge and revealed one visible enemy contact.', 1.4, 0.8);
    }

    if (actionTaken.id === 'command:scout:south') {
      this.groups.scout.position = 'south-ridge';
      this.scouted.south = true;
      return outcome('scouted:south', 'Scouted south ridge; no enemy contact was visible.', 0.2, 0.6);
    }

    if (actionTaken.id === 'command:move:army-alpha:hill') {
      this.groups['army-alpha'].position = 'hill';
      return outcome('moved:army-alpha:hill', 'Moved army-alpha to the hill.', 0.15, 0.15);
    }

    if (actionTaken.id === 'command:move:army-pair:hill') {
      this.groups['army-alpha'].position = 'hill';
      this.groups['army-beta'].position = 'hill';
      return outcome('moved:army-pair:hill', 'Moved two independently controlled armies to the hill.', 0.25, 0.2);
    }

    throw new Error(`unsupported RTS action: ${actionTaken.id}`);
  }

  publicState() {
    return {
      sessionId: this.sessionId,
      playerId: this.playerId,
      turn: this.turn,
      windowIndex: this.windowIndex,
      budgetRemaining: this.budgetRemaining,
      resources: this.resources,
      powerNodes: this.powerNodes,
      scouted: stableClone(this.scouted),
      groups: stableClone(this.groups),
      visibleContacts: stableClone(this.visibleContacts),
      complete: this.isComplete(),
    };
  }

  snapshot() {
    return stableClone({
      schema: 'axm.floorborn.rts.game.v0.1',
      ...this.publicState(),
      receipts: this.receipts,
      hiddenEnemy: this.hiddenEnemy,
    });
  }

  restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.schema !== 'axm.floorborn.rts.game.v0.1') {
      throw new Error('unsupported RTS snapshot');
    }
    if (snapshot.sessionId !== this.sessionId || snapshot.playerId !== this.playerId) {
      throw new Error('RTS snapshot mismatch');
    }
    this.turn = snapshot.turn;
    this.windowIndex = snapshot.windowIndex;
    this.budgetRemaining = snapshot.budgetRemaining;
    this.resources = snapshot.resources;
    this.powerNodes = snapshot.powerNodes;
    this.scouted = stableClone(snapshot.scouted);
    this.groups = stableClone(snapshot.groups);
    this.visibleContacts = stableClone(snapshot.visibleContacts);
    this.receipts = stableClone(snapshot.receipts ?? []);
    this.hiddenEnemy = stableClone(snapshot.hiddenEnemy);
  }
}

export function effectiveCommandCost(action) {
  if (action.kind === 'wait') return 0;
  if (action.kind !== 'command') throw new Error('RTS effective cost requires a command or wait action');
  if (!Array.isArray(action.affectedGroups) || action.affectedGroups.length === 0) {
    throw new Error('RTS command requires affectedGroups');
  }
  return new Set(action.affectedGroups).size;
}

export function replayRtsSession({ sessionId, playerId = 'floorborn-001', receipts }) {
  const game = new RtsActionBudgetSession({ sessionId, playerId });
  for (const expected of receipts) {
    const observation = game.observe();
    if (digest(observation) !== expected.observationDigest) {
      throw new Error(`RTS replay observation mismatch at turn ${expected.turn}`);
    }
    const actual = game.step(expected.action);
    if (
      actual.preStateDigest !== expected.preStateDigest
      || actual.postStateDigest !== expected.postStateDigest
      || actual.budgetBefore !== expected.budgetBefore
      || actual.budgetAfter !== expected.budgetAfter
    ) {
      throw new Error(`RTS replay state/budget mismatch at turn ${expected.turn}`);
    }
    if (digest(actual.outcome) !== digest(expected.outcome)) {
      throw new Error(`RTS replay outcome mismatch at turn ${expected.turn}`);
    }
  }
  return game.publicState();
}

export function runRtsFloorbornProof({ player, sessionId = 'rts-floorborn-proof' }) {
  const game = new RtsActionBudgetSession({ sessionId, playerId: player.playerId });
  const decisions = [];

  while (!game.isComplete() && game.turn < 12) {
    const observation = game.observe();
    const action = player.decide(observation);
    const decision = stableClone(player.lastDecision);
    const receipt = game.step(action);
    player.learn(receipt);
    decisions.push({ observation, action, decision, receipt });
  }

  if (!game.isComplete()) throw new Error('Floorborn did not complete the RTS action-budget objective');
  player.markSessionComplete(sessionId);
  return {
    game,
    decisions,
    finalState: game.publicState(),
  };
}

function command(id, target, affectedGroups, affordanceTags) {
  const action = {
    id,
    kind: 'command',
    target,
    affectedGroups: [...affectedGroups].sort(),
    affordanceTags: [...affordanceTags].sort(),
  };
  action.effectiveCost = effectiveCommandCost(action);
  return action;
}

function outcome(eventId, description, utility, novelty) {
  return {
    eventId,
    placeId: MAP.id,
    description,
    utility,
    novelty,
  };
}
