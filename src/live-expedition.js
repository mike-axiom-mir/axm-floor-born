import { FloorbornPlayer } from './floorborn.js';
import { ExpeditionSession } from './expedition-rpg.js';
import { stableClone } from './stable.js';

export const LIVE_EXPEDITION_FLOORBORN_ID = 'floorborn-001';
export const LIVE_EXPEDITION_CHAT_ID = 'chat-001';

export function createLiveExpedition({ sessionId, seed, floorbornSnapshot = null } = {}) {
  if (!sessionId) throw new Error('sessionId is required');
  if (!Number.isInteger(seed)) throw new Error('seed is required');

  const floorborn = floorbornSnapshot
    ? FloorbornPlayer.restore(floorbornSnapshot)
    : new FloorbornPlayer({
      playerId: LIVE_EXPEDITION_FLOORBORN_ID,
      lineageId: 'floorborn-expedition-live-root',
    });

  const game = new ExpeditionSession({
    sessionId,
    seed,
    playerIds: [LIVE_EXPEDITION_FLOORBORN_ID, LIVE_EXPEDITION_CHAT_ID],
  });

  const live = serializeLive(sessionId, seed, floorborn, game, []);
  return advanceExpeditionFloorborn(live);
}

export function applyExpeditionChatAction(liveSnapshot, actionId) {
  const { game, floorborn } = restoreLive(liveSnapshot);
  if (game.isComplete()) throw new Error('live expedition is already complete');
  if (game.activePlayerId() !== LIVE_EXPEDITION_CHAT_ID) throw new Error('it is not the chat player turn');

  const observation = game.observe(LIVE_EXPEDITION_CHAT_ID);
  const action = observation.legalActions.find((candidate) => candidate.id === actionId);
  if (!action) throw new Error(`chat selected illegal action id: ${actionId}`);

  const receipt = game.step(LIVE_EXPEDITION_CHAT_ID, action);
  const transcript = [...liveSnapshot.transcript, summarize('chat', receipt)];
  const updated = serializeLive(liveSnapshot.sessionId, liveSnapshot.seed, floorborn, game, transcript);
  return advanceExpeditionFloorborn(updated);
}

export function liveExpeditionView(liveSnapshot) {
  const { game } = restoreLive(liveSnapshot);
  return stableClone({
    complete: game.isComplete(),
    chatObservation: !game.isComplete() && game.activePlayerId() === LIVE_EXPEDITION_CHAT_ID
      ? game.observe(LIVE_EXPEDITION_CHAT_ID)
      : null,
    transcript: liveSnapshot.transcript,
  });
}

export function revealCompletedExpedition(liveSnapshot) {
  const { game } = restoreLive(liveSnapshot);
  if (!game.isComplete()) throw new Error('expedition is not complete');
  return stableClone({
    sessionId: liveSnapshot.sessionId,
    seed: liveSnapshot.seed,
    publicState: game.publicState(),
    receipts: game.receipts,
    floorborn: liveSnapshot.floorborn,
    transcript: liveSnapshot.transcript,
  });
}

export function advanceExpeditionFloorborn(liveSnapshot) {
  const { game, floorborn } = restoreLive(liveSnapshot);
  const transcript = [...liveSnapshot.transcript];

  while (!game.isComplete() && game.activePlayerId() === LIVE_EXPEDITION_FLOORBORN_ID) {
    const observation = game.observe(LIVE_EXPEDITION_FLOORBORN_ID);
    const action = floorborn.decide(observation);
    const decision = stableClone(floorborn.lastDecision);
    const receipt = game.step(LIVE_EXPEDITION_FLOORBORN_ID, action);
    floorborn.learn(receipt);
    transcript.push({
      ...summarize('floorborn', receipt),
      decision,
    });
  }

  if (game.isComplete()) floorborn.markSessionComplete(liveSnapshot.sessionId);
  return serializeLive(liveSnapshot.sessionId, liveSnapshot.seed, floorborn, game, transcript);
}

function restoreLive(snapshot) {
  if (!snapshot || snapshot.schema !== 'axm.floorborn.live-expedition.v0.1') {
    throw new Error('unsupported live expedition snapshot');
  }

  const floorborn = FloorbornPlayer.restore(snapshot.floorborn);
  const game = new ExpeditionSession({
    sessionId: snapshot.sessionId,
    seed: snapshot.seed,
    playerIds: [LIVE_EXPEDITION_FLOORBORN_ID, LIVE_EXPEDITION_CHAT_ID],
    snapshot: snapshot.game,
  });
  return { floorborn, game };
}

function serializeLive(sessionId, seed, floorborn, game, transcript) {
  return stableClone({
    schema: 'axm.floorborn.live-expedition.v0.1',
    sessionId,
    seed,
    floorborn: floorborn.snapshot(),
    game: game.snapshot(),
    transcript,
  });
}

function summarize(actor, receipt) {
  return {
    actor,
    turn: receipt.turn,
    actionId: receipt.action.id,
    eventId: receipt.outcome.eventId,
    description: receipt.outcome.description,
  };
}
