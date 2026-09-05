import { assertLegalAction, validateObservation } from './protocol.js';
import { stableClone } from './stable.js';

const BASE_KIND_SCORE = Object.freeze({
  gather: 3.5,
  inspect: 2.5,
  move: 1.0,
  signal: 0.5,
  wait: 0.0,
});
const PEER_SPECIFIC_TAGS = new Set(['cooperation', 'communication']);
const RECENT_SIGNAL_STREAK = 4;
const RECENT_SIGNAL_HISTORY_LIMIT = 8;

export class FloorbornPlayer {
  constructor({
    playerId = 'floorborn-001',
    lineageId = 'floorborn-root',
    memory = null,
  } = {}) {
    this.playerId = playerId;
    this.lineageId = lineageId;
    this.memory = memory ? normalizeMemory(memory) : freshMemory();
    this.lastDecision = null;
  }

  decide(observation) {
    validateObservation(observation);
    this.observeContext(observation);

    const proposals = observation.legalActions.map((action) => scoreAction(action, observation, this.memory));
    proposals.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.action.id.localeCompare(b.action.id);
    });

    const selected = stableClone(proposals[0].action);
    assertLegalAction(selected, observation);

    this.lastDecision = {
      turn: observation.turn,
      peerId: observation.party?.peer?.playerId ?? null,
      peerSignal: observation.party?.peer?.signal ?? null,
      selectedActionId: selected.id,
      proposals: proposals.map((proposal) => ({
        actionId: proposal.action.id,
        score: round(proposal.score),
        evidence: proposal.evidence,
      })),
    };

    if (observation.sessionId.endsWith('-verify-eval')) {
      const peerId = observation.party?.peer?.playerId;
      const peerSignal = observation.party?.peer?.signal;
      const companion = peerId ? this.memory.companions[peerId] : null;
      console.error('FLOORBORN_CAMPAIGN_VERIFY_TRACE', JSON.stringify({
        sessionId: observation.sessionId,
        peerId,
        peerSignal,
        signalEvidence: companion?.signalEvidence?.[peerSignal] ?? null,
        recentSignalVerdicts: companion?.recentSignalVerdicts?.[peerSignal] ?? null,
        observedTurns: companion?.observedTurns ?? null,
        sharedSessions: companion?.sharedSessions?.length ?? null,
        cooperationOutcomes: companion?.cooperationOutcomes ?? null,
        activeIntentions: this.activeIntentions(),
        selectedActionId: selected.id,
        proposals: this.lastDecision.proposals,
      }, null, 2));
    }

    return selected;
  }

  observeContext(observation) {
    validateObservation(observation);
    const key = `${observation.sessionId}:${observation.turn}:${observation.self.playerId}`;
    if (this.memory.observedContextKeys.includes(key)) return false;

    this.memory.observedContextKeys.push(key);
    if (this.memory.observedContextKeys.length > 256) this.memory.observedContextKeys.shift();

    const peer = observation.party?.peer;
    if (!peer?.playerId) return true;

    const companion = this.memory.companions[peer.playerId] ?? freshCompanionMemory();
    companion.observedTurns += 1;
    if (!companion.sharedSessions.includes(observation.sessionId)) {
      companion.sharedSessions.push(observation.sessionId);
    }
    if (peer.signal) {
      companion.signalsSeen[peer.signal] = (companion.signalsSeen[peer.signal] ?? 0) + 1;
    }
    if (peer.placeId) {
      companion.placeSightings[peer.placeId] = (companion.placeSightings[peer.placeId] ?? 0) + 1;
    }
    if (Array.isArray(peer.inventory) && peer.inventory.length > 0) {
      companion.inventorySightings += peer.inventory.length;
    }
    this.memory.companions[peer.playerId] = companion;
    return true;
  }

  learn(receipt) {
    if (!receipt || receipt.playerId !== this.playerId) throw new Error('receipt belongs to a different player');
    if (!receipt.action || !receipt.outcome) throw new Error('receipt must contain action and outcome');

    const tags = receipt.action.affordanceTags ?? [];
    const utility = Number(receipt.outcome.utility ?? 0);
    const novelty = Number(receipt.outcome.novelty ?? 0);
    const combinedSignal = utility + novelty * 0.25;
    const sameDecision = this.lastDecision?.turn === receipt.turn;
    const decisionPeerId = sameDecision ? this.lastDecision.peerId : null;
    const decisionPeerSignal = sameDecision ? this.lastDecision.peerSignal : null;

    this.memory.actionsObserved += 1;
    this.memory.recentActionIds.push(receipt.action.id);
    if (this.memory.recentActionIds.length > 8) this.memory.recentActionIds.shift();

    updateIntentions(this.memory, receipt, decisionPeerId);

    if (receipt.outcome.eventId) {
      this.memory.episodes.push({
        eventId: receipt.outcome.eventId,
        actionId: receipt.action.id,
        utility: round(utility),
        novelty: round(novelty),
        tags: [...tags].sort(),
        peerId: decisionPeerId,
        peerSignal: decisionPeerSignal,
      });
    }

    if (
      decisionPeerId
      && decisionPeerSignal
      && ['supported', 'contradicted'].includes(receipt.outcome.peerSignalVerdict)
    ) {
      const companion = this.memory.companions[decisionPeerId] ?? freshCompanionMemory();
      const verdict = receipt.outcome.peerSignalVerdict;
      const evidence = companion.signalEvidence[decisionPeerSignal] ?? { supported: 0, contradicted: 0 };
      evidence[verdict] += 1;
      companion.signalEvidence[decisionPeerSignal] = evidence;

      const recent = companion.recentSignalVerdicts[decisionPeerSignal] ?? [];
      recent.push(verdict);
      if (recent.length > RECENT_SIGNAL_HISTORY_LIMIT) recent.shift();
      companion.recentSignalVerdicts[decisionPeerSignal] = recent;

      this.memory.companions[decisionPeerId] = companion;
    }

    for (const tag of tags) {
      if (decisionPeerId && PEER_SPECIFIC_TAGS.has(tag)) {
        const companion = this.memory.companions[decisionPeerId] ?? freshCompanionMemory();
        companion.cooperationOutcomes.count += 1;
        companion.cooperationOutcomes.totalSignal = round(
          companion.cooperationOutcomes.totalSignal + combinedSignal,
        );
        this.memory.companions[decisionPeerId] = companion;
        continue;
      }

      const current = this.memory.tagPatterns[tag] ?? { count: 0, totalSignal: 0 };
      current.count += 1;
      current.totalSignal = round(current.totalSignal + combinedSignal);
      this.memory.tagPatterns[tag] = current;
    }

    const placeId = receipt.outcome.placeId;
    if (placeId) this.memory.seenPlaces[placeId] = (this.memory.seenPlaces[placeId] ?? 0) + 1;
  }

  markSessionComplete(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
    if (!this.memory.completedSessions.includes(sessionId)) this.memory.completedSessions.push(sessionId);
  }

  activeIntentions() {
    return stableClone(this.memory.intentions.filter((intention) => intention.status === 'pending'));
  }

  snapshot() {
    return stableClone({
      schema: 'axm.floorborn.memory.v0.7',
      playerId: this.playerId,
      lineageId: this.lineageId,
      memory: this.memory,
    });
  }

  static restore(snapshot) {
    if (!snapshot || ![
      'axm.floorborn.memory.v0.1',
      'axm.floorborn.memory.v0.2',
      'axm.floorborn.memory.v0.3',
      'axm.floorborn.memory.v0.4',
      'axm.floorborn.memory.v0.5',
      'axm.floorborn.memory.v0.6',
      'axm.floorborn.memory.v0.7',
    ].includes(snapshot.schema)) {
      throw new Error('unsupported Floorborn snapshot');
    }
    return new FloorbornPlayer({
      playerId: snapshot.playerId,
      lineageId: snapshot.lineageId,
      memory: snapshot.memory,
    });
  }
}

