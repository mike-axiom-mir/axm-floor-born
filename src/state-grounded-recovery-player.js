import { assertLegalAction, validateObservation } from './protocol.js';
import { FloorbornPlayer } from './floorborn.js';
import { stableClone } from './stable.js';

const REENTRY_HOLD = 3.0;
const STABILIZE_RELEVANCE = 3.0;

export class StateGroundedRecoveryPlayer {
  constructor({
    playerId = 'floorborn-001',
    lineageId = 'state-grounded-recovery-root',
    floorborn = null,
  } = {}) {
    this.floorborn = floorborn ?? new FloorbornPlayer({
      playerId,
      lineageId,
      perspectives: {
        criticalRecovery: true,
        recoveryLifecycle: false,
      },
    });
    this.ensureMemory();
  }

  get playerId() {
    return this.floorborn.playerId;
  }

  get lineageId() {
    return this.floorborn.lineageId;
  }

  get memory() {
    return this.floorborn.memory;
  }

  get perspectives() {
    return this.floorborn.perspectives;
  }

  get lastDecision() {
    return this.floorborn.lastDecision;
  }

  decide(observation) {
    validateObservation(observation);
    this.refresh(observation);

    this.floorborn.decide(observation);
    const adjusted = this.floorborn.lastDecision.proposals.map((proposal) => {
      const action = observation.legalActions.find((candidate) => candidate.id === proposal.actionId);
      if (!action) throw new Error(`proposal action missing from bounded observation: ${proposal.actionId}`);

      let score = Number(proposal.score);
      const evidence = [...proposal.evidence];
      const held = this.pendingAffectedGroups(action, observation);

      if (held.length > 0 && action.target === 'center') {
        score -= REENTRY_HOLD;
        evidence.push(`state-recovery-hold:${held.join(',')}=-${REENTRY_HOLD}`);
      }

      if (
        held.length > 0
        && action.kind === 'command'
        && action.id.startsWith('command:stabilize:')
      ) {
        score += STABILIZE_RELEVANCE;
        evidence.push(`state-recovery-stabilize:${held.join(',')}=+${STABILIZE_RELEVANCE}`);
      }

      return {
        actionId: proposal.actionId,
        score: round(score),
        evidence,
      };
    });

    adjusted.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.actionId.localeCompare(b.actionId);
    });

    const selectedId = adjusted[0].actionId;
    const selected = observation.legalActions.find((action) => action.id === selectedId);
    assertLegalAction(selected, observation);

    this.floorborn.lastDecision = {
      ...this.floorborn.lastDecision,
      selectedActionId: selectedId,
      proposals: adjusted,
      stateRecoveryMode: 'state-grounded-v0.15',
    };

    return stableClone(selected);
  }

  learn(receipt) {
    this.floorborn.learn(receipt);
    this.ensureMemory();

    const eventId = receipt.outcome?.eventId ?? '';
    if (eventId.startsWith('retreated:')) {
      const groupId = receipt.action?.affectedGroups?.[0];
      if (groupId) this.createRecovery(groupId, receipt);
      return;
    }

    if (eventId.startsWith('stabilized:')) {
      const groupId = receipt.action?.affectedGroups?.[0];
      if (groupId) this.retireLatest(groupId, 'completed', receipt, eventId);
      return;
    }

    if (receipt.action?.target === 'center' && Array.isArray(receipt.action.affectedGroups)) {
      for (const groupId of receipt.action.affectedGroups) {
        this.retireLatest(
          groupId,
          'overridden',
          receipt,
          `state-recovery-overridden:${receipt.action.id}`,
        );
      }
    }
  }

  markSessionComplete(sessionId) {
    this.floorborn.markSessionComplete(sessionId);
  }

  activeRecoveries() {
    this.ensureMemory();
    return stableClone(this.memory.stateGroundedRecoveries.filter((entry) => entry.status === 'pending'));
  }

  snapshot() {
    return stableClone({
      schema: 'axm.floorborn.state-grounded-recovery-player.v0.1',
      floorborn: this.floorborn.snapshot(),
    });
  }

  static restore(snapshot) {
    if (!snapshot || snapshot.schema !== 'axm.floorborn.state-grounded-recovery-player.v0.1') {
      throw new Error('unsupported state-grounded recovery player snapshot');
    }
    return new StateGroundedRecoveryPlayer({
      floorborn: FloorbornPlayer.restore(snapshot.floorborn),
    });
  }

  refresh(observation) {
    this.ensureMemory();
    for (const recovery of this.memory.stateGroundedRecoveries) {
      if (recovery.status !== 'pending') continue;

      if (recovery.createdSessionId !== observation.sessionId) {
        retire(recovery, 'invalidated', {
          sessionId: observation.sessionId,
          turn: observation.turn,
          windowIndex: observation.rts?.windowIndex ?? null,
          eventId: 'state-recovery-invalidated:session-changed',
        });
        continue;
      }

      const group = observation.rts?.ownGroups?.find((candidate) => candidate.id === recovery.groupId);
      if (!group || Number(group.integrity) <= 0 || group.position === 'destroyed') {
        retire(recovery, 'invalidated', {
          sessionId: observation.sessionId,
          turn: observation.turn,
          windowIndex: observation.rts?.windowIndex ?? null,
          eventId: 'state-recovery-invalidated:group-unavailable',
        });
        continue;
      }

      if (group.position === 'base' && Number(group.integrity) >= recovery.targetIntegrity) {
        retire(recovery, 'completed', {
          sessionId: observation.sessionId,
          turn: observation.turn,
          windowIndex: observation.rts?.windowIndex ?? null,
          eventId: 'state-recovery-completed:visible-integrity',
        });
      }
    }
  }

  pendingAffectedGroups(action, observation) {
    if (!Array.isArray(action.affectedGroups)) return [];
    const pending = new Set(this.activeRecoveries().map((entry) => entry.groupId));
    if (pending.size === 0) return [];
    const ownGroups = new Map((observation.rts?.ownGroups ?? []).map((group) => [group.id, group]));

    return action.affectedGroups.filter((groupId) => {
      if (!pending.has(groupId)) return false;
      const group = ownGroups.get(groupId);
      return Boolean(group && group.position === 'base' && Number(group.integrity) > 0);
    }).sort();
  }

  createRecovery(groupId, receipt) {
    this.ensureMemory();
    const existing = [...this.memory.stateGroundedRecoveries].reverse().find((entry) => (
      entry.groupId === groupId && entry.status === 'pending'
    ));
    if (existing) return existing;

    this.memory.stateGroundedRecoverySequence += 1;
    const entry = {
      sequence: this.memory.stateGroundedRecoverySequence,
      groupId,
      status: 'pending',
      targetIntegrity: 2,
      createdSessionId: receipt.sessionId,
      createdTurn: receipt.turn,
      createdWindowIndex: Number.isInteger(receipt.windowIndex) ? receipt.windowIndex : null,
      sourceActionId: receipt.action.id,
      sourceEventId: receipt.outcome.eventId,
      retiredSessionId: null,
      retiredTurn: null,
      retiredWindowIndex: null,
      retiredEventId: null,
    };
    this.memory.stateGroundedRecoveries.push(entry);
    return entry;
  }

  retireLatest(groupId, status, receipt, eventId) {
    this.ensureMemory();
    const recovery = [...this.memory.stateGroundedRecoveries].reverse().find((entry) => (
      entry.groupId === groupId && entry.status === 'pending'
    ));
    if (!recovery) return false;

    retire(recovery, status, {
      sessionId: receipt.sessionId,
      turn: receipt.turn,
      windowIndex: Number.isInteger(receipt.windowIndex) ? receipt.windowIndex : null,
      eventId,
    });
    return true;
  }

  ensureMemory() {
    this.memory.stateGroundedRecoverySequence ??= 0;
    this.memory.stateGroundedRecoveries ??= [];
  }
}

function retire(recovery, status, { sessionId, turn, windowIndex, eventId }) {
  recovery.status = status;
  recovery.retiredSessionId = sessionId;
  recovery.retiredTurn = turn;
  recovery.retiredWindowIndex = windowIndex;
  recovery.retiredEventId = eventId;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
