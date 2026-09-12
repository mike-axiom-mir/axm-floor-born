import { StateGroundedRecoveryPlayer } from './state-grounded-recovery-player.js';
import { StateRecoveryContestedRtsSession } from './state-recovery-contested-rts.js';
import { ingestVisibleConsequences } from './visible-consequence.js';
import { digest, stableClone, stableStringify } from './stable.js';

export const LIVE_CONTESTED_SNAPSHOT_SCHEMA = 'axm.floorborn.live-contested-rts.v0.2';
export const LIVE_CONTESTED_LEGACY_SCHEMA = 'axm.floorborn.live-contested-rts.v0.1';
export const LIVE_CONTESTED_FLOORBORN_ID = 'floorborn-001';
export const LIVE_CONTESTED_CHAT_ID = 'chat-001';

const REPLAY_ANCHOR_SCHEMA = 'axm.floorborn.live-contested-rts.replay-anchor.v0.1';
const INTEGRITY_SCHEMA = 'axm.floorborn.live-contested-rts.integrity.v0.1';
const VALIDATION_SCHEMA = 'axm.floorborn.live-contested-rts.validation.v0.1';
const PLAYER_IDS = [LIVE_CONTESTED_FLOORBORN_ID, LIVE_CONTESTED_CHAT_ID];

export function createLiveContestedReplayAnchor({ sessionId, floorborn, game }) {
  if (game.receipts.length !== 0) {
    throw new Error('session-origin replay anchor requires an unadvanced game');
  }
  return stableClone({
    schema: REPLAY_ANCHOR_SCHEMA,
    kind: 'session-origin',
    receiptIndex: 0,
    transcriptLength: 0,
    floorbornDecisionReceiptLength: 0,
    floorborn: floorborn.snapshot(),
    game: game.snapshot(),
    sessionId,
  });
}

export function sealLiveContestedSnapshot({
  sessionId,
  floorborn,
  game,
  transcript,
  floorbornDecisionReceipts,
  replayAnchor,
}) {
  const payload = stableClone({
    sessionId,
    floorborn: floorborn.snapshot(),
    game: game.snapshot(),
    transcript,
    floorbornDecisionReceipts,
    replayAnchor,
  });
  return sealPayload(payload);
}

export function migrateLiveContestedSnapshot(snapshot) {
  if (snapshot?.schema === LIVE_CONTESTED_SNAPSHOT_SCHEMA) {
    validateV2(snapshot);
    return stableClone(snapshot);
  }
  if (snapshot?.schema !== LIVE_CONTESTED_LEGACY_SCHEMA) {
    throw new Error('unsupported live contested RTS snapshot');
  }

  const normalized = normalizeLegacyPayload(snapshot);
  assertGameAndHistory(normalized);
  const replayAnchor = stableClone({
    schema: REPLAY_ANCHOR_SCHEMA,
    kind: 'legacy-v0.1-import',
    receiptIndex: normalized.game.receipts.length,
    transcriptLength: normalized.transcript.length,
    floorbornDecisionReceiptLength: normalized.floorbornDecisionReceipts.length,
    floorborn: normalized.floorborn,
    game: normalized.game,
    sessionId: normalized.sessionId,
  });
  const migrated = sealPayload({ ...normalized, replayAnchor });
  validateV2(migrated);
  return migrated;
}

export function inspectLiveContestedSnapshot(snapshot) {
  const normalized = migrateLiveContestedSnapshot(snapshot);
  return stableClone({
    schema: VALIDATION_SCHEMA,
    valid: true,
    sourceSchema: snapshot.schema,
    currentSchema: normalized.schema,
    migrated: snapshot.schema === LIVE_CONTESTED_LEGACY_SCHEMA,
    sessionId: normalized.sessionId,
    replayAnchorKind: normalized.replayAnchor.kind,
    verifiedFromReceiptIndex: normalized.replayAnchor.receiptIndex,
    receiptCount: normalized.game.receipts.length,
    transcriptCount: normalized.transcript.length,
    floorbornDecisionReceiptCount: normalized.floorbornDecisionReceipts.length,
    integritySchema: normalized.integrity.schema,
    algorithm: normalized.integrity.algorithm,
    canonicalStateDigest: normalized.integrity.canonicalStateDigest,
    retainedHistoryDigest: normalized.integrity.retainedHistoryDigest,
    replayAnchorDigest: normalized.integrity.replayAnchorDigest,
    snapshotDigest: normalized.integrity.snapshotDigest,
  });
}

