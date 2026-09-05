import {
  assertLegalAction,
  freezeObservation,
  RTS_PLAYER_PROTOCOL_VERSION,
  validateActionShape,
} from './protocol.js';
import {
  effectiveCommandCost,
  RTS_EFFECTIVE_ACTIONS_PER_WINDOW,
  RTS_EFFECTIVE_APM_LIMIT,
  RTS_WINDOW_SECONDS,
} from './rts-lab.js';
import { digest, stableClone } from './stable.js';

const MAP = Object.freeze({
  id: 'shared-rts-map',
  label: 'Shared RTS Basin',
  tags: ['rts', 'strategy', 'shared-world'],
});

const INITIAL_GROUPS = Object.freeze({
  workers: { role: 'worker', position: 'base' },
  scout: { role: 'scout', position: 'base' },
  'army-alpha': { role: 'combat', position: 'base' },
  'army-beta': { role: 'combat', position: 'base' },
});

export class SharedRtsSession {
  constructor({
    sessionId,
    playerIds = ['floorborn-001', 'chat-001'],
    snapshot = null,
  } = {}) {
    if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
    if (!Array.isArray(playerIds) || playerIds.length !== 2 || new Set(playerIds).size !== 2) {
      throw new Error('shared RTS requires exactly two distinct player ids');
    }

    this.sessionId = sessionId;
    this.playerIds = [...playerIds];

    if (snapshot) {
      this.restoreSnapshot(snapshot);
      return;
    }

    this.turn = 0;
    this.windowIndex = 0;
    this.activePlayerIndex = 0;
    this.players = Object.fromEntries(playerIds.map((playerId) => [playerId, freshPlayerState()]));
    this.receipts = [];
    this.hiddenDoctrineByPlayer = Object.fromEntries(playerIds.map((playerId, index) => [
      playerId,
      index === 0 ? 'hidden-floorborn-doctrine' : 'hidden-peer-doctrine',
    ]));
  }

  activePlayerId() {
    return this.playerIds[this.activePlayerIndex];
  }

  opponentId(playerId) {
    this.assertKnownPlayer(playerId);
    return this.playerIds.find((candidate) => candidate !== playerId);
  }

  isComplete() {
    return this.playerIds.every((playerId) => this.playerObjectiveComplete(playerId));
  }

  playerObjectiveComplete(playerId) {
    const player = this.players[playerId];
    return player.powerNodes >= 1 && player.scouted.center;
  }

  observe(playerId = this.activePlayerId()) {
    this.assertKnownPlayer(playerId);
    if (this.isComplete()) throw new Error('shared RTS proof objective is complete');
    if (playerId !== this.activePlayerId()) throw new Error(`not ${playerId}'s command opportunity`);

    const self = this.players[playerId];
    const opponentId = this.opponentId(playerId);
    const opponent = this.players[opponentId];

    return freezeObservation({
      protocol: RTS_PLAYER_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      turn: this.turn,
      self: {
        playerId,
        inventory: [],
      },
      place: {
        ...MAP,
        known: true,
      },
      exits: [],
      party: {
        objective: 'Each player must build one power node and scout center under the same effective APM boundary.',
        peer: null,
      },
      rts: {
        mode: 'shared-two-player',
        opponentPlayerId: opponentId,
        windowIndex: this.windowIndex,
        windowSeconds: RTS_WINDOW_SECONDS,
        maxEffectiveActionsPerWindow: RTS_EFFECTIVE_ACTIONS_PER_WINDOW,
        effectiveApmLimit: RTS_EFFECTIVE_APM_LIMIT,
        budgetRemaining: self.budgetRemaining,
        yielded: self.yielded,
        resources: self.resources,
        powerNodes: self.powerNodes,
        ownGroups: groupsView(self.groups),
        scouted: stableClone(self.scouted),
        visibleEnemyContacts: visibleEnemyContacts(self, opponent),
        objectiveProgress: {
          powerNodeBuilt: self.powerNodes >= 1,
          centerScouted: self.scouted.center,
        },
      },
      legalActions: this.legalActionsFor(playerId),
    });
  }

