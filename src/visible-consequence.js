import { validateObservation } from './protocol.js';
import { stableClone } from './stable.js';

const MAX_CONSEQUENCE_KEYS = 512;

export function ingestVisibleConsequences(floorborn, observation) {
  if (!floorborn?.memory) throw new Error('Floorborn player with inspectable memory is required');
  validateObservation(observation);

  floorborn.memory.visibleConsequenceKeys ??= [];
  floorborn.memory.observedConsequences ??= [];

  const events = observation.rts?.recentVisibleEvents ?? [];
  const ingested = [];

  for (const event of events) {
    validateVisibleEvent(event);
    if (floorborn.memory.visibleConsequenceKeys.includes(event.eventKey)) continue;

    floorborn.memory.visibleConsequenceKeys.push(event.eventKey);
    if (floorborn.memory.visibleConsequenceKeys.length > MAX_CONSEQUENCE_KEYS) {
      floorborn.memory.visibleConsequenceKeys.shift();
    }

    const combinedSignal = Number(event.utility) + Number(event.novelty) * 0.25;
    const record = {
      eventKey: event.eventKey,
      eventId: event.eventId,
      sessionId: observation.sessionId,
      observedTurn: observation.turn,
      sourcePlayerId: event.sourcePlayerId,
      kind: event.kind,
      groupId: event.groupId,
      utility: round(Number(event.utility)),
      novelty: round(Number(event.novelty)),
      tags: [...event.tags].sort(),
    };
    floorborn.memory.observedConsequences.push(record);

    for (const tag of record.tags) {
      const current = floorborn.memory.tagPatterns[tag] ?? { count: 0, totalSignal: 0 };
      current.count += 1;
      current.totalSignal = round(current.totalSignal + combinedSignal);
      floorborn.memory.tagPatterns[tag] = current;
    }

    ingested.push(record);
  }

  return stableClone(ingested);
}

function validateVisibleEvent(event) {
  if (!event || typeof event !== 'object') throw new Error('visible consequence event must be an object');
  if (!event.eventKey || typeof event.eventKey !== 'string') throw new Error('visible consequence eventKey is required');
  if (!event.eventId || typeof event.eventId !== 'string') throw new Error('visible consequence eventId is required');
  if (!event.sourcePlayerId || typeof event.sourcePlayerId !== 'string') throw new Error('visible consequence sourcePlayerId is required');
  if (!event.kind || typeof event.kind !== 'string') throw new Error('visible consequence kind is required');
  if (!event.groupId || typeof event.groupId !== 'string') throw new Error('visible consequence groupId is required');
  if (!Number.isFinite(Number(event.utility))) throw new Error('visible consequence utility must be finite');
  if (!Number.isFinite(Number(event.novelty))) throw new Error('visible consequence novelty must be finite');
  if (!Array.isArray(event.tags) || event.tags.some((tag) => typeof tag !== 'string')) {
    throw new Error('visible consequence tags must be strings');
  }
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