export function summarizeLiveContestedReceipt(receipt) {
  return stableClone({
    actor: receipt.playerId === LIVE_CONTESTED_FLOORBORN_ID ? 'floorborn' : 'chat',
    playerId: receipt.playerId,
    turn: receipt.turn,
    windowIndex: receipt.windowIndex,
    actionId: receipt.action.id,
    effectiveCost: receipt.effectiveCost,
    budgetBefore: receipt.budgetBefore,
    budgetAfter: receipt.budgetAfter,
    eventId: receipt.outcome.eventId,
    description: receipt.outcome.description,
  });
}

function validateV2(snapshot) {
  assertObject(snapshot, 'snapshot');
  const payload = stableClone({
    sessionId: snapshot.sessionId,
    floorborn: snapshot.floorborn,
    game: snapshot.game,
    transcript: snapshot.transcript,
    floorbornDecisionReceipts: snapshot.floorbornDecisionReceipts,
    replayAnchor: snapshot.replayAnchor,
  });
  const expected = sealPayload(payload);
  if (stableStringify(expected) !== stableStringify(snapshot)) {
    throw new Error('live contested RTS snapshot integrity or shape mismatch');
  }
  assertGameAndHistory(payload);
  assertReplayAnchor(payload);
  replayFromAnchor(payload);
}

function normalizeLegacyPayload(snapshot) {
  assertObject(snapshot, 'legacy snapshot');
  assertExactKeys(snapshot, [
    'schema',
    'sessionId',
    'floorborn',
    'game',
    'transcript',
    'floorbornDecisionReceipts',
  ], 'legacy snapshot');
  if (typeof snapshot.sessionId !== 'string' || snapshot.sessionId.length === 0) {
    throw new Error('live contested RTS snapshot sessionId is required');
  }
  if (!Array.isArray(snapshot.transcript) || !Array.isArray(snapshot.floorbornDecisionReceipts)) {
    throw new Error('live contested RTS retained history must be arrays');
  }
  const floorborn = StateGroundedRecoveryPlayer.restore(snapshot.floorborn);
  assertFloorbornIdentity(floorborn);
  const game = restoreGame(snapshot.sessionId, snapshot.game);
  return stableClone({
    sessionId: snapshot.sessionId,
    floorborn: floorborn.snapshot(),
    game: game.snapshot(),
    transcript: snapshot.transcript,
    floorbornDecisionReceipts: snapshot.floorbornDecisionReceipts,
  });
}

function sealPayload(payload) {
  const canonicalState = canonicalStateOf(payload);
  const retainedHistory = retainedHistoryOf(payload);
  const integrity = {
    schema: INTEGRITY_SCHEMA,
    algorithm: 'sha256',
    canonicalStateDigest: digest(canonicalState),
    retainedHistoryDigest: digest(retainedHistory),
    replayAnchorDigest: digest(payload.replayAnchor),
  };
  integrity.snapshotDigest = digest(integrity);
  return stableClone({
    schema: LIVE_CONTESTED_SNAPSHOT_SCHEMA,
    ...payload,
    integrity,
  });
}

function canonicalStateOf(payload) {
  const game = stableClone(payload.game);
  delete game.receipts;
  return {
    sessionId: payload.sessionId,
    floorborn: payload.floorborn,
    game,
  };
}

function retainedHistoryOf(payload) {
  return {
    gameReceipts: payload.game?.receipts,
    transcript: payload.transcript,
    floorbornDecisionReceipts: payload.floorbornDecisionReceipts,
  };
}

