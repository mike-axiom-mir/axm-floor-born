import assert from 'node:assert/strict';

import { CampaignLedger } from './campaign-ledger.js';
import { FloorbornPlayer } from './floorborn.js';
import { ExpeditionSession, layoutForSeed, replayExpedition } from './expedition-rpg.js';
import { InterludeSession } from './interlude.js';
import { SignalTrialSession } from './signal-trial.js';
import {
  IntentionOpportunitySession,
  replayIntentionOpportunity,
} from './intention-opportunity.js';
import { digest, stableClone } from './stable.js';

const FLOORBORN_ID = 'floorborn-001';
const FAMILIAR_PEER = 'chat-001';
const STRANGER_PEER = 'chat-new';
const REGION_IDS = ['archive', 'grove', 'quarry', 'marsh'];

export function runCampaignProof({ campaignId = 'floorborn-campaign-v0.7' } = {}) {
  let floorborn = new FloorbornPlayer({
    playerId: FLOORBORN_ID,
    lineageId: 'floorborn-campaign-lineage',
  });
  let ledger = new CampaignLedger({
    campaignId,
    lineageId: floorborn.lineageId,
  });

  const report = {
    campaignId,
    status: 'PASS',
    sessions: [],
    causalLinks: [],
  };

  const start = ledger.checkpoint({
    stage: 'campaign-start',
    sessionId: 'campaign-start',
    kind: 'lineage',
    playerSnapshot: floorborn.snapshot(),
    note: 'Fresh Floorborn lineage before campaign play.',
  });

  const shared = runSharedExpedition({
    player: floorborn,
    sessionId: `${campaignId}-shared`,
    seed: 0,
    peerId: FAMILIAR_PEER,
  });
  const sharedCheckpoint = ledger.checkpoint({
    stage: 'shared-expedition-complete',
    sessionId: shared.game.sessionId,
    kind: 'expedition-shared',
    playerSnapshot: floorborn.snapshot(),
    receipts: shared.game.receipts,
    publicState: shared.game.publicState(),
    note: 'First completed expedition with recurring companion chat-001.',
  });
  report.sessions.push(summary(shared.game, { peerId: FAMILIAR_PEER }));

  const reunion = new InterludeSession({
    sessionId: `${campaignId}-reunion-eval`,
    playerId: FLOORBORN_ID,
    peerId: FAMILIAR_PEER,
  });
  const reunionAction = floorborn.decide(reunion.observe());
  assert.equal(reunionAction.id, 'signal:continue-with-peer');
  const reunionDecision = stableClone(floorborn.lastDecision);
  const reunionCheckpoint = ledger.checkpoint({
    stage: 'reunion-decision',
    sessionId: reunion.sessionId,
    kind: 'decision-evaluation',
    playerSnapshot: floorborn.snapshot(),
    note: `Recurring companion choice: ${reunionAction.id}`,
  });
  const reunionEvidence = proposalEvidence(reunionDecision, reunionAction.id).filter((line) => line.startsWith('companion:'));
  assert.ok(reunionEvidence.length > 0);
  ledger.link({
    fromSequence: sharedCheckpoint.sequence,
    toSequence: reunionCheckpoint.sequence,
    relation: 'shared-companion-history-influenced-reunion-choice',
    evidence: reunionEvidence,
  });

  const stranger = new InterludeSession({
    sessionId: `${campaignId}-stranger`,
    playerId: FLOORBORN_ID,
    peerId: STRANGER_PEER,
  });
  const strangerAction = floorborn.decide(stranger.observe());
  assert.equal(strangerAction.id, 'signal:finish-journey');
  const strangerReceipt = stranger.step(strangerAction);
  floorborn.learn(strangerReceipt);
  floorborn.markSessionComplete(stranger.sessionId);
  const strangerCheckpoint = ledger.checkpoint({
    stage: 'stranger-encounter',
    sessionId: stranger.sessionId,
    kind: 'interlude',
    playerSnapshot: floorborn.snapshot(),
    receipts: stranger.receipts,
    publicState: stranger.publicState(),
    note: `Stranger choice: ${strangerAction.id}`,
  });
  report.sessions.push(summary(stranger, { peerId: STRANGER_PEER, actionId: strangerAction.id }));

  const trapSeed = findAdversarialTrapSeed(floorborn);
  assert.notEqual(trapSeed, null, 'host should find a bounded hidden layout where current Floorborn eventually encounters a trap through its own route');
  const trapRun = runTrapRecoveryExpedition({
    player: floorborn,
    sessionId: `${campaignId}-trap`,
    seed: trapSeed,
    ledger,
  });
  report.sessions.push(summary(trapRun.game, {
    seed: trapSeed,
    trapEvent: trapRun.trapReceipt.outcome.eventId,
    recoveryAction: trapRun.recoveryAction.id,
  }));
  ledger.link({
    fromSequence: trapRun.trapCheckpoint.sequence,
    toSequence: trapRun.recoveryCheckpoint.sequence,
    relation: 'negative-hidden-outcome-influenced-recovery-route',
    evidence: trapRun.recoveryEvidence,
  });

  const supportTrials = trainSignals({
    player: floorborn,
    campaignId,
    phase: 'support',
    peerId: FAMILIAR_PEER,
    peerSignal: 'route-safe',
    actualSafe: true,
    count: 4,
  });
  const supportCheckpoint = ledger.checkpoint({
    stage: 'signal-support-trained',
    sessionId: supportTrials.at(-1).game.sessionId,
    kind: 'signal-training',
    playerSnapshot: floorborn.snapshot(),
    receipts: supportTrials.flatMap((trial) => trial.game.receipts),
    note: 'Four verified supporting route-safe receipts for chat-001.',
  });

  const followEval = evaluateSignal({
    player: floorborn,
    sessionId: `${campaignId}-follow-eval`,
    peerId: FAMILIAR_PEER,
    peerSignal: 'route-safe',
    actualSafe: true,
  });
  assert.equal(followEval.action.id, 'signal:follow-peer');
  const followReceipt = followEval.game.step(followEval.action);
  floorborn.learn(followReceipt);
  floorborn.markSessionComplete(followEval.game.sessionId);
  const followCheckpoint = ledger.checkpoint({
    stage: 'supported-signal-followed',
    sessionId: followEval.game.sessionId,
    kind: 'signal-evaluation',
    playerSnapshot: floorborn.snapshot(),
    receipts: followEval.game.receipts,
    publicState: followEval.game.publicState(),
    note: `Choice after support: ${followEval.action.id}`,
  });
  const followEvidence = proposalEvidence(followEval.decision, 'signal:follow-peer').filter((line) => line.startsWith('signal-evidence:'));
  assert.ok(followEvidence.some((line) => line.includes('+')));
  ledger.link({
    fromSequence: supportCheckpoint.sequence,
    toSequence: followCheckpoint.sequence,
    relation: 'supported-peer-signal-influenced-follow-choice',
    evidence: followEvidence,
  });

  const contradictionTrials = trainSignals({
    player: floorborn,
    campaignId,
    phase: 'contradict',
    peerId: FAMILIAR_PEER,
    peerSignal: 'route-safe',
    actualSafe: false,
    count: 10,
  });
  const contradictionCheckpoint = ledger.checkpoint({
    stage: 'signal-contradictions-trained',
    sessionId: contradictionTrials.at(-1).game.sessionId,
    kind: 'signal-training',
    playerSnapshot: floorborn.snapshot(),
    receipts: contradictionTrials.flatMap((trial) => trial.game.receipts),
    note: 'Later verified contradictions outweigh earlier support.',
  });

  const verifyEval = evaluateSignal({
    player: floorborn,
    sessionId: `${campaignId}-verify-eval`,
    peerId: FAMILIAR_PEER,
    peerSignal: 'route-safe',
    actualSafe: true,
  });
  assert.equal(verifyEval.action.id, 'inspect:verify-current');
  const verifyReceipt = verifyEval.game.step(verifyEval.action);
  floorborn.learn(verifyReceipt);
  floorborn.markSessionComplete(verifyEval.game.sessionId);
  const verifyCheckpoint = ledger.checkpoint({
    stage: 'contradicted-signal-verified',
    sessionId: verifyEval.game.sessionId,
    kind: 'signal-evaluation',
    playerSnapshot: floorborn.snapshot(),
    receipts: verifyEval.game.receipts,
    publicState: verifyEval.game.publicState(),
    note: `Choice after contradictions: ${verifyEval.action.id}`,
  });
  const verifyEvidence = proposalEvidence(verifyEval.decision, 'signal:follow-peer').filter((line) => line.startsWith('signal-evidence:'));
  assert.ok(verifyEvidence.some((line) => line.includes('-')));
  ledger.link({
    fromSequence: contradictionCheckpoint.sequence,
    toSequence: verifyCheckpoint.sequence,
    relation: 'contradictory-peer-evidence-revised-later-choice',
    evidence: verifyEvidence,
  });

  const strangerSignal = evaluateSignal({
    player: floorborn,
    sessionId: `${campaignId}-stranger-signal`,
    peerId: STRANGER_PEER,
    peerSignal: 'route-safe',
    actualSafe: true,
  });
  assert.equal(strangerSignal.action.id, 'inspect:verify-current');
  const strangerSignalReceipt = strangerSignal.game.step(strangerSignal.action);
  floorborn.learn(strangerSignalReceipt);
  floorborn.markSessionComplete(strangerSignal.game.sessionId);
  const strangerSignalCheckpoint = ledger.checkpoint({
    stage: 'stranger-signal-specificity',
    sessionId: strangerSignal.game.sessionId,
    kind: 'signal-evaluation',
    playerSnapshot: floorborn.snapshot(),
    receipts: strangerSignal.game.receipts,
    publicState: strangerSignal.game.publicState(),
    note: 'chat-001 signal history did not transfer to chat-new.',
  });

  const relicSeed = findNaturalRelicSeed(floorborn);
  assert.notEqual(relicSeed, null, 'host should find a hidden layout where current Floorborn naturally gathers the optional relic');
  const relicRun = runSoloExpedition({
    player: floorborn,
    sessionId: `${campaignId}-relic`,
    seed: relicSeed,
    maxTurns: 70,
  });
  assert.ok(relicRun.game.receipts.some((receipt) => receipt.outcome.eventId === 'gathered:memory-relic'));
  const relicCheckpoint = ledger.checkpoint({
    stage: 'optional-relic-lived',
    sessionId: relicRun.game.sessionId,
    kind: 'expedition-solo',
    playerSnapshot: floorborn.snapshot(),
    receipts: relicRun.game.receipts,
    publicState: relicRun.game.publicState(),
    note: `Natural optional relic experience on hidden seed ${relicSeed}.`,
  });
  report.sessions.push(summary(relicRun.game, { seed: relicSeed, optionalRelicGathered: true }));

  const interlude = new InterludeSession({
    sessionId: `${campaignId}-intent`,
    playerId: FLOORBORN_ID,
  });
  const intentAction = floorborn.decide(interlude.observe());
  assert.equal(intentAction.id, 'signal:seek-relic');
  const intentDecision = stableClone(floorborn.lastDecision);
  const intentReceipt = interlude.step(intentAction);
  floorborn.learn(intentReceipt);
  floorborn.markSessionComplete(interlude.sessionId);
  assert.equal(floorborn.activeIntentions().length, 1);
  const intentCheckpoint = ledger.checkpoint({
    stage: 'optional-intention-created',
    sessionId: interlude.sessionId,
    kind: 'interlude',
    playerSnapshot: floorborn.snapshot(),
    receipts: interlude.receipts,
    publicState: interlude.publicState(),
    note: `Self-selected intent: ${intentAction.id}`,
  });
  const intentEvidence = proposalEvidence(intentDecision, intentAction.id).filter((line) => line.startsWith('memory:relic='));
  assert.ok(intentEvidence.length > 0);
  ledger.link({
    fromSequence: relicCheckpoint.sequence,
    toSequence: intentCheckpoint.sequence,
    relation: 'optional-relic-experience-influenced-future-intent',
    evidence: intentEvidence,
  });

  const unrelated = new SignalTrialSession({
    sessionId: `${campaignId}-unrelated-after-intent`,
    peerId: STRANGER_PEER,
    peerSignal: 'route-danger',
    actualSafe: false,
    mode: 'training',
  });
  const unrelatedAction = floorborn.decide(unrelated.observe());
  const unrelatedReceipt = unrelated.step(unrelatedAction);
  floorborn.learn(unrelatedReceipt);
  floorborn.markSessionComplete(unrelated.sessionId);
  assert.equal(floorborn.activeIntentions()[0].id, 'seek-relic');
  const unrelatedCheckpoint = ledger.checkpoint({
    stage: 'intention-survived-unrelated-session',
    sessionId: unrelated.sessionId,
    kind: 'signal-training',
    playerSnapshot: floorborn.snapshot(),
    receipts: unrelated.receipts,
    publicState: unrelated.publicState(),
    note: 'Pending seek-relic survived unrelated stranger signal verification.',
  });

  const playerBeforeRestore = floorborn.snapshot();
  const ledgerBeforeRestore = ledger.snapshot();
  floorborn = FloorbornPlayer.restore(playerBeforeRestore);
  ledger = CampaignLedger.restore(ledgerBeforeRestore);
  assert.deepEqual(floorborn.snapshot(), playerBeforeRestore);
  assert.deepEqual(ledger.snapshot(), ledgerBeforeRestore);
  const restoreCheckpoint = ledger.checkpoint({
    stage: 'cross-session-restore',
    sessionId: `${campaignId}-restore`,
    kind: 'checkpoint-restore',
    playerSnapshot: floorborn.snapshot(),
    note: 'Player and campaign ledger restored exactly between sessions.',
  });
  ledger.link({
    fromSequence: unrelatedCheckpoint.sequence,
    toSequence: restoreCheckpoint.sequence,
    relation: 'snapshot-preserved-pending-intention-and-lineage-history',
    evidence: [`playerSnapshotDigest=${digest(playerBeforeRestore)}`],
  });

  const opportunity = new IntentionOpportunitySession({
    sessionId: `${campaignId}-intention-opportunity`,
    playerId: FLOORBORN_ID,
  });
  const pursueAction = floorborn.decide(opportunity.observe());
  assert.equal(pursueAction.id, 'signal:pursue-relic-route');
  const pursueDecision = stableClone(floorborn.lastDecision);
  let opportunityReceipt = opportunity.step(pursueAction);
  floorborn.learn(opportunityReceipt);
  assert.equal(floorborn.activeIntentions().length, 1);

  const gatherAction = floorborn.decide(opportunity.observe());
  assert.equal(gatherAction.id, 'gather:memory-relic');
  opportunityReceipt = opportunity.step(gatherAction);
  floorborn.learn(opportunityReceipt);
  floorborn.markSessionComplete(opportunity.sessionId);
  assert.equal(floorborn.activeIntentions().length, 0);
  const opportunityCheckpoint = ledger.checkpoint({
    stage: 'intention-fulfilled',
    sessionId: opportunity.sessionId,
    kind: 'intention-opportunity',
    playerSnapshot: floorborn.snapshot(),
    receipts: opportunity.receipts,
    publicState: opportunity.publicState(),
    note: 'Pending cross-session seek-relic intention fulfilled and retired.',
  });
  const pursueEvidence = proposalEvidence(pursueDecision, pursueAction.id).filter((line) => line.startsWith('intention:seek-relic='));
  assert.ok(pursueEvidence.length > 0);
  ledger.link({
    fromSequence: intentCheckpoint.sequence,
    toSequence: opportunityCheckpoint.sequence,
    relation: 'pending-intention-influenced-later-matching-opportunity',
    evidence: pursueEvidence,
  });

  const replayedOpportunity = replayIntentionOpportunity({
    sessionId: opportunity.sessionId,
    receipts: opportunity.receipts,
  });
  assert.deepEqual(replayedOpportunity, opportunity.publicState());

  const closure = new InterludeSession({
    sessionId: `${campaignId}-closure`,
    playerId: FLOORBORN_ID,
  });
  const closureAction = floorborn.decide(closure.observe());
  assert.equal(closureAction.id, 'signal:finish-journey');
  const closureDecision = stableClone(floorborn.lastDecision);
  const closureReceipt = closure.step(closureAction);
  floorborn.learn(closureReceipt);
  floorborn.markSessionComplete(closure.sessionId);
  const closureCheckpoint = ledger.checkpoint({
    stage: 'campaign-closure',
    sessionId: closure.sessionId,
    kind: 'interlude',
    playerSnapshot: floorborn.snapshot(),
    receipts: closure.receipts,
    publicState: closure.publicState(),
    note: 'Fulfilled intention no longer acts as an immortal command.',
  });
  const closureSeekEvidence = proposalEvidence(closureDecision, 'signal:seek-relic');
  assert.equal(closureSeekEvidence.includes('intention:seek-relic=+1.8'), false);
  ledger.link({
    fromSequence: opportunityCheckpoint.sequence,
    toSequence: closureCheckpoint.sequence,
    relation: 'fulfillment-retired-intention-before-later-closure-choice',
    evidence: ['old intention evidence absent from seek-relic proposal'],
  });

  assert.ok(ledger.entries.length >= 12);
  assert.ok(ledger.links.length >= 7);
  assert.equal(ledger.entries[0].sequence, start.sequence);
  assert.equal(ledger.entries.at(-1).sequence, closureCheckpoint.sequence);
  assert.ok(ledger.entries.some((entry) => entry.sequence === strangerCheckpoint.sequence));
  assert.ok(ledger.entries.some((entry) => entry.sequence === strangerSignalCheckpoint.sequence));

  const ledgerSnapshot = ledger.snapshot();
  const restoredLedger = CampaignLedger.restore(ledgerSnapshot);
  assert.deepEqual(restoredLedger.snapshot(), ledgerSnapshot);

  report.causalLinks = stableClone(ledger.links);
  report.finalPlayer = floorborn.snapshot();
  report.ledger = ledgerSnapshot;
  report.metrics = {
    campaignCheckpoints: ledger.entries.length,
    causalLinks: ledger.links.length,
    completedSessions: floorborn.memory.completedSessions.length,
    companionIds: Object.keys(floorborn.memory.companions).sort(),
    intentionRecords: floorborn.memory.intentions.length,
    activeIntentions: floorborn.activeIntentions().length,
    finalChoice: closureAction.id,
    trapSeed,
    relicSeed,
  };

  return stableClone(report);
}

