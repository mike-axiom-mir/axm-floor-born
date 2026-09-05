import { StateGroundedRecoveryPlayer } from './state-grounded-recovery-player.js';
import {
  replayStateRecoveryContestedRts,
  StateRecoveryContestedRtsSession,
} from './state-recovery-contested-rts.js';
import { ingestVisibleConsequences } from './visible-consequence.js';
import { stableClone } from './stable.js';

export const LIVE_CONTESTED_FLOORBORN_ID = 'floorborn-001';
export const LIVE_CONTESTED_CHAT_ID = 'chat-001';

export function createLiveContestedRts({
  sessionId,
  floorbornSnapshot = null,
} = {}) {
  if (!sessionId) throw new Error('sessionId is required');

  const floorborn = floorbornSnapshot
    ? StateGroundedRecoveryPlayer.restore(floorbornSnapshot)
    : new StateGroundedRecoveryPlayer({
      playerId: LIVE_CONTESTED_FLOORBORN_ID,
      lineageId: 'floorborn-live-contested-rts-root',
    });

  const game = new StateRecoveryContestedRtsSession({
    sessionId,
    playerIds: [LIVE_CONTESTED_FLOORBORN_ID, LIVE_CONTESTED_CHAT_ID],
  });

  return advanceFloorborn(serializeLive(sessionId, floorborn, game, [], []));
}

export function applyLiveContestedChatAction(liveSnapshot, actionId) {
  const { game, floorborn } = restoreLive(liveSnapshot);
  if (game.isComplete()) throw new Error('live contested RTS session is already complete');
  if (game.activePlayerId() !== LIVE_CONTESTED_CHAT_ID) {
    throw new Error('it is not the chat contested RTS command opportunity');
  }

  const observation = game.observe(LIVE_CONTESTED_CHAT_ID);
  const action = observation.legalActions.find((candidate) => candidate.id === actionId);
  if (!action) throw new Error(`chat selected illegal contested RTS action id: ${actionId}`);

  const receipt = game.step(LIVE_CONTESTED_CHAT_ID, action);
  const transcript = [...liveSnapshot.transcript, summarize('chat', receipt)];
  const updated = serializeLive(
    liveSnapshot.sessionId,
    floorborn,
    game,
    transcript,
    liveSnapshot.floorbornDecisionReceipts,
  );
  return advanceFloorborn(updated);
}

export function liveContestedRtsView(liveSnapshot) {
  const { game } = restoreLive(liveSnapshot);
  return stableClone({
    complete: game.isComplete(),
    chatObservation: !game.isComplete() && game.activePlayerId() === LIVE_CONTESTED_CHAT_ID
      ? game.observe(LIVE_CONTESTED_CHAT_ID)
      : null,
    transcript: liveSnapshot.transcript,
  });
}

export function revealCompletedLiveContestedRts(liveSnapshot) {
  const { game, floorborn } = restoreLive(liveSnapshot);
  if (!game.isComplete()) throw new Error('live contested RTS session is not complete');

  const replayed = replayStateRecoveryContestedRts({
    sessionId: liveSnapshot.sessionId,
    playerIds: [LIVE_CONTESTED_FLOORBORN_ID, LIVE_CONTESTED_CHAT_ID],
    receipts: game.receipts,
  });

  return stableClone({
    sessionId: liveSnapshot.sessionId,
    publicState: game.publicState(),
    receipts: game.receipts,
    transcript: liveSnapshot.transcript,
    floorborn: floorborn.snapshot(),
    floorbornDecisionReceipts: liveSnapshot.floorbornDecisionReceipts,
    replayedPublicState: replayed,
  });
}

export function verifyLiveContestedRts(liveSnapshot) {
  const completed = revealCompletedLiveContestedRts(liveSnapshot);
  return JSON.stringify(completed.replayedPublicState) === JSON.stringify(completed.publicState);
}

function advanceFloorborn(liveSnapshot) {
  const { game, floorborn } = restoreLive(liveSnapshot);
  const transcript = [...liveSnapshot.transcript];
  const decisions = [...liveSnapshot.floorbornDecisionReceipts];
  let guard = 0;

  while (!game.isComplete() && game.activePlayerId() === LIVE_CONTESTED_FLOORBORN_ID) {
    guard += 1;
    if (guard > 12) throw new Error('Floorborn live contested RTS advance guard exceeded');

    const observation = game.observe(LIVE_CONTESTED_FLOORBORN_ID);
    const ingested = ingestVisibleConsequences(floorborn, observation);
    const action = floorborn.decide(observation);
    const decision = stableClone(floorborn.lastDecision);
    const receipt = game.step(LIVE_CONTESTED_FLOORBORN_ID, action);
    floorborn.learn(receipt);

    decisions.push({
      turn: receipt.turn,
      windowIndex: receipt.windowIndex,
      observationDigest: receipt.observationDigest,
      ingestedConsequences: ingested,
      decision,
      actionId: action.id,
      outcomeEventId: receipt.outcome.eventId,
    });
    transcript.push(summarize('floorborn', receipt));
  }

  if (game.isComplete()) {
    floorborn.markSessionComplete(liveSnapshot.sessionId, {
      turn: game.turn,
      windowIndex: game.windowIndex,
    });
  }

  return serializeLive(liveSnapshot.sessionId, floorborn, game, transcript, decisions);
}

function restoreLive(snapshot) {
  if (!snapshot || snapshot.schema !== 'axm.floorborn.live-contested-rts.v0.1') {
    throw new Error('unsupported live contested RTS snapshot');
  }

  const floorborn = StateGroundedRecoveryPlayer.restore(snapshot.floorborn);
  const game = new StateRecoveryContestedRtsSession({
    sessionId: snapshot.sessionId,
    playerIds: [LIVE_CONTESTED_FLOORBORN_ID, LIVE_CONTESTED_CHAT_ID],
    snapshot: snapshot.game,
  });
  return { floorborn, game };
}

function serializeLive(sessionId, floorborn, game, transcript, floorbornDecisionReceipts) {
  return stableClone({
    schema: 'axm.floorborn.live-contested-rts.v0.1',
    sessionId,
    floorborn: floorborn.snapshot(),
    game: game.snapshot(),
    transcript,
    floorbornDecisionReceipts,
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