function scoreAction(action, observation, memory) {
  let score = BASE_KIND_SCORE[action.kind] ?? 0;
  const evidence = [`base:${action.kind}=${round(score)}`];
  const tags = action.affordanceTags ?? [];
  const peer = observation.party?.peer;
  const companion = tags.includes('cooperation') && peer?.playerId
    ? memory.companions[peer.playerId]
    : null;
  const signalAssessment = assessSpecificSignal(companion, peer?.signal);
  const specificSignalContradicted = Boolean(signalAssessment && signalAssessment.balance < 0);

  if (action.kind === 'move' && action.target) {
    const seen = memory.seenPlaces[action.target] ?? 0;
    if (seen === 0) {
      score += 1.0;
      evidence.push('curiosity:unseen-place=+1');
    } else {
      const penalty = Math.min(0.5, seen * 0.1);
      score -= penalty;
      evidence.push(`familiarity:${seen}=-${round(penalty)}`);
    }
  }

  for (const tag of tags) {
    const pattern = memory.tagPatterns[tag];
    if (!pattern || pattern.count === 0) continue;
    if (specificSignalContradicted && PEER_SPECIFIC_TAGS.has(tag)) {
      evidence.push(`memory:${tag}=blocked-by-specific-signal-contradiction`);
      continue;
    }
    const learned = pattern.totalSignal / pattern.count;
    score += learned;
    evidence.push(`memory:${tag}=${signed(round(learned))}`);
  }

  if (action.kind === 'inspect' && observation.place?.known === false) {
    score += 0.75;
    evidence.push('curiosity:unknown-place=+0.75');
  }

  const repeats = memory.recentActionIds.filter((id) => id === action.id).length;
  if (repeats) {
    const penalty = Math.min(1.5, repeats * 0.35);
    score -= penalty;
    evidence.push(`repetition:${repeats}=-${round(penalty)}`);
  }

  if (tags.includes('goal')) {
    score += 3.0;
    evidence.push('goal-relevance=+3');
  }

  if (tags.includes('completion')) {
    score += 0.8;
    evidence.push('completion-bias=+0.8');
  }

  if (tags.includes('optional')) {
    score += 0.4;
    evidence.push('optional-curiosity=+0.4');
  }

  for (const intention of memory.intentions) {
    if (intention.status !== 'pending') continue;
    if (intention.id === 'seek-relic' && tags.includes('relic')) {
      score += 1.8;
      evidence.push('intention:seek-relic=+1.8');
    }
    if (
      intention.id === 'continue-with-peer'
      && tags.includes('cooperation')
      && observation.party?.peer?.playerId
      && observation.party.peer.playerId === intention.peerId
    ) {
      score += 1.8;
      evidence.push(`intention:continue-with-peer:${intention.peerId}=+1.8`);
    }
  }

  if (tags.includes('cooperation') && peer?.playerId) {
    if (signalAssessment) {
      score += signalAssessment.weight;
      evidence.push(`signal-evidence:${peer.playerId}:${peer.signal}=${signed(signalAssessment.weight)}`);
      evidence.push(`signal-evidence-basis:${peer.playerId}:${peer.signal}=${signalAssessment.basis}`);
    }

    if (specificSignalContradicted) {
      evidence.push('specific-signal-contradiction=blocks-general-companion-bonus');
    } else {
      if (peer.signal) {
        score += 0.9;
        evidence.push('peer-signal=+0.9');
      }

      if (companion) {
        const priorObservedTurns = Math.max(0, companion.observedTurns - 1);
        const priorSharedSessions = Math.max(0, companion.sharedSessions.length - 1);
        const familiarity = Math.min(
          1.8,
          priorObservedTurns * 0.22 + priorSharedSessions * 0.25,
        );
        if (familiarity > 0) {
          score += familiarity;
          evidence.push(`companion:${peer.playerId}=+${round(familiarity)}`);
        }

        if (companion.cooperationOutcomes.count > 0) {
          const learnedCooperation = Math.min(
            1.5,
            companion.cooperationOutcomes.totalSignal / companion.cooperationOutcomes.count,
          );
          score += learnedCooperation;
          evidence.push(`companion-outcome:${peer.playerId}=+${round(learnedCooperation)}`);
        }
      }
    }
  }

  return { action, score, evidence };
}