function runSharedExpedition({ player, sessionId, seed, peerId }) {
  const game = new ExpeditionSession({
    sessionId,
    seed,
    playerIds: [player.playerId, peerId],
  });
  const peerVisited = new Set();
  let safety = 0;

  while (!game.isComplete() && safety < 80) {
    safety += 1;
    const active = game.activePlayerId();
    const observation = game.observe(active);
    const action = active === player.playerId
      ? player.decide(observation)
      : choosePeerAction(observation, peerVisited);
    const receipt = game.step(active, action);
    if (active === player.playerId) player.learn(receipt);
  }

  assert.equal(game.isComplete(), true, `shared expedition ${sessionId} should complete`);
  player.markSessionComplete(sessionId);
  const replayed = replayExpedition({
    sessionId,
    seed,
    playerIds: [player.playerId, peerId],
    receipts: game.receipts,
  });
  assert.deepEqual(replayed, game.publicState());
  return { game };
}

function choosePeerAction(observation, visited) {
  const legal = observation.legalActions;
  const gather = legal.find((action) => action.kind === 'gather');
  if (gather) return gather;
  const inspect = legal.find((action) => action.kind === 'inspect');
  if (inspect) return inspect;
  if (observation.place.id === 'gate') {
    return legal.find((action) => action.id === 'wait:gate')
      ?? legal.find((action) => action.id === 'move:camp')
      ?? legal[0];
  }
  if (observation.place.id !== 'camp') {
    return legal.find((action) => action.id === 'move:camp') ?? legal[0];
  }
  if (observation.party.sealsCollected >= 2) {
    return legal.find((action) => action.id === 'move:gate') ?? legal[0];
  }
  const move = legal.find((action) => (
    action.kind === 'move'
    && REGION_IDS.includes(action.target)
    && !visited.has(action.target)
  ));
  if (move) {
    visited.add(move.target);
    return move;
  }
  return legal.find((action) => action.kind === 'move') ?? legal[0];
}

