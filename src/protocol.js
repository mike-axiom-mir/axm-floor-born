import { stableClone } from './stable.js';

export const PLAYER_PROTOCOL_VERSION = 'axm.player.v0.1';
export const RTS_PLAYER_PROTOCOL_VERSION = 'axm.player.rts.v0.1';

const SUPPORTED_PROTOCOLS = new Set([
  PLAYER_PROTOCOL_VERSION,
  RTS_PLAYER_PROTOCOL_VERSION,
]);

const ALLOWED_ACTION_KINDS = new Set([
  'move',
  'inspect',
  'gather',
  'signal',
  'wait',
  'command',
]);

export function freezeObservation(observation) {
  const clone = stableClone(observation);
  return deepFreeze(clone);
}

export function validateObservation(observation) {
  if (!observation || typeof observation !== 'object') throw new TypeError('observation must be an object');
  if (!SUPPORTED_PROTOCOLS.has(observation.protocol)) throw new Error('unsupported player protocol');
  if (!Number.isInteger(observation.turn) || observation.turn < 0) throw new Error('turn must be a non-negative integer');
  if (!observation.self || typeof observation.self !== 'object') throw new Error('observation.self is required');
  if (!observation.place || typeof observation.place !== 'object') throw new Error('observation.place is required');
  if (!Array.isArray(observation.legalActions) || observation.legalActions.length === 0) {
    throw new Error('observation.legalActions must be a non-empty array');
  }

  const ids = new Set();
  for (const action of observation.legalActions) {
    validateActionShape(action);
    if (ids.has(action.id)) throw new Error(`duplicate legal action id: ${action.id}`);
    ids.add(action.id);
  }
  return true;
}

export function validateActionShape(action) {
  if (!action || typeof action !== 'object') throw new TypeError('action must be an object');
  if (!action.id || typeof action.id !== 'string') throw new Error('action.id is required');
  if (!ALLOWED_ACTION_KINDS.has(action.kind)) throw new Error(`unsupported action kind: ${action.kind}`);
  if (action.target !== undefined && typeof action.target !== 'string') throw new Error('action.target must be a string');
  if (action.affordanceTags !== undefined) {
    if (!Array.isArray(action.affordanceTags) || action.affordanceTags.some((tag) => typeof tag !== 'string')) {
      throw new Error('action.affordanceTags must be an array of strings');
    }
  }
  if (action.effectiveCost !== undefined) {
    if (!Number.isInteger(action.effectiveCost) || action.effectiveCost < 0) {
      throw new Error('action.effectiveCost must be a non-negative integer');
    }
  }
  if (action.affectedGroups !== undefined) {
    if (
      !Array.isArray(action.affectedGroups)
      || action.affectedGroups.length === 0
      || action.affectedGroups.some((group) => typeof group !== 'string' || group.length === 0)
      || new Set(action.affectedGroups).size !== action.affectedGroups.length
    ) {
      throw new Error('action.affectedGroups must be a non-empty unique array of strings');
    }
  }
  return true;
}

export function assertLegalAction(action, observation) {
  validateObservation(observation);
  validateActionShape(action);
  const legal = observation.legalActions.find((candidate) => candidate.id === action.id);
  if (!legal) throw new Error(`illegal action: ${action.id}`);

  const same = JSON.stringify(stableClone(action)) === JSON.stringify(stableClone(legal));
  if (!same) throw new Error(`action payload does not match legal action declaration: ${action.id}`);
  return true;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