function assessSpecificSignal(companion, signal) {
  if (!companion || !signal) return null;
  const signalEvidence = companion.signalEvidence[signal];
  if (!signalEvidence) return null;
  const total = signalEvidence.supported + signalEvidence.contradicted;
  if (total <= 0) return null;

  const lifetimeBalance = (signalEvidence.supported - signalEvidence.contradicted) / total;
  const recent = companion.recentSignalVerdicts[signal] ?? [];
  const tail = recent.slice(-RECENT_SIGNAL_STREAK);

  if (tail.length === RECENT_SIGNAL_STREAK && tail.every((verdict) => verdict === 'contradicted')) {
    return {
      balance: -1,
      weight: -2.4,
      basis: 'recent-contradiction-streak',
    };
  }

  if (tail.length === RECENT_SIGNAL_STREAK && tail.every((verdict) => verdict === 'supported')) {
    return {
      balance: 1,
      weight: 2.4,
      basis: 'recent-support-streak',
    };
  }

  return {
    balance: lifetimeBalance,
    weight: round(lifetimeBalance * 2.4),
    basis: 'lifetime-balance',
  };
}

function updateIntentions(memory, receipt, decisionPeerId) {
  const eventId = receipt.outcome?.eventId;
  if (!eventId) return;

  if (eventId === 'intent:seek-relic') {
    createPendingIntention(memory, {
      id: 'seek-relic',
      peerId: null,
      createdSessionId: receipt.sessionId,
      createdTurn: receipt.turn,
      sourceActionId: receipt.action.id,
    });
    return;
  }

  if (eventId === 'intent:continue-with-peer' && decisionPeerId) {
    createPendingIntention(memory, {
      id: 'continue-with-peer',
      peerId: decisionPeerId,
      createdSessionId: receipt.sessionId,
      createdTurn: receipt.turn,
      sourceActionId: receipt.action.id,
    });
    return;
  }

  if (eventId === 'gathered:memory-relic') {
    retireLatestPending(memory, 'seek-relic', 'fulfilled', receipt);
    return;
  }

  if (eventId === 'intent-invalidated:seek-relic') {
    retireLatestPending(memory, 'seek-relic', 'invalidated', receipt);
  }
}