  legalActionsFor(playerId) {
    this.assertKnownPlayer(playerId);
    const player = this.players[playerId];
    const legal = [];

    if (player.yielded || player.budgetRemaining === 0) {
      legal.push(yieldAction());
      return legal;
    }

    if (player.powerNodes < 1 && player.resources >= 20) {
      legal.push(command(
        'command:build:power-node',
        'power-node',
        ['workers'],
        ['economy', 'goal', 'resource'],
      ));
    }

    if (!player.scouted.center) {
      legal.push(command(
        'command:scout:center',
        'center',
        ['scout'],
        ['exploration', 'goal', 'information'],
      ));
    }

    if (!player.scouted.flank) {
      legal.push(command(
        'command:scout:flank',
        'flank',
        ['scout'],
        ['exploration', 'information', 'optional'],
      ));
    }

    if (player.groups['army-alpha'].position !== 'center') {
      legal.push(command(
        'command:move:army-alpha:center',
        'center',
        ['army-alpha'],
        ['positioning'],
      ));
    }

    if (
      player.groups['army-alpha'].position !== 'center'
      || player.groups['army-beta'].position !== 'center'
    ) {
      legal.push(command(
        'command:move:army-pair:center',
        'center',
        ['army-alpha', 'army-beta'],
        ['coordination', 'positioning'],
      ));
    }

    const affordable = legal.filter((action) => action.effectiveCost <= player.budgetRemaining);
    affordable.push(yieldAction());
    return affordable;
  }

  step(playerId, actionTaken) {
    if (this.isComplete()) throw new Error('shared RTS proof objective is complete');
    this.assertKnownPlayer(playerId);
    if (playerId !== this.activePlayerId()) throw new Error(`not ${playerId}'s command opportunity`);
    validateActionShape(actionTaken);

    const player = this.players[playerId];
    const opponentId = this.opponentId(playerId);
    const opponent = this.players[opponentId];
    const computedCost = effectiveCommandCost(actionTaken);
    if (actionTaken.effectiveCost !== computedCost) {
      throw new Error(`effective cost mismatch: declared ${actionTaken.effectiveCost}, computed ${computedCost}`);
    }
    if (computedCost > player.budgetRemaining) {
      throw new Error(`action budget exceeded: need ${computedCost}, have ${player.budgetRemaining}`);
    }

    const observation = this.observe(playerId);
    assertLegalAction(actionTaken, observation);

    const preStateDigest = digest(this.publicState());
    const budgetBefore = player.budgetRemaining;
    const opponentBudgetBefore = opponent.budgetRemaining;
    const windowBefore = this.windowIndex;
    const outcome = this.applyAction(playerId, actionTaken);

    this.turn += 1;
    this.advanceCommandOpportunity(playerId);

    const receipt = {
      schema: 'axm.floorborn.shared-rts.receipt.v0.1',
      sessionId: this.sessionId,
      playerId,
      turn: observation.turn,
      windowIndex: windowBefore,
      observationDigest: digest(observation),
      action: stableClone(actionTaken),
      effectiveCost: computedCost,
      budgetBefore,
      budgetAfter: this.players[playerId].budgetRemaining,
      opponentPlayerId: opponentId,
      opponentBudgetBefore,
      opponentBudgetAfter: this.players[opponentId].budgetRemaining,
      outcome,
      preStateDigest,
      postStateDigest: digest(this.publicState()),
    };
    this.receipts.push(receipt);
    return stableClone(receipt);
  }

  applyAction(playerId, actionTaken) {
    const player = this.players[playerId];

    if (actionTaken.id === 'wait:yield-window') {
      player.yielded = true;
      return outcome('yielded-window', `${playerId} yielded the rest of the current action window.`, 0, 0);
    }

    player.budgetRemaining -= actionTaken.effectiveCost;

    if (actionTaken.id === 'command:build:power-node') {
      player.resources -= 20;
      player.powerNodes += 1;
      return outcome('built:power-node', `${playerId} built one power node.`, 1.2, 0.25);
    }

    if (actionTaken.id === 'command:scout:center') {
      player.groups.scout.position = 'center';
      player.scouted.center = true;
      return outcome('scouted:center', `${playerId} scouted center.`, 1.4, 0.8);
    }

    if (actionTaken.id === 'command:scout:flank') {
      player.groups.scout.position = 'flank';
      player.scouted.flank = true;
      return outcome('scouted:flank', `${playerId} scouted the flank.`, 0.2, 0.6);
    }

    if (actionTaken.id === 'command:move:army-alpha:center') {
      player.groups['army-alpha'].position = 'center';
      return outcome('moved:army-alpha:center', `${playerId} moved army-alpha to center.`, 0.15, 0.15);
    }

    if (actionTaken.id === 'command:move:army-pair:center') {
      player.groups['army-alpha'].position = 'center';
      player.groups['army-beta'].position = 'center';
      return outcome('moved:army-pair:center', `${playerId} moved two armies to center.`, 0.25, 0.2);
    }

    throw new Error(`unsupported shared RTS action: ${actionTaken.id}`);
  }

