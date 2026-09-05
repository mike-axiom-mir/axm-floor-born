import { freezeObservation } from './protocol.js';
import { ContestedRtsSession } from './contested-rts.js';
import { stableClone, stableStringify } from './stable.js';

export class ConsequenceContestedRtsSession extends ContestedRtsSession {
  constructor(options = {}) {
    super(options);
    if (!this.visibleEventsByPlayer) {
      this.visibleEventsByPlayer = Object.fromEntries(this.playerIds.map((playerId) => [playerId, []]));
    }
  }

  observe(playerId = this.activePlayerId()) {
    const base = stableClone(super.observe(playerId));
    base.rts.recentVisibleEvents = stableClone(this.visibleEventsByPlayer[playerId] ?? []);
    return freezeObservation(base);
  }

  applyAction(playerId, actionTaken) {
    // The current bounded observation has already exposed this inbox before
    // ContestedRtsSession.step calls applyAction. Consuming it here keeps
    // observation pure while ensuring each visible consequence is presented
    // on exactly one committed command opportunity unless the player never acts.
    this.visibleEventsByPlayer[playerId] = [];

    const outcome = super.applyAction(playerId, actionTaken);

    if (actionTaken.id.startsWith('command:attack:')) {
      const targetPlayerId = this.opponentId(playerId);
      const targetGroupId = actionTaken.target;
      const visibleEvent = consequenceFromAttack({
        sessionId: this.sessionId,
        sourcePlayerId: playerId,
        targetPlayerId,
        targetGroupId,
        turn: this.turn,
        outcome,
      });
      if (visibleEvent) this.visibleEventsByPlayer[targetPlayerId].push(visibleEvent);
    }

    return outcome;
  }

  publicState() {
    const base = super.publicState();
    return {
      ...base,
      visibleEventsByPlayer: stableClone(this.visibleEventsByPlayer ?? {}),
    };
  }
}

export function replayConsequenceContestedRts({
  sessionId,
  playerIds = ['floorborn-001', 'peer-001'],
  receipts,
}) {
  const game = new ConsequenceContestedRtsSession({ sessionId, playerIds });
  for (const expected of receipts) {
    const actual = game.step(expected.playerId, expected.action);
    assertReplayField('observationDigest', actual.observationDigest, expected.observationDigest, expected.turn);
    assertReplayField('preStateDigest', actual.preStateDigest, expected.preStateDigest, expected.turn);
    assertReplayField('postStateDigest', actual.postStateDigest, expected.postStateDigest, expected.turn);
    assertReplayField('budgetBefore', actual.budgetBefore, expected.budgetBefore, expected.turn);
    assertReplayField('budgetAfter', actual.budgetAfter, expected.budgetAfter, expected.turn);
    assertReplayField('opponentBudgetBefore', actual.opponentBudgetBefore, expected.opponentBudgetBefore, expected.turn);
    assertReplayField('opponentBudgetAfter', actual.opponentBudgetAfter, expected.opponentBudgetAfter, expected.turn);
    assertReplayField('outcome', stableStringify(actual.outcome), stableStringify(expected.outcome), expected.turn);
  }
  return game.publicState();
}

function assertReplayField(field, actual, expected, turn) {
  if (actual === expected) return;
  throw new Error(
    `consequence RTS replay ${field} mismatch at turn ${turn}: expected ${expected}, actual ${actual}`,
  );
}

function consequenceFromAttack({
  sessionId,
  sourcePlayerId,
  targetPlayerId,
  targetGroupId,
  turn,
  outcome,
}) {
  let kind;
  let utility;
  let tags;

  if (outcome.eventId.startsWith('destroyed:')) {
    kind = 'combat-loss';
    utility = -1.8;
    tags = ['combat', 'incoming-pressure', 'loss'];
  } else if (outcome.eventId.startsWith('damaged:')) {
    kind = 'combat-damage';
    utility = -0.8;
    tags = ['combat', 'damage', 'incoming-pressure'];
  } else if (outcome.eventId.startsWith('fortification-hit:')) {
    kind = 'defense-pressure';
    utility = -0.35;
    tags = ['combat', 'defense-pressure', 'incoming-pressure'];
  } else {
    return null;
  }

  return {
    eventKey: `${sessionId}:${turn}:${sourcePlayerId}:${targetPlayerId}:${outcome.eventId}`,
    eventId: `incoming:${outcome.eventId}`,
    sourcePlayerId,
    kind,
    groupId: targetGroupId,
    utility,
    novelty: 0.5,
    tags,
  };
}