function runSoloExpedition({ player, sessionId, seed, maxTurns = 60 }) {
  const game = new ExpeditionSession({ sessionId, seed });
  const decisions = [];
  while (!game.isComplete() && game.turn < maxTurns) {
    const observation = game.observe(player.playerId);
    const action = player.decide(observation);
    const decision = stableClone(player.lastDecision);
    const receipt = game.step(player.playerId, action);
    player.learn(receipt);
    decisions.push({ observation, action, decision, receipt });
  }
  assert.equal(game.isComplete(), true, `solo expedition ${sessionId} should complete`);
  player.markSessionComplete(sessionId);
  const replayed = replayExpedition({
    sessionId,
    seed,
    receipts: game.receipts,
  });
  assert.deepEqual(replayed, game.publicState());
  return { game, decisions };
}

function runTrapRecoveryExpedition({ player, sessionId, seed, ledger }) {
  const game = new ExpeditionSession({ sessionId, seed });
  let trapReceipt = null;
  let trapCheckpoint = null;
  let recoveryAction = null;
  let recoveryDecision = null;
  let recoveryCheckpoint = null;
  let sawCampAfterTrap = false;

  while (!game.isComplete() && game.turn < 70) {
    const observation = game.observe(player.playerId);
    const action = player.decide(observation);
    const decision = stableClone(player.lastDecision);
    const receipt = game.step(player.playerId, action);
    player.learn(receipt);

    if (!trapReceipt && receipt.outcome.eventId.startsWith('trap:')) {
      trapReceipt = receipt;
      trapCheckpoint = ledger.checkpoint({
        stage: 'hidden-trap-experienced',
        sessionId,
        kind: 'expedition-partial',
        playerSnapshot: player.snapshot(),
        receipts: game.receipts,
        publicState: game.publicState(),
        note: receipt.outcome.eventId,
      });
    } else if (trapReceipt && !sawCampAfterTrap && receipt.action.id === 'move:camp') {
      sawCampAfterTrap = true;
    } else if (trapReceipt && sawCampAfterTrap && !recoveryAction && observation.place.id === 'camp') {
      recoveryAction = action;
      recoveryDecision = decision;
      recoveryCheckpoint = ledger.checkpoint({
        stage: 'post-trap-reroute',
        sessionId,
        kind: 'expedition-partial',
        playerSnapshot: player.snapshot(),
        receipts: game.receipts,
        publicState: game.publicState(),
        note: `Recovery route: ${action.id}`,
      });
    }
  }

  assert.equal(game.isComplete(), true);
  assert.ok(trapReceipt);
  assert.ok(recoveryAction);
  assert.ok(recoveryCheckpoint);
  player.markSessionComplete(sessionId);
  const replayed = replayExpedition({ sessionId, seed, receipts: game.receipts });
  assert.deepEqual(replayed, game.publicState());

  const badRegionAction = trapReceipt.action.id.startsWith('inspect:')
    ? `move:${trapReceipt.action.target}`
    : null;
  const recoveryEvidence = badRegionAction
    ? proposalEvidence(recoveryDecision, badRegionAction).filter((line) => line.startsWith('memory:') || line.startsWith('repetition:') || line.startsWith('familiarity:'))
    : proposalEvidence(recoveryDecision, recoveryAction.id);
  assert.ok(recoveryEvidence.some((line) => line.includes('-')));

  return {
    game,
    trapReceipt,
    trapCheckpoint,
    recoveryAction,
    recoveryCheckpoint,
    recoveryEvidence,
  };
}

