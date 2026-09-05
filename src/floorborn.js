import { assertLegalAction, validateObservation } from './protocol.js';
import { stableClone } from './stable.js';

const BASE_KIND_SCORE = Object.freeze({
  gather: 3.5,
  inspect: 2.5,
  move: 1.0,
  signal: 0.5,
  wait: 0.0,
});

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

    const proposals = observation.legalActions.map((action) => scoreAction(action, observation, this.memory));
    proposals.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.action.id.localeCompare(b.action.id);
    });

    const selected = stableClone(proposals[0].action);
    assertLegalAction(selected, observation);

    this.lastDecision = {
      turn: observation.turn,
      selectedActionId: selected.id,
      proposals: proposals.map((proposal) => ({
        actionId: proposal.action.id,
        score: round(proposal.score),
        evidence: proposal.evidence,
      })),
    };

    return selected;
  }

  learn(receipt) {
    if (!receipt || receipt.playerId !== this.playerId) throw new Error('receipt belongs to a different player');
    if (!receipt.action || !receipt.outcome) throw new Error('receipt must contain action and outcome');

    const tags = receipt.action.affordanceTags ?? [];
    const utility = Number(receipt.outcome.utility ?? 0);
    const novelty = Number(receipt.outcome.novelty ?? 0);
    const combinedSignal = utility + novelty * 0.25;

    this.memory.actionsObserved += 1;
    if (receipt.outcome.eventId) {
      this.memory.episodes.push({
        eventId: receipt.outcome.eventId,
        actionId: receipt.action.id,
        utility: round(utility),
        novelty: round(novelty),
        tags: [...tags].sort(),
      });
    }

    for (const tag of tags) {
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
      schema: 'axm.floorborn.memory.v0.1',
      playerId: this.playerId,
      lineageId: this.lineageId,
      memory: this.memory,
    });
  }

  static restore(snapshot) {
    if (!snapshot || snapshot.schema !== 'axm.floorborn.memory.v0.1') throw new Error('unsupported Floorborn snapshot');
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
      score -= Math.min(0.5, seen * 0.1);
      evidence.push(`familiarity:${seen}=-${round(Math.min(0.5, seen * 0.1))}`);
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

  return { action, score, evidence };
}

function freshMemory() {
  return {
    completedSessions: [],
    actionsObserved: 0,
    episodes: [],
    tagPatterns: {},
    seenPlaces: {},
  };
}

function normalizeMemory(memory) {
  const clone = stableClone(memory);
  clone.completedSessions ??= [];
  clone.actionsObserved ??= 0;
  clone.episodes ??= [];
  clone.tagPatterns ??= {};
  clone.seenPlaces ??= {};
  return clone;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}
