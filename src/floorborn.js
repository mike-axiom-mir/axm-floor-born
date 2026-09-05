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
      selectedActionId: selected.id,
      proposals: proposals.map((proposal) => ({
        actionId: proposal.action.id,
        score: round(proposal.score),
        evidence: proposal.evidence,
      })),
    };

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
    const decisionPeerId = this.lastDecision?.turn === receipt.turn ? this.lastDecision.peerId : null;

    this.memory.actionsObserved += 1;
    this.memory.recentActionIds.push(receipt.action.id);
    if (this.memory.recentActionIds.length > 8) this.memory.recentActionIds.shift();

    if (receipt.outcome.eventId) {
      this.memory.episodes.push({
        eventId: receipt.outcome.eventId,
        actionId: receipt.action.id,
        utility: round(utility),
        novelty: round(novelty),
        tags: [...tags].sort(),
        peerId: decisionPeerId,
      });
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

  snapshot() {
    return stableClone({
      schema: 'axm.floorborn.memory.v0.4',
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

  const tags = action.affordanceTags ?? [];
  for (const tag of tags) {
    const pattern = memory.tagPatterns[tag];
    if (!pattern || pattern.count === 0) continue;
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

  const peer = observation.party?.peer;
  if (tags.includes('cooperation') && peer?.signal) {
    score += 0.9;
    evidence.push('peer-signal=+0.9');
  }

  if (tags.includes('cooperation') && peer?.playerId) {
    const companion = memory.companions[peer.playerId];
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

  return { action, score, evidence };
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
