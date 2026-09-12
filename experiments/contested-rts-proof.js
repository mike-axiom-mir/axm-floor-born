import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import {
  ContestedRtsSession,
  replayContestedRts,
} from '../src/contested-rts.js';

const game = new ContestedRtsSession({
  sessionId: 'v10-contested-rts-proof',
  playerIds: ['floorborn-001', 'pressure-peer-001'],
});
const floorborn = new FloorbornPlayer({
  playerId: 'floorborn-001',
  lineageId: 'v10-contested-rts-root',
});

const floorDecisions = [];
let guard = 0;
while (!game.isComplete() && guard < 80) {
  guard += 1;
  const playerId = game.activePlayerId();
  let action;

  if (playerId === 'floorborn-001') {
    const observation = game.observe(playerId);
    action = floorborn.decide(observation);
    floorDecisions.push({
      turn: observation.turn,
      windowIndex: observation.rts.windowIndex,
      actionId: action.id,
      decision: structuredClone(floorborn.lastDecision),
    });
  } else {
    action = pressureAction(game, playerId);
  }

  const receipt = game.step(playerId, action);
  if (playerId === 'floorborn-001') floorborn.learn(receipt);
}

assert.ok(guard < 80);
assert.equal(game.isComplete(), true);

const replayed = replayContestedRts({
  sessionId: 'v10-contested-rts-proof',
  playerIds: ['floorborn-001', 'pressure-peer-001'],
  receipts: game.receipts,
});
assert.deepEqual(replayed, game.publicState());

const events = game.receipts.map((receipt) => receipt.outcome.eventId);
const floorReceipts = game.receipts.filter((receipt) => receipt.playerId === 'floorborn-001');
const peerReceipts = game.receipts.filter((receipt) => receipt.playerId === 'pressure-peer-001');
const floorSpent = floorReceipts.reduce((sum, receipt) => sum + receipt.effectiveCost, 0);
const peerSpent = peerReceipts.reduce((sum, receipt) => sum + receipt.effectiveCost, 0);

const metrics = {
  floorborn: actionMetrics(floorReceipts),
  peer: actionMetrics(peerReceipts),
};

assert.ok(metrics.floorborn.attacks >= 1);
assert.ok(events.some((eventId) => eventId.startsWith('damaged:') || eventId.startsWith('destroyed:')));

console.log(JSON.stringify({
  gate: 'AXM Floorborn v0.10 contested RTS encounter',
  status: 'PASS',
  boundary: {
    effectiveApmPerPlayer: 24,
    independentBudgets: true,
    playerSpecificFog: true,
  },
  result: {
    winnerPlayerId: game.publicState().winnerPlayerId,
    controlPoints: Object.fromEntries(
      Object.entries(game.publicState().players).map(([playerId, state]) => [playerId, state.controlPoints]),
    ),
    windowsResolved: game.publicState().controlLog.length,
  },
  agencySpent: {
    floorborn: floorSpent,
    peer: peerSpent,
  },
  actionMetrics: metrics,
  floorbornActions: floorDecisions.map((entry) => ({
    turn: entry.turn,
    windowIndex: entry.windowIndex,
    actionId: entry.actionId,
    selectedEvidence: entry.decision.proposals.find(
      (proposal) => proposal.actionId === entry.actionId,
    )?.evidence ?? [],
  })),
  combatEvents: events.filter((eventId) => (
    eventId.startsWith('damaged:')
    || eventId.startsWith('destroyed:')
    || eventId.startsWith('fortification-hit:')
    || eventId.startsWith('retreated:')
    || eventId.startsWith('fortified:')
  )),
  controlLog: game.publicState().controlLog,
  finalGroups: Object.fromEntries(
    Object.entries(game.publicState().players).map(([playerId, state]) => [playerId, state.groups]),
  ),
  replay: 'PASS',
}, null, 2));

function pressureAction(session, playerId) {
  const observation = session.observe(playerId);
  const legal = observation.legalActions;
  return legal.find((action) => action.id.startsWith('command:attack:'))
    ?? legal.find((action) => action.id === 'command:move:army-alpha:center')
    ?? legal.find((action) => action.id === 'command:move:army-beta:center')
    ?? legal.find((action) => action.id.startsWith('command:fortify:'))
    ?? legal.find((action) => action.id === 'command:scout:center')
    ?? legal.find((action) => action.id === 'wait:yield-window')
    ?? legal[0];
}

function actionMetrics(receipts) {
  const result = {
    attacks: 0,
    fortifies: 0,
    retreats: 0,
    moves: 0,
    scouts: 0,
    yields: 0,
  };
  for (const receipt of receipts) {
    const id = receipt.action.id;
    if (id.startsWith('command:attack:')) result.attacks += 1;
    else if (id.startsWith('command:fortify:')) result.fortifies += 1;
    else if (id.startsWith('command:retreat:')) result.retreats += 1;
    else if (id.startsWith('command:move:')) result.moves += 1;
    else if (id === 'command:scout:center') result.scouts += 1;
    else if (id === 'wait:yield-window') result.yields += 1;
  }
  return result;
}
