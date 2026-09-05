import { ConsequenceContestedRtsSession } from './consequence-contested-rts.js';
import { effectiveCommandCost } from './rts-lab.js';
import { stableClone } from './stable.js';

const MAP_ID = 'contested-rts-basin';
const MAX_COMBAT_INTEGRITY = 2;

export class StateRecoveryContestedRtsSession extends ConsequenceContestedRtsSession {
  legalActionsFor(playerId) {
    const base = stableClone(super.legalActionsFor(playerId));
    const player = this.players[playerId];
    if (player.yielded || player.budgetRemaining === 0) return base;

    const additions = [];
    for (const [groupId, group] of Object.entries(player.groups)) {
      if (
        group.role === 'combat'
        && group.position === 'base'
        && group.integrity > 0
        && group.integrity < MAX_COMBAT_INTEGRITY
      ) {
        const action = command(
          `command:stabilize:${groupId}:base`,
          groupId,
          [groupId],
          ['recovery', 'stabilization', 'survival'],
        );
        if (action.effectiveCost <= player.budgetRemaining) additions.push(action);
      }
    }

    const yieldIndex = base.findIndex((action) => action.id === 'wait:yield-window');
    if (yieldIndex >= 0) base.splice(yieldIndex, 0, ...additions);
    else base.push(...additions);
    return base;
  }

  applyAction(playerId, actionTaken) {
    if (!actionTaken.id.startsWith('command:stabilize:')) {
      return super.applyAction(playerId, actionTaken);
    }

    this.visibleEventsByPlayer[playerId] = [];
    const player = this.players[playerId];
    const groupId = actionTaken.affectedGroups?.[0];
    const group = player.groups[groupId];
    if (!group || group.role !== 'combat') throw new Error('stabilize target must be own combat group');
    if (group.position !== 'base') throw new Error('stabilize target must be at base');
    if (group.integrity <= 0 || group.integrity >= MAX_COMBAT_INTEGRITY) {
      throw new Error('stabilize target must be damaged and alive');
    }

    player.budgetRemaining -= actionTaken.effectiveCost;
    const before = group.integrity;
    group.integrity = Math.min(MAX_COMBAT_INTEGRITY, group.integrity + 1);

    return {
      eventId: `stabilized:${groupId}:base`,
      placeId: MAP_ID,
      description: `${playerId} stabilized ${groupId} at base from integrity ${before} to ${group.integrity}.`,
      utility: 0.9,
      novelty: 0.3,
    };
  }
}

function command(id, target, affectedGroups, affordanceTags) {
  const action = {
    id,
    kind: 'command',
    target,
    affectedGroups: [...affectedGroups].sort(),
    affordanceTags: [...affordanceTags].sort(),
  };
  action.effectiveCost = effectiveCommandCost(action);
  return action;
}