  advanceCommandOpportunity(previousPlayerId) {
    if (this.isComplete()) return;

    if (this.windowFinished()) {
      this.windowIndex += 1;
      for (const playerId of this.playerIds) {
        const player = this.players[playerId];
        player.budgetRemaining = RTS_EFFECTIVE_ACTIONS_PER_WINDOW;
        player.yielded = false;
        player.resources += 5 + player.powerNodes * 5;
      }
      this.activePlayerIndex = this.windowIndex % this.playerIds.length;
      return;
    }

    const previousIndex = this.playerIds.indexOf(previousPlayerId);
    for (let offset = 1; offset <= this.playerIds.length; offset += 1) {
      const index = (previousIndex + offset) % this.playerIds.length;
      const candidate = this.playerIds[index];
      if (!this.playerDoneForWindow(candidate)) {
        this.activePlayerIndex = index;
        return;
      }
    }

    throw new Error('no eligible shared RTS player found while window remains open');
  }

  playerDoneForWindow(playerId) {
    const player = this.players[playerId];
    return player.yielded || player.budgetRemaining === 0;
  }

  windowFinished() {
    return this.playerIds.every((playerId) => this.playerDoneForWindow(playerId));
  }

  publicState() {
    return {
      sessionId: this.sessionId,
      turn: this.turn,
      windowIndex: this.windowIndex,
      activePlayerId: this.isComplete() ? null : this.activePlayerId(),
      players: stableClone(this.players),
      complete: this.isComplete(),
    };
  }

  snapshot() {
    return stableClone({
      schema: 'axm.floorborn.shared-rts.game.v0.1',
      ...this.publicState(),
      playerIds: [...this.playerIds],
      activePlayerIndex: this.activePlayerIndex,
      receipts: this.receipts,
      hiddenDoctrineByPlayer: this.hiddenDoctrineByPlayer,
    });
  }

  restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.schema !== 'axm.floorborn.shared-rts.game.v0.1') {
      throw new Error('unsupported shared RTS snapshot');
    }
    if (snapshot.sessionId !== this.sessionId) throw new Error('shared RTS snapshot session mismatch');
    if (JSON.stringify(snapshot.playerIds) !== JSON.stringify(this.playerIds)) {
      throw new Error('shared RTS snapshot player mismatch');
    }
    this.turn = snapshot.turn;
    this.windowIndex = snapshot.windowIndex;
    this.activePlayerIndex = snapshot.activePlayerIndex;
    this.players = stableClone(snapshot.players);
    this.receipts = stableClone(snapshot.receipts ?? []);
    this.hiddenDoctrineByPlayer = stableClone(snapshot.hiddenDoctrineByPlayer);
  }

  assertKnownPlayer(playerId) {
    if (!this.playerIds.includes(playerId)) throw new Error(`unknown shared RTS player: ${playerId}`);
  }
}

export function replaySharedRts({
  sessionId,
  playerIds = ['floorborn-001', 'chat-001'],
  receipts,
}) {
  const game = new SharedRtsSession({ sessionId, playerIds });
  for (const expected of receipts) {
    const observation = game.observe(expected.playerId);
    if (digest(observation) !== expected.observationDigest) {
      throw new Error(`shared RTS replay observation mismatch at turn ${expected.turn}`);
    }
    const actual = game.step(expected.playerId, expected.action);
    if (
      actual.preStateDigest !== expected.preStateDigest
      || actual.postStateDigest !== expected.postStateDigest
      || actual.budgetBefore !== expected.budgetBefore
      || actual.budgetAfter !== expected.budgetAfter
      || actual.opponentBudgetBefore !== expected.opponentBudgetBefore
      || actual.opponentBudgetAfter !== expected.opponentBudgetAfter
    ) {
      throw new Error(`shared RTS replay state/budget mismatch at turn ${expected.turn}`);
    }
    if (digest(actual.outcome) !== digest(expected.outcome)) {
      throw new Error(`shared RTS replay outcome mismatch at turn ${expected.turn}`);
    }
  }
  return game.publicState();
}

function freshPlayerState() {
  return {
    budgetRemaining: RTS_EFFECTIVE_ACTIONS_PER_WINDOW,
    yielded: false,
    resources: 50,
    powerNodes: 0,
    scouted: { center: false, flank: false },
    groups: stableClone(INITIAL_GROUPS),
  };
}

function groupsView(groups) {
  return Object.entries(groups).map(([id, group]) => ({ id, ...stableClone(group) }));
}

function visibleEnemyContacts(self, opponent) {
  if (!self.scouted.center) return [];
  return Object.entries(opponent.groups)
    .filter(([, group]) => group.role === 'combat' && group.position === 'center')
    .map(([id]) => ({
      contactId: `enemy-contact:${id}`,
      region: 'center',
      classification: 'combat-contact',
    }))
    .sort((a, b) => a.contactId.localeCompare(b.contactId));
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

function yieldAction() {
  return {
    id: 'wait:yield-window',
    kind: 'wait',
    target: 'current-window',
    affordanceTags: ['budget', 'time'],
    effectiveCost: 0,
  };
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
