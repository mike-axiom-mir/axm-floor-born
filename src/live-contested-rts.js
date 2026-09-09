import { StateGroundedRecoveryPlayer } from './state-grounded-recovery-player.js';
import {
  replayStateRecoveryContestedRts,
  StateRecoveryContestedRtsSession,
} from './state-recovery-contested-rts.js';
import { ingestVisibleConsequences } from './visible-consequence.js';
import { stableClone } from './stable.js';
import {
  createLiveContestedReplayAnchor,
  LIVE_CONTESTED_CHAT_ID,
  LIVE_CONTESTED_FLOORBORN_ID,
  makeLiveContestedDecisionReceipt,
  migrateLiveContestedSnapshot,
  sealLiveContestedSnapshot,
  summarizeLiveContestedReceipt,
} from './live-contested-snapshot.js';

export {
  inspectLiveContestedSnapshot,
  LIVE_CONTESTED_CHAT_ID,
  LIVE_CONTESTED_FLOORBORN_ID,
  LIVE_CONTESTED_SNAPSHOT_SCHEMA,
  migrateLiveContestedSnapshot,
} from './live-contested-snapshot.js';

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
  const replayAnchor = createLiveContestedReplayAnchor({ sessionId, floorborn, game });
  return advanceFloorborn(serializeLive(sessionId, floorborn, game, [], [], replayAnchor));
}

export function applyLiveContestedChatAction(liveSnapshot, actionId) {
  const { game, floorborn, snapshot } = restoreLive(liveSnapshot);
  if (game.isComplete()) throw new Error('live contested RTS session is already complete');
  if (game.activePlayerId() !== LIVE_CONTESTED_CHAT_ID) {
    throw new Error('it is not the chat contested RTS command opportunity');
  }

  const observation = game.observe(LIVE_CONTESTED_CHAT_ID);
  const action = observation.legalActions.find((candidate) => candidate.id === actionId);
  if (!action) throw new Error(`chat selected illegal contested RTS action id: ${actionId}`);

  const receipt = game.step(LIVE_CONTESTED_CHAT_ID, action);
  const transcript = [...snapshot.transcript, summarizeLiveContestedReceipt(receipt)];
  if (game.isComplete()) {
    floorborn.markSessionComplete(snapshot.sessionId, {
      turn: game.turn,
      windowIndex: game.windowIndex,
    });
  }
  const updated = serializeLive(
    snapshot.sessionId,
    floorborn,
    game,
    transcript,
    snapshot.floorbornDecisionReceipts,
    snapshot.replayAnchor,
  );
  return advanceFloorborn(updated);
}

export function liveContestedRtsView(liveSnapshot) {
  const { game, snapshot } = restoreLive(liveSnapshot);
  return stableClone({
    complete: game.isComplete(),
    chatObservation: !game.isComplete() && game.activePlayerId() === LIVE_CONTESTED_CHAT_ID
      ? game.observe(LIVE_CONTESTED_CHAT_ID)
      : null,
    transcript: snapshot.transcript,
  });
}

export function revealCompletedLiveContestedRts(liveSnapshot) {
  const { game, floorborn, snapshot } = restoreLive(liveSnapshot);
  if (!game.isComplete()) throw new Error('live contested RTS session is not complete');

  const replayed = replayStateRecoveryContestedRts({
    sessionId: snapshot.sessionId,
    playerIds: [LIVE_CONTESTED_FLOORBORN_ID, LIVE_CONTESTED_CHAT_ID],
    receipts: game.receipts,
  });

  return stableClone({
    sessionId: snapshot.sessionId,
    publicState: game.publicState(),
    receipts: game.receipts,
    transcript: snapshot.transcript,
    floorborn: floorborn.snapshot(),
    floorbornDecisionReceipts: snapshot.floorbornDecisionReceipts,
    replayedPublicState: replayed,
  });
}

export function verifyLiveContestedRts(liveSnapshot) {
  const completed = revealCompletedLiveContestedRts(liveSnapshot);
  return JSON.stringify(completed.replayedPublicState) === JSON.stringify(completed.publicState);
}

function advanceFloorborn(liveSnapshot) {
  const { game, floorborn, snapshot } = restoreLive(liveSnapshot);
  const transcript = [...snapshot.transcript];
  const decisions = [...snapshot.floorbornDecisionReceipts];
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

    decisions.push(makeLiveContestedDecisionReceipt(receipt, ingested, decision, action));
    transcript.push(summarizeLiveContestedReceipt(receipt));
  }

  if (game.isComplete()) {
    floorborn.markSessionComplete(snapshot.sessionId, {
      turn: game.turn,
      windowIndex: game.windowIndex,
    });
  }

  return serializeLive(
    snapshot.sessionId,
    floorborn,
    game,
    transcript,
    decisions,
    snapshot.replayAnchor,
  );
}

function restoreLive(snapshot) {
  const normalized = migrateLiveContestedSnapshot(snapshot);
  const floorborn = StateGroundedRecoveryPlayer.restore(normalized.floorborn);
  const game = new StateRecoveryContestedRtsSession({
    sessionId: normalized.sessionId,
    playerIds: [LIVE_CONTESTED_FLOORBORN_ID, LIVE_CONTESTED_CHAT_ID],
    snapshot: normalized.game,
  });
  return { floorborn, game, snapshot: normalized };
}

function serializeLive(
  sessionId,
  floorborn,
  game,
  transcript,
  floorbornDecisionReceipts,
  replayAnchor,
) {
  return sealLiveContestedSnapshot({
    sessionId,
    floorborn,
    game,
    transcript,
    floorbornDecisionReceipts,
    replayAnchor,
  });
}