function assertGameAndHistory(payload) {
  if (typeof payload.sessionId !== 'string' || payload.sessionId.length === 0) {
    throw new Error('live contested RTS snapshot sessionId is required');
  }
  if (!Array.isArray(payload.transcript) || !Array.isArray(payload.floorbornDecisionReceipts)) {
    throw new Error('live contested RTS retained history must be arrays');
  }

  const floorborn = StateGroundedRecoveryPlayer.restore(payload.floorborn);
  assertFloorbornIdentity(floorborn);
  if (stableStringify(floorborn.snapshot()) !== stableStringify(payload.floorborn)) {
    throw new Error('live contested RTS Floorborn state is not canonical');
  }

  const restored = restoreGame(payload.sessionId, payload.game);
  if (stableStringify(restored.snapshot()) !== stableStringify(payload.game)) {
    throw new Error('live contested RTS game state is not canonical');
  }
  if (!Array.isArray(payload.game.receipts)) {
    throw new Error('live contested RTS game receipts must be an array');
  }

  const replayed = replayReceiptPrefix(payload.sessionId, payload.game.receipts, payload.game.receipts.length);
  assertExact('game state does not match canonical receipt replay', replayed.snapshot(), payload.game);

  const expectedTranscript = payload.game.receipts.map(summarizeLiveContestedReceipt);
  assertExact('transcript does not match canonical game receipts', payload.transcript, expectedTranscript);
  assertDecisionReceiptLinks(payload.game.receipts, payload.floorbornDecisionReceipts);
}

function assertReplayAnchor(payload) {
  const anchor = payload.replayAnchor;
  assertObject(anchor, 'replay anchor');
  if (anchor.schema !== REPLAY_ANCHOR_SCHEMA) throw new Error('unsupported replay anchor');
  if (!['session-origin', 'legacy-v0.1-import'].includes(anchor.kind)) {
    throw new Error('unsupported replay anchor kind');
  }
  if (anchor.sessionId !== payload.sessionId) throw new Error('replay anchor session mismatch');
  for (const field of ['receiptIndex', 'transcriptLength', 'floorbornDecisionReceiptLength']) {
    if (!Number.isInteger(anchor[field]) || anchor[field] < 0) {
      throw new Error(`replay anchor ${field} must be a non-negative integer`);
    }
  }
  if (anchor.receiptIndex > payload.game.receipts.length) {
    throw new Error('replay anchor is ahead of retained receipts');
  }
  if (anchor.transcriptLength !== anchor.receiptIndex) {
    throw new Error('replay anchor transcript boundary mismatch');
  }
  const prefixReceipts = payload.game.receipts.slice(0, anchor.receiptIndex);
  const floorbornPrefixCount = prefixReceipts.filter(
    (receipt) => receipt.playerId === LIVE_CONTESTED_FLOORBORN_ID,
  ).length;
  if (anchor.floorbornDecisionReceiptLength !== floorbornPrefixCount) {
    throw new Error('replay anchor Floorborn decision boundary mismatch');
  }
  if (anchor.kind === 'session-origin' && anchor.receiptIndex !== 0) {
    throw new Error('session-origin replay anchor must start before receipt zero');
  }

  const anchorFloorborn = StateGroundedRecoveryPlayer.restore(anchor.floorborn);
  assertFloorbornIdentity(anchorFloorborn);
  assertExact('replay anchor Floorborn state is not canonical', anchorFloorborn.snapshot(), anchor.floorborn);
  const expectedAnchorGame = replayReceiptPrefix(payload.sessionId, prefixReceipts, prefixReceipts.length);
  assertExact('replay anchor game does not match its receipt boundary', anchor.game, expectedAnchorGame.snapshot());
}

function replayFromAnchor(payload) {
  const anchor = payload.replayAnchor;
  const game = restoreGame(payload.sessionId, anchor.game);
  const floorborn = StateGroundedRecoveryPlayer.restore(anchor.floorborn);
  let decisionIndex = anchor.floorbornDecisionReceiptLength;

  for (let index = anchor.receiptIndex; index < payload.game.receipts.length; index += 1) {
    const expectedReceipt = payload.game.receipts[index];
    let ingested = null;
    let decision = null;
    let action = expectedReceipt.action;

    if (expectedReceipt.playerId === LIVE_CONTESTED_FLOORBORN_ID) {
      const observation = game.observe(LIVE_CONTESTED_FLOORBORN_ID);
      ingested = ingestVisibleConsequences(floorborn, observation);
      action = floorborn.decide(observation);
      decision = stableClone(floorborn.lastDecision);
      assertExact(`Floorborn action diverged at receipt ${index}`, action, expectedReceipt.action);
    }

    const actualReceipt = game.step(expectedReceipt.playerId, action);
    assertExact(`game receipt replay diverged at receipt ${index}`, actualReceipt, expectedReceipt);

    if (expectedReceipt.playerId === LIVE_CONTESTED_FLOORBORN_ID) {
      floorborn.learn(actualReceipt);
      const actualDecisionReceipt = makeDecisionReceipt(actualReceipt, ingested, decision, action);
      assertExact(
        `Floorborn decision replay diverged at decision ${decisionIndex}`,
        actualDecisionReceipt,
        payload.floorbornDecisionReceipts[decisionIndex],
      );
      decisionIndex += 1;
    }
  }

  if (game.isComplete()) {
    floorborn.markSessionComplete(payload.sessionId, {
      turn: game.turn,
      windowIndex: game.windowIndex,
    });
  }
  assertExact('resumed game state diverged from replay anchor', game.snapshot(), payload.game);
  assertExact('resumed Floorborn state diverged from replay anchor', floorborn.snapshot(), payload.floorborn);
  if (decisionIndex !== payload.floorbornDecisionReceipts.length) {
    throw new Error('replay did not consume every Floorborn decision receipt');
  }
}

