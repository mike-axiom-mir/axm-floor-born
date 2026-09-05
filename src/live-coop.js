import { FloorbornPlayer } from './floorborn.js';
import { CoopRpgSession } from './coop-rpg.js';
import { stableClone } from './stable.js';

export const LIVE_FLOORBORN_ID = 'floorborn-001';
export const LIVE_CHAT_ID = 'chat-001';

export function createLiveCoop({ sessionId = 'floorborn-chat-live-001', floorbornSnapshot = null } = {}) {
  const floorborn = floorbornSnapshot
    ? FloorbornPlayer.restore(floorbornSnapshot)
    : new FloorbornPlayer({ playerId: LIVE_FLOORBORN_ID, lineageId: 'floorborn-live-root' });
  if (floorborn.playerId !== LIVE_FLOORBORN_ID) throw new Error('live bridge requires floorborn-001 identity');

  const game = new CoopRpgSession({
    sessionId,
    playerIds: [LIVE_FLOORBORN_ID, LIVE_CHAT_ID],
  });

  const live = {
    schema: 'axm.floorborn.live-coop.v0.1',
    sessionId,
    floorborn: floorborn.snapshot(),
    game: game.snapshot(),
    transcript: [],
  };

  return advanceFloorborn(live);
}

export function applyChatAction(liveSnapshot, actionId) {
  const { game, floorborn } = restoreLive(liveSnapshot);
  if (game.isComplete()) throw new Error('live co-op session is already complete');
  if (game.activePlayerId() !== LIVE_CHAT_ID) throw new Error('it is not the chat player turn');

  const observation = game.observe(LIVE_CHAT_ID);
  const action = observation.legalActions.find((candidate) => candidate.id === actionId);
  if (!action) throw new Error(`chat selected illegal action id: ${actionId}`);

  const receipt = game.step(LIVE_CHAT_ID, action);
  const transcript = [...(liveSnapshot.transcript ?? []), summarizeTurn('chat', receipt)];
  const updated = serializeLive(liveSnapshot.sessionId, floorborn, game, transcript);
  return advanceFloorborn(updated);
}

export function liveView(liveSnapshot) {
  const { game } = restoreLive(liveSnapshot);
  return {
    complete: game.isComplete(),
    publicState: game.publicState(),
    chatObservation: !game.isComplete() && game.activePlayerId() === LIVE_CHAT_ID
      ? stableClone(game.observe(LIVE_CHAT_ID))
      : null,
    transcript: stableClone(liveSnapshot.transcript ?? []),
  };
}

export function advanceFloorborn(liveSnapshot) {
  const { game, floorborn } = restoreLive(liveSnapshot);
  const transcript = [...(liveSnapshot.transcript ?? [])];

  while (!game.isComplete() && game.activePlayerId() === LIVE_FLOORBORN_ID) {
    const observation = game.observe(LIVE_FLOORBORN_ID);
    const action = floorborn.decide(observation);
    const decision = stableClone(floorborn.lastDecision);
    const receipt = game.step(LIVE_FLOORBORN_ID, action);
    floorborn.learn(receipt);
    transcript.push({
      ...summarizeTurn('floorborn', receipt),
      decision,
    });
  }

  if (game.isComplete()) floorborn.markSessionComplete(liveSnapshot.sessionId);
  return serializeLive(liveSnapshot.sessionId, floorborn, game, transcript);
}

function restoreLive(liveSnapshot) {
  if (!liveSnapshot || liveSnapshot.schema !== 'axm.floorborn.live-coop.v0.1') {
    throw new Error('unsupported live co-op snapshot');
  }
  const floorborn = FloorbornPlayer.restore(liveSnapshot.floorborn);
  const game = new CoopRpgSession({
    sessionId: liveSnapshot.sessionId,
    playerIds: [LIVE_FLOORBORN_ID, LIVE_CHAT_ID],
    snapshot: liveSnapshot.game,
  });
  return { floorborn, game };
}

function serializeLive(sessionId, floorborn, game, transcript) {
  return stableClone({
    schema: 'axm.floorborn.live-coop.v0.1',
    sessionId,
    floorborn: floorborn.snapshot(),
    game: game.snapshot(),
    transcript,
  });
}

function summarizeTurn(actor, receipt) {
  return {
    actor,
    turn: receipt.turn,
    actionId: receipt.action.id,
    eventId: receipt.outcome.eventId,
    description: receipt.outcome.description,
  };
}