function findAdversarialTrapSeed(player) {
  for (let seed = 0; seed < 64; seed += 1) {
    const clone = FloorbornPlayer.restore(player.snapshot());
    const game = new ExpeditionSession({ sessionId: `trap-candidate-${seed}`, seed });
    let safety = 0;
    while (!game.isComplete() && safety < 70) {
      safety += 1;
      const observation = game.observe(clone.playerId);
      const action = clone.decide(observation);
      const receipt = game.step(clone.playerId, action);
      clone.learn(receipt);
      if (receipt.outcome.eventId.startsWith('trap:')) return seed;
    }
  }
  return null;
}

function findNaturalRelicSeed(player) {
  for (let seed = 0; seed < 64; seed += 1) {
    const clone = FloorbornPlayer.restore(player.snapshot());
    const game = new ExpeditionSession({ sessionId: `relic-candidate-${seed}`, seed });
    let safety = 0;
    while (!game.isComplete() && safety < 70) {
      safety += 1;
      const observation = game.observe(clone.playerId);
      const action = clone.decide(observation);
      const receipt = game.step(clone.playerId, action);
      clone.learn(receipt);
    }
    if (
      game.isComplete()
      && game.receipts.some((receipt) => receipt.outcome.eventId === 'gathered:memory-relic')
    ) {
      return seed;
    }
  }
  return null;
}