function replayReceiptPrefix(sessionId, receipts, length) {
  const game = new StateRecoveryContestedRtsSession({ sessionId, playerIds: PLAYER_IDS });
  for (let index = 0; index < length; index += 1) {
    const expected = receipts[index];
    const actual = game.step(expected.playerId, expected.action);
    assertExact(`canonical game replay diverged at receipt ${index}`, actual, expected);
  }
  return game;
}

function assertDecisionReceiptLinks(gameReceipts, decisionReceipts) {
  const floorbornReceipts = gameReceipts.filter(
    (receipt) => receipt.playerId === LIVE_CONTESTED_FLOORBORN_ID,
  );
  if (decisionReceipts.length !== floorbornReceipts.length) {
    throw new Error('Floorborn decision receipt count does not match game history');
  }
  for (let index = 0; index < floorbornReceipts.length; index += 1) {
    const gameReceipt = floorbornReceipts[index];
    const decisionReceipt = decisionReceipts[index];
    assertObject(decisionReceipt, `Floorborn decision receipt ${index}`);
    const expectedLink = {
      turn: gameReceipt.turn,
      windowIndex: gameReceipt.windowIndex,
      observationDigest: gameReceipt.observationDigest,
      actionId: gameReceipt.action.id,
      outcomeEventId: gameReceipt.outcome.eventId,
    };
    const actualLink = Object.fromEntries(Object.keys(expectedLink).map(
      (key) => [key, decisionReceipt[key]],
    ));
    assertExact(`Floorborn decision receipt ${index} is not linked to game history`, actualLink, expectedLink);
    if (decisionReceipt.decision?.selectedActionId !== decisionReceipt.actionId) {
      throw new Error(`Floorborn decision receipt ${index} selected action mismatch`);
    }
    if (decisionReceipt.decision?.turn !== decisionReceipt.turn) {
      throw new Error(`Floorborn decision receipt ${index} turn mismatch`);
    }
    if (!Array.isArray(decisionReceipt.ingestedConsequences)) {
      throw new Error(`Floorborn decision receipt ${index} consequences must be an array`);
    }
  }
}

export function makeLiveContestedDecisionReceipt(receipt, ingested, decision, action) {
  return makeDecisionReceipt(receipt, ingested, decision, action);
}

function makeDecisionReceipt(receipt, ingested, decision, action) {
  return stableClone({
    turn: receipt.turn,
    windowIndex: receipt.windowIndex,
    observationDigest: receipt.observationDigest,
    ingestedConsequences: ingested,
    decision,
    actionId: action.id,
    outcomeEventId: receipt.outcome.eventId,
  });
}

function restoreGame(sessionId, snapshot) {
  return new StateRecoveryContestedRtsSession({
    sessionId,
    playerIds: PLAYER_IDS,
    snapshot,
  });
}

function assertFloorbornIdentity(floorborn) {
  if (floorborn.playerId !== LIVE_CONTESTED_FLOORBORN_ID) {
    throw new Error('live contested RTS snapshot Floorborn identity mismatch');
  }
}

function assertExact(message, actual, expected) {
  if (stableStringify(actual) !== stableStringify(expected)) throw new Error(message);
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (stableStringify(actual) !== stableStringify(wanted)) {
    throw new Error(`${label} shape mismatch`);
  }
}