function createPendingIntention(memory, intention) {
  const existing = [...memory.intentions].reverse().find((candidate) => (
    candidate.id === intention.id
    && candidate.peerId === intention.peerId
    && candidate.status === 'pending'
  ));
  if (existing) return;

  memory.intentionSequence += 1;
  memory.intentions.push({
    sequence: memory.intentionSequence,
    ...intention,
    status: 'pending',
    retiredSessionId: null,
    retiredTurn: null,
    retiredEventId: null,
  });
}

function retireLatestPending(memory, intentionId, status, receipt) {
  const intention = [...memory.intentions].reverse().find((candidate) => (
    candidate.id === intentionId && candidate.status === 'pending'
  ));
  if (!intention) return;
  intention.status = status;
  intention.retiredSessionId = receipt.sessionId;
  intention.retiredTurn = receipt.turn;
  intention.retiredEventId = receipt.outcome.eventId;
}

function freshMemory() {
  return {
    completedSessions: [],
    actionsObserved: 0,
    episodes: [],
    tagPatterns: {},
    seenPlaces: {},
    recentActionIds: [],
    companions: {},
    observedContextKeys: [],
    intentionSequence: 0,
    intentions: [],
  };
}

function freshCompanionMemory() {
  return {
    observedTurns: 0,
    sharedSessions: [],
    signalsSeen: {},
    placeSightings: {},
    inventorySightings: 0,
    cooperationOutcomes: {
      count: 0,
      totalSignal: 0,
    },
    signalEvidence: {},
    recentSignalVerdicts: {},
  };
}

function normalizeMemory(memory) {
  const clone = stableClone(memory);
  clone.completedSessions ??= [];
  clone.actionsObserved ??= 0;
  clone.episodes ??= [];
  clone.tagPatterns ??= {};
  clone.seenPlaces ??= {};
  clone.recentActionIds ??= [];
  clone.companions ??= {};
  clone.observedContextKeys ??= [];
  clone.intentionSequence ??= 0;
  clone.intentions ??= [];
  clone.intentions = clone.intentions.map((intention) => ({
    peerId: null,
    retiredSessionId: null,
    retiredTurn: null,
    retiredEventId: null,
    ...intention,
  }));
  for (const [peerId, companion] of Object.entries(clone.companions)) {
    clone.companions[peerId] = {
      ...freshCompanionMemory(),
      ...companion,
      sharedSessions: [...(companion.sharedSessions ?? [])],
      signalsSeen: { ...(companion.signalsSeen ?? {}) },
      placeSightings: { ...(companion.placeSightings ?? {}) },
      cooperationOutcomes: {
        count: companion.cooperationOutcomes?.count ?? 0,
        totalSignal: companion.cooperationOutcomes?.totalSignal ?? 0,
      },
      signalEvidence: Object.fromEntries(
        Object.entries(companion.signalEvidence ?? {}).map(([signal, evidence]) => [signal, {
          supported: evidence.supported ?? 0,
          contradicted: evidence.contradicted ?? 0,
        }]),
      ),
      recentSignalVerdicts: Object.fromEntries(
        Object.entries(companion.recentSignalVerdicts ?? {}).map(([signal, verdicts]) => [signal, [...verdicts]]),
      ),
    };
  }
  return clone;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}