function trainSignals({ player, campaignId, phase, peerId, peerSignal, actualSafe, count }) {
  const trials = [];
  for (let index = 0; index < count; index += 1) {
    const game = new SignalTrialSession({
      sessionId: `${campaignId}-${phase}-${index}`,
      peerId,
      peerSignal,
      actualSafe,
      mode: 'training',
    });
    const action = player.decide(game.observe());
    assert.equal(action.id, 'inspect:verify-route');
    const receipt = game.step(action);
    player.learn(receipt);
    player.markSessionComplete(game.sessionId);
    trials.push({ game, action, receipt });
  }
  return trials;
}

function evaluateSignal({ player, sessionId, peerId, peerSignal, actualSafe }) {
  const game = new SignalTrialSession({
    sessionId,
    peerId,
    peerSignal,
    actualSafe,
    mode: 'evaluation',
  });
  const action = player.decide(game.observe());
  return { game, action, decision: stableClone(player.lastDecision) };
}

function proposalEvidence(decision, actionId) {
  return decision.proposals.find((proposal) => proposal.actionId === actionId)?.evidence ?? [];
}

function summary(game, extra = {}) {
  return {
    sessionId: game.sessionId,
    turns: game.turn,
    complete: game.isComplete(),
    receiptCount: game.receipts?.length ?? 0,
    ...extra,
  };
}
