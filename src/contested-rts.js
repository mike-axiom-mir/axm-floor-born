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

export const CONTESTED_RTS_MAX_WINDOWS = 4;
export const CONTESTED_RTS_CONTROL_TO_WIN = 2;

const MAP = Object.freeze({
  id: 'contested-rts-basin',
  label: 'Contested RTS Basin',
  tags: ['rts', 'strategy', 'contested'],
});

export class ContestedRtsSession {
  constructor({
    sessionId,
    playerIds = ['floorborn-001', 'peer-001'],
    snapshot = null,
  } = {}) {
    if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
    if (!Array.isArray(playerIds) || playerIds.length !== 2 || new Set(playerIds).size !== 2) {
      throw new Error('contested RTS requires exactly two distinct player ids');
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
    this.controlLog = [];
    this.receipts = [];
    this.winnerPlayerId = null;
    this.finished = false;
    this.hiddenDoctrineByPlayer = Object.fromEntries(playerIds.map((playerId, index) => [
      playerId,
      index === 0 ? 'hidden-contested-doctrine-a' : 'hidden-contested-doctrine-b',
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
    return this.finished;
  }

  observe(playerId = this.activePlayerId()) {
    this.assertKnownPlayer(playerId);
    if (this.finished) throw new Error('contested RTS session is complete');
    if (playerId !== this.activePlayerId()) throw new Error(`not ${playerId}'s command opportunity`);

    const self = this.players[playerId];
    const opponentId = this.opponentId(playerId);
    const opponent = this.players[opponentId];
    const visibleContacts = visibleEnemyContacts(self, opponent);

    return freezeObservation({
      protocol: RTS_PLAYER_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      turn: this.turn,
      self: { playerId, inventory: [] },
      place: { ...MAP, known: true },
      exits: [],
      party: {
        objective: `Earn ${CONTESTED_RTS_CONTROL_TO_WIN} uncontested center-control points before the encounter ends.`,
        peer: null,
      },
      rts: {
        mode: 'contested-two-player',
        opponentPlayerId: opponentId,
        windowIndex: this.windowIndex,
        maxWindows: CONTESTED_RTS_MAX_WINDOWS,
        windowSeconds: RTS_WINDOW_SECONDS,
        maxEffectiveActionsPerWindow: RTS_EFFECTIVE_ACTIONS_PER_WINDOW,
        effectiveApmLimit: RTS_EFFECTIVE_APM_LIMIT,
        budgetRemaining: self.budgetRemaining,
        yielded: self.yielded,
        controlPoints: self.controlPoints,
        opponentControlPoints: opponent.controlPoints,
        ownGroups: groupsView(self.groups),
        centerScouted: self.centerScouted,
        visibleEnemyContacts: visibleContacts,
        centerPresence: centerCombatIds(self),
      },
      legalActions: this.legalActionsFor(playerId),
    });
  }

  legalActionsFor(playerId) {
    this.assertKnownPlayer(playerId);
    const self = this.players[playerId];
    const opponent = this.players[this.opponentId(playerId)];

    if (self.yielded || self.budgetRemaining === 0) return [yieldAction()];

    const legal = [];
    if (!self.centerScouted) {
      legal.push(command(
        'command:scout:center',
        'center',
        ['scout'],
        ['exploration', 'information'],
      ));
    }

    if (isAliveAt(self.groups['army-alpha'], 'base')) {
      legal.push(command(
        'command:move:army-alpha:center',
        'center',
        ['army-alpha'],
        ['goal', 'positioning'],
      ));
    }
    if (isAliveAt(self.groups['army-beta'], 'base')) {
      legal.push(command(
        'command:move:army-beta:center',
        'center',
        ['army-beta'],
        ['optional', 'positioning'],
      ));
    }

    const visibleTargets = visibleEnemyContacts(self, opponent);
    for (const attackerId of centerCombatIds(self)) {
      const attacker = self.groups[attackerId];
      if (attacker.integrity === 1) {
        legal.push(command(
          `command:retreat:${attackerId}:base`,
          'base',
          [attackerId],
          ['recovery', 'survival'],
        ));
      }

      if (attacker.fortification === 0) {
        legal.push(command(
          `command:fortify:${attackerId}:center`,
          'center',
          [attackerId],
          ['defense', 'positioning'],
        ));
      }

      for (const contact of visibleTargets) {
        legal.push(command(
          `command:attack:${attackerId}:${contact.groupId}`,
          contact.groupId,
          [attackerId],
          ['combat', 'goal'],
        ));
      }
    }

    const affordable = legal.filter((action) => action.effectiveCost <= self.budgetRemaining);
    affordable.push(yieldAction());
    return affordable;
  }

  step(playerId, actionTaken) {
    if (this.finished) throw new Error('contested RTS session is complete');
    this.assertKnownPlayer(playerId);
    if (playerId !== this.activePlayerId()) throw new Error(`not ${playerId}'s command opportunity`);
    validateActionShape(actionTaken);

    const self = this.players[playerId];
    const opponentId = this.opponentId(playerId);
    const opponent = this.players[opponentId];
    const computedCost = effectiveCommandCost(actionTaken);
    if (actionTaken.effectiveCost !== computedCost) {
      throw new Error(`effective cost mismatch: declared ${actionTaken.effectiveCost}, computed ${computedCost}`);
    }
    if (computedCost > self.budgetRemaining) {
      throw new Error(`action budget exceeded: need ${computedCost}, have ${self.budgetRemaining}`);
    }

    const observation = this.observe(playerId);
    assertLegalAction(actionTaken, observation);

    const preStateDigest = digest(this.publicState());
    const budgetBefore = self.budgetRemaining;
    const opponentBudgetBefore = opponent.budgetRemaining;
    const windowBefore = this.windowIndex;
    const outcome = this.applyAction(playerId, actionTaken);

    this.turn += 1;
    this.advanceCommandOpportunity(playerId);

    const receipt = {
      schema: 'axm.floorborn.contested-rts.receipt.v0.1',
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
    const self = this.players[playerId];
    const opponent = this.players[this.opponentId(playerId)];

    if (actionTaken.id === 'wait:yield-window') {
      self.yielded = true;
      return outcome('yielded-window', `${playerId} yielded the rest of the action window.`, 0, 0);
    }

    self.budgetRemaining -= actionTaken.effectiveCost;

    if (actionTaken.id === 'command:scout:center') {
      self.groups.scout.position = 'center';
      self.centerScouted = true;
      return outcome('scouted:center', `${playerId} scouted center.`, 0.4, 0.7);
    }

    if (actionTaken.id.startsWith('command:move:')) {
      const groupId = actionTaken.affectedGroups[0];
      self.groups[groupId].position = 'center';
      return outcome(`moved:${groupId}:center`, `${playerId} moved ${groupId} to center.`, 0.3, 0.25);
    }

    if (actionTaken.id.startsWith('command:retreat:')) {
      const groupId = actionTaken.affectedGroups[0];
      self.groups[groupId].position = 'base';
      self.groups[groupId].fortification = 0;
      return outcome(`retreated:${groupId}:base`, `${playerId} withdrew damaged ${groupId} to base.`, 0.5, 0.35);
    }

    if (actionTaken.id.startsWith('command:fortify:')) {
      const groupId = actionTaken.affectedGroups[0];
      self.groups[groupId].fortification = 1;
      return outcome(`fortified:${groupId}:center`, `${playerId} fortified ${groupId} at center.`, 0.35, 0.2);
    }

    if (actionTaken.id.startsWith('command:attack:')) {
      const attackerId = actionTaken.affectedGroups[0];
      const targetId = actionTaken.target;
      const target = opponent.groups[targetId];
      if (!isAliveAt(target, 'center')) throw new Error('attack target is no longer present at center');

      let absorbedByFortification = false;
      if (target.fortification > 0) {
        target.fortification -= 1;
        absorbedByFortification = true;
      } else {
        target.integrity -= 1;
        if (target.integrity <= 0) {
          target.integrity = 0;
          target.position = 'destroyed';
          target.fortification = 0;
        }
      }

      const destroyed = target.position === 'destroyed';
      const eventId = destroyed
        ? `destroyed:${targetId}`
        : absorbedByFortification
          ? `fortification-hit:${targetId}`
          : `damaged:${targetId}`;
      const description = destroyed
        ? `${playerId} destroyed opposing ${targetId} at center.`
        : absorbedByFortification
          ? `${playerId} broke ${targetId}'s center fortification.`
          : `${playerId} damaged opposing ${targetId} at center.`;
      return outcome(eventId, description, destroyed ? 1.8 : 0.8, 0.5);
    }

    throw new Error(`unsupported contested RTS action: ${actionTaken.id}`);
  }

  advanceCommandOpportunity(previousPlayerId) {
    if (this.finished) return;

    if (this.windowFinished()) {
      this.resolveCenterControl();
      this.windowIndex += 1;
      this.checkCompletion();
      if (this.finished) return;

      for (const playerId of this.playerIds) {
        const player = this.players[playerId];
        player.budgetRemaining = RTS_EFFECTIVE_ACTIONS_PER_WINDOW;
        player.yielded = false;
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
    throw new Error('no eligible contested RTS player found while window remains open');
  }

  resolveCenterControl() {
    const present = this.playerIds.filter((playerId) => centerCombatIds(this.players[playerId]).length > 0);
    const entry = {
      windowIndex: this.windowIndex,
      present: [...present],
      awardedPlayerId: null,
    };
    if (present.length === 1) {
      this.players[present[0]].controlPoints += 1;
      entry.awardedPlayerId = present[0];
    }
    this.controlLog.push(entry);
  }

  checkCompletion() {
    const reached = this.playerIds.filter(
      (playerId) => this.players[playerId].controlPoints >= CONTESTED_RTS_CONTROL_TO_WIN,
    );
    if (reached.length > 0) {
      this.finished = true;
      this.winnerPlayerId = reached.sort()[0];
      return;
    }
    if (this.windowIndex >= CONTESTED_RTS_MAX_WINDOWS) {
      this.finished = true;
      const sorted = [...this.playerIds].sort((a, b) => (
        this.players[b].controlPoints - this.players[a].controlPoints || a.localeCompare(b)
      ));
      const [first, second] = sorted;
      this.winnerPlayerId = this.players[first].controlPoints > this.players[second].controlPoints
        ? first
        : null;
    }
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
      activePlayerId: this.finished ? null : this.activePlayerId(),
      players: stableClone(this.players),
      controlLog: stableClone(this.controlLog),
      winnerPlayerId: this.winnerPlayerId,
      complete: this.finished,
    };
  }

  snapshot() {
    return stableClone({
      schema: 'axm.floorborn.contested-rts.game.v0.1',
      ...this.publicState(),
      playerIds: [...this.playerIds],
      activePlayerIndex: this.activePlayerIndex,
      receipts: this.receipts,
      hiddenDoctrineByPlayer: this.hiddenDoctrineByPlayer,
    });
  }

  restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.schema !== 'axm.floorborn.contested-rts.game.v0.1') {
      throw new Error('unsupported contested RTS snapshot');
    }
    if (snapshot.sessionId !== this.sessionId) throw new Error('contested RTS snapshot session mismatch');
    if (JSON.stringify(snapshot.playerIds) !== JSON.stringify(this.playerIds)) {
      throw new Error('contested RTS snapshot player mismatch');
    }
    this.turn = snapshot.turn;
    this.windowIndex = snapshot.windowIndex;
    this.activePlayerIndex = snapshot.activePlayerIndex;
    this.players = stableClone(snapshot.players);
    this.controlLog = stableClone(snapshot.controlLog ?? []);
    this.receipts = stableClone(snapshot.receipts ?? []);
    this.winnerPlayerId = snapshot.winnerPlayerId ?? null;
    this.finished = Boolean(snapshot.complete);
    this.hiddenDoctrineByPlayer = stableClone(snapshot.hiddenDoctrineByPlayer);
  }

  assertKnownPlayer(playerId) {
    if (!this.playerIds.includes(playerId)) throw new Error(`unknown contested RTS player: ${playerId}`);
  }
}

export function replayContestedRts({
  sessionId,
  playerIds = ['floorborn-001', 'peer-001'],
  receipts,
}) {
  const game = new ContestedRtsSession({ sessionId, playerIds });
  for (const expected of receipts) {
    const observation = game.observe(expected.playerId);
    if (digest(observation) !== expected.observationDigest) {
      throw new Error(`contested RTS replay observation mismatch at turn ${expected.turn}`);
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
      throw new Error(`contested RTS replay state/budget mismatch at turn ${expected.turn}`);
    }
    if (digest(actual.outcome) !== digest(expected.outcome)) {
      throw new Error(`contested RTS replay outcome mismatch at turn ${expected.turn}`);
    }
  }
  return game.publicState();
}

function freshPlayerState() {
  return {
    budgetRemaining: RTS_EFFECTIVE_ACTIONS_PER_WINDOW,
    yielded: false,
    centerScouted: false,
    controlPoints: 0,
    groups: {
      scout: { role: 'scout', position: 'base', integrity: 1, fortification: 0 },
      'army-alpha': { role: 'combat', position: 'base', integrity: 2, fortification: 0 },
      'army-beta': { role: 'combat', position: 'base', integrity: 2, fortification: 0 },
    },
  };
}

function groupsView(groups) {
  return Object.entries(groups).map(([id, group]) => ({ id, ...stableClone(group) }));
}

function centerCombatIds(player) {
  return Object.entries(player.groups)
    .filter(([, group]) => group.role === 'combat' && isAliveAt(group, 'center'))
    .map(([id]) => id)
    .sort();
}

function visibleEnemyContacts(self, opponent) {
  if (!self.centerScouted && centerCombatIds(self).length === 0) return [];
  return centerCombatIds(opponent).map((groupId) => ({
    groupId,
    region: 'center',
    classification: 'combat-contact',
    integrity: opponent.groups[groupId].integrity,
    fortified: opponent.groups[groupId].fortification > 0,
  }));
}

function isAliveAt(group, position) {
  return group.integrity > 0 && group.position === position;
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
