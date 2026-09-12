import { FloorbornPlayer } from './floorborn.js';
import { SharedRtsSession } from './shared-rts.js';
import { stableClone } from './stable.js';

export const LIVE_SHARED_RTS_FLOORBORN_ID = 'floorborn-001';
export const LIVE_SHARED_RTS_CHAT_ID = 'chat-001';

export function createLiveSharedRts({
  sessionId,
  floorbornSnapshot = null,
} = {}) {
  if (!sessionId) throw new Error('sessionId is required');

  const floorborn = floorbornSnapshot
    ? FloorbornPlayer.restore(floorbornSnapshot)
    : new FloorbornPlayer({
      playerId: LIVE_SHARED_RTS_FLOORBORN_ID,
      lineageId: 'floorborn-shared-rts-live-root',
    });

  const game = new SharedRtsSession({
    sessionId,
    playerIds: [LIVE_SHARED_RTS_FLOORBORN_ID, LIVE_SHARED_RTS_CHAT_ID],
  });

  const live = serializeLive(sessionId, floorborn, game, []);
  return advanceSharedRtsFloorborn(live);
}

export function applySharedRtsChatAction(liveSnapshot, actionId) {
  const { game, floorborn } = restoreLive(liveSnapshot);
  if (game.isComplete()) throw new Error('live shared RTS session is already complete');
  if (game.activePlayerId() !== LIVE_SHARED_RTS_CHAT_ID) throw new Error('it is not the chat RTS command opportunity');

  const observation = game.observe(LIVE_SHARED_RTS_CHAT_ID);
  const action = observation.legalActions.find((candidate) => candidate.id === actionId);
  if (!action) throw new Error(`chat selected illegal RTS action id: ${actionId}`);

  const receipt = game.step(LIVE_SHARED_RTS_CHAT_ID, action);
  const transcript = [...liveSnapshot.transcript, summarize('chat', receipt)];
  const updated = serializeLive(liveSnapshot.sessionId, floorborn, game, transcript);
  return advanceSharedRtsFloorborn(updated);
}

export function liveSharedRtsView(liveSnapshot) {
  const { game } = restoreLive(liveSnapshot);
  return stableClone({
    complete: game.isComplete(),
    chatObservation: !game.isComplete() && game.activePlayerId() === LIVE_SHARED_RTS_CHAT_ID
      ? game.observe(LIVE_SHARED_RTS_CHAT_ID)
      : null,
    transcript: liveSnapshot.transcript,
  });
}

export function revealCompletedSharedRts(liveSnapshot) {
  const { game } = restoreLive(liveSnapshot);
  if (!game.isComplete()) throw new Error('shared RTS session is not complete');
  return stableClone({
    sessionId: liveSnapshot.sessionId,
    publicState: game.publicState(),
    receipts: game.receipts,
    floorborn: liveSnapshot.floorborn,
    transcript: liveSnapshot.transcript,
  });
}

export function advanceSharedRtsFloorborn(liveSnapshot) {
  const { game, floorborn } = restoreLive(liveSnapshot);
  const transcript = [...liveSnapshot.transcript];
  let guard = 0;

  while (!game.isComplete() && game.activePlayerId() === LIVE_SHARED_RTS_FLOORBORN_ID) {
    guard += 1;
    if (guard > 8) throw new Error('Floorborn shared RTS advance guard exceeded');

    const observation = game.observe(LIVE_SHARED_RTS_FLOORBORN_ID);
    const action = floorborn.decide(observation);
    const decision = stableClone(floorborn.lastDecision);
    const receipt = game.step(LIVE_SHARED_RTS_FLOORBORN_ID, action);
    floorborn.learn(receipt);
    transcript.push({
      ...summarize('floorborn', receipt),
      decision,
    });
  }

  if (game.isComplete()) floorborn.markSessionComplete(liveSnapshot.sessionId);
  return serializeLive(liveSnapshot.sessionId, floorborn, game, transcript);
}

function restoreLive(snapshot) {
  if (!snapshot || snapshot.schema !== 'axm.floorborn.live-shared-rts.v0.1') {
    throw new Error('unsupported live shared RTS snapshot');
  }

  const floorborn = FloorbornPlayer.restore(snapshot.floorborn);
  const game = new SharedRtsSession({
    sessionId: snapshot.sessionId,
    playerIds: [LIVE_SHARED_RTS_FLOORBORN_ID, LIVE_SHARED_RTS_CHAT_ID],
    snapshot: snapshot.game,
  });
  return { floorborn, game };
}

function serializeLive(sessionId, floorborn, game, transcript) {
  return stableClone({
    schema: 'axm.floorborn.live-shared-rts.v0.1',
    sessionId,
    floorborn: floorborn.snapshot(),
    game: game.snapshot(),
    transcript,
  });
}

function summarize(actor, receipt) {
  return {
    actor,
    playerId: receipt.playerId,
    turn: receipt.turn,
    windowIndex: receipt.windowIndex,
    actionId: receipt.action.id,
    effectiveCost: receipt.effectiveCost,
    budgetBefore: receipt.budgetBefore,
    budgetAfter: receipt.budgetAfter,
    eventId: receipt.outcome.eventId,
    description: receipt.outcome.description,
  };
}
