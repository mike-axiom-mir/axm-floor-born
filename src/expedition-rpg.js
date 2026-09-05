import { assertLegalAction, freezeObservation, PLAYER_PROTOCOL_VERSION } from './protocol.js';
import { digest, stableClone } from './stable.js';

const REGIONS = Object.freeze([
  { id: 'archive', label: 'Glass Archive', tags: ['ancient', 'knowledge'] },
  { id: 'grove', label: 'Lumen Grove', tags: ['wild', 'life'] },
  { id: 'quarry', label: 'Clockwork Quarry', tags: ['stone', 'mechanical'] },
  { id: 'marsh', label: 'Hush Marsh', tags: ['wet', 'hazard'] },
]);
const REGION_BY_ID = Object.freeze(Object.fromEntries(REGIONS.map((region) => [region.id, region])));
const HUB = Object.freeze({ id: 'camp', label: 'Wayfarer Camp', tags: ['safe', 'junction'] });
const GATE = Object.freeze({ id: 'gate', label: 'Resonance Gate', tags: ['ancient', 'gate'] });

export class ExpeditionSession {
  constructor({ sessionId, seed = 1, playerIds = ['floorborn-001'], snapshot = null } = {}) {
    if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
    if (!Number.isInteger(seed)) throw new Error('seed must be an integer');
    if (!Array.isArray(playerIds) || playerIds.length < 1 || playerIds.length > 2 || new Set(playerIds).size !== playerIds.length) {
      throw new Error('expedition supports one or two distinct players');
    }

    this.sessionId = sessionId;
    this.seed = seed;
    this.playerIds = [...playerIds];
    this.hiddenLayout = layoutForSeed(seed);

    if (snapshot) {
      this.restoreSnapshot(snapshot);
      return;
    }

    this.turn = 0;
    this.activePlayerIndex = 0;
    this.placeByPlayer = Object.fromEntries(playerIds.map((id) => [id, HUB.id]));
    this.inventoryByPlayer = Object.fromEntries(playerIds.map((id) => [id, []]));
    this.inspectedByPlayer = Object.fromEntries(playerIds.map((id) => [id, []]));
    this.claimedByRegion = Object.fromEntries(REGIONS.map((region) => [region.id, null]));
    this.lastSignalByPlayer = Object.fromEntries(playerIds.map((id) => [id, null]));
    this.gateOpen = false;
    this.receipts = [];
  }

  activePlayerId() {
    return this.playerIds[this.activePlayerIndex];
  }

  isComplete() {
    return this.gateOpen;
  }

  observe(playerId = this.activePlayerId()) {
    this.assertKnownPlayer(playerId);
    if (playerId !== this.activePlayerId()) throw new Error(`not ${playerId}'s turn`);

    const placeId = this.placeByPlayer[playerId];
    const peerId = this.playerIds.find((id) => id !== playerId) ?? null;
    const known = placeId === HUB.id || placeId === GATE.id || this.inspectedByPlayer[playerId].includes(placeId);
    const place = placeView(placeId, known, this.hiddenLayout, this.claimedByRegion);

    return freezeObservation({
      protocol: PLAYER_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      turn: this.turn,
      self: {
        playerId,
        inventory: [...this.inventoryByPlayer[playerId]],
      },
      place,
      exits: this.exitsFor(placeId).map((id) => placeSummary(id)),
      party: {
        objective: 'Recover any two distinct resonance seals, then open the Resonance Gate.',
        sealsCollected: totalSeals(this.inventoryByPlayer),
        optionalRelicsCollected: totalRelics(this.inventoryByPlayer),
        peer: peerId ? {
          playerId: peerId,
          placeId: this.placeByPlayer[peerId],
          inventory: [...this.inventoryByPlayer[peerId]],
          signal: this.lastSignalByPlayer[peerId],
        } : null,
      },
      legalActions: this.legalActionsFor(playerId),
    });
  }

  legalActionsFor(playerId) {
    const placeId = this.placeByPlayer[playerId];
    const legal = [];

    if (placeId === HUB.id) {
      for (const region of REGIONS) {
        legal.push(action(`move:${region.id}`, 'move', region.id, region.tags));
      }
      const gateTags = totalSeals(this.inventoryByPlayer) >= 2 ? [...GATE.tags, 'goal'] : GATE.tags;
      legal.push(action('move:gate', 'move', 'gate', gateTags));
      if (this.playerIds.length === 2) {
        legal.push(action('signal:explore', 'signal', 'explore', ['cooperation', 'communication']));
      }
      return legal;
    }

    if (placeId === GATE.id) {
      if (totalSeals(this.inventoryByPlayer) >= 2) {
        legal.push(action('signal:open-gate', 'signal', 'open-gate', ['goal', 'cooperation', 'gate']));
      }
      legal.push(action('move:camp', 'move', HUB.id, HUB.tags));
      if (this.playerIds.length === 2) {
        legal.push(action('signal:regroup', 'signal', 'regroup', ['cooperation', 'communication']));
      }
      legal.push(action('wait:gate', 'wait', undefined, ['gate']));
      return legal;
    }

    const known = this.inspectedByPlayer[playerId].includes(placeId);
    if (!known) {
      legal.push(action(`inspect:${placeId}`, 'inspect', placeId, [...REGION_BY_ID[placeId].tags, 'unknown']));
      return legal;
    }

    const discovery = this.hiddenLayout[placeId];
    if (!this.claimedByRegion[placeId] && (discovery.kind === 'seal' || discovery.kind === 'relic')) {
      legal.push(action(`gather:${discovery.itemId}`, 'gather', discovery.itemId, [...REGION_BY_ID[placeId].tags, discovery.kind]));
    }
    legal.push(action('move:camp', 'move', HUB.id, HUB.tags));
    if (this.playerIds.length === 2 && discovery.kind === 'seal') {
      legal.push(action('signal:found-seal', 'signal', 'found-seal', ['cooperation', 'communication', 'seal']));
    }
    return legal;
  }

  step(playerId, actionTaken) {
    if (this.gateOpen) throw new Error('session is already complete');
    if (playerId !== this.activePlayerId()) throw new Error(`not ${playerId}'s turn`);

    const observation = this.observe(playerId);
    assertLegalAction(actionTaken, observation);
    const preStateDigest = digest(this.publicState());
    const outcome = this.applyAction(playerId, actionTaken);

    this.turn += 1;
    if (!this.gateOpen) this.activePlayerIndex = (this.activePlayerIndex + 1) % this.playerIds.length;

    const receipt = {
      schema: 'axm.floorborn.expedition.receipt.v0.1',
      sessionId: this.sessionId,
      seed: this.seed,
      playerId,
      turn: observation.turn,
      observationDigest: digest(observation),
      action: stableClone(actionTaken),
      outcome,
      preStateDigest,
      postStateDigest: digest(this.publicState()),
    };
    this.receipts.push(receipt);
    return stableClone(receipt);
  }

  applyAction(playerId, actionTaken) {
    const fromPlace = this.placeByPlayer[playerId];

    if (actionTaken.kind === 'move') {
      this.placeByPlayer[playerId] = actionTaken.target;
      return outcome(
        `moved:${actionTaken.target}`,
        actionTaken.target,
        `Moved to ${placeSummary(actionTaken.target).label}.`,
        0,
        0.2,
      );
    }

    if (actionTaken.kind === 'inspect') {
      if (!this.inspectedByPlayer[playerId].includes(fromPlace)) this.inspectedByPlayer[playerId].push(fromPlace);
      const discovery = this.hiddenLayout[fromPlace];
      if (discovery.kind === 'trap') {
        return outcome(`trap:${fromPlace}`, fromPlace, 'A resonance snare discharged. No item was found.', -2, 0.8);
      }
      if (discovery.kind === 'empty') {
        return outcome(`empty:${fromPlace}`, fromPlace, 'The area was explored, but nothing portable was found.', -0.2, 0.7);
      }
      if (discovery.kind === 'relic') {
        return outcome(`found-relic:${fromPlace}`, fromPlace, 'A nonessential memory relic was discovered.', 0.2, 1.0);
      }
      return outcome(`found-seal:${fromPlace}`, fromPlace, 'A resonance seal was discovered.', 0.8, 1.0);
    }

    if (actionTaken.kind === 'gather') {
      if (this.claimedByRegion[fromPlace]) throw new Error(`${fromPlace} discovery is already claimed`);
      const discovery = this.hiddenLayout[fromPlace];
      if (actionTaken.target !== discovery.itemId) throw new Error('gather target mismatch');
      this.claimedByRegion[fromPlace] = playerId;
      this.inventoryByPlayer[playerId].push(discovery.itemId);
      const utility = discovery.kind === 'seal' ? 2.5 : 0.4;
      return outcome(`gathered:${discovery.itemId}`, fromPlace, `Collected ${discovery.itemId}.`, utility, 0.4);
    }

    if (actionTaken.id === 'signal:open-gate') {
      if (totalSeals(this.inventoryByPlayer) < 2) throw new Error('not enough seals');
      this.gateOpen = true;
      this.lastSignalByPlayer[playerId] = 'open-gate';
      return outcome('gate-opened', GATE.id, 'The Resonance Gate opened.', 4, 0.8);
    }

    if (actionTaken.kind === 'signal') {
      this.lastSignalByPlayer[playerId] = actionTaken.target;
      return outcome(`signal:${actionTaken.target}`, fromPlace, `Signaled ${actionTaken.target}.`, 0.1, 0.2);
    }

    return outcome('waited', fromPlace, 'Waited.', 0, 0);
  }

  exitsFor(placeId) {
    if (placeId === HUB.id) return [...REGIONS.map((region) => region.id), GATE.id];
    if (placeId === GATE.id) return [HUB.id];
    return [HUB.id];
  }

  publicState() {
    return {
      sessionId: this.sessionId,
      seed: this.seed,
      turn: this.turn,
      activePlayerId: this.gateOpen ? null : this.activePlayerId(),
      placeByPlayer: stableClone(this.placeByPlayer),
      inventoryByPlayer: stableClone(this.inventoryByPlayer),
      inspectedByPlayer: Object.fromEntries(
        Object.entries(this.inspectedByPlayer).map(([id, values]) => [id, [...values].sort()]),
      ),
      claimedByRegion: stableClone(this.claimedByRegion),
      lastSignalByPlayer: stableClone(this.lastSignalByPlayer),
      gateOpen: this.gateOpen,
    };
  }

  snapshot() {
    return stableClone({
      schema: 'axm.floorborn.expedition.game.v0.1',
      ...this.publicState(),
      playerIds: [...this.playerIds],
      activePlayerIndex: this.activePlayerIndex,
      receipts: this.receipts,
    });
  }

  restoreSnapshot(snapshot) {
    if (snapshot.schema !== 'axm.floorborn.expedition.game.v0.1') throw new Error('unsupported expedition snapshot');
    if (snapshot.sessionId !== this.sessionId || snapshot.seed !== this.seed) throw new Error('snapshot session mismatch');
    if (JSON.stringify(snapshot.playerIds) !== JSON.stringify(this.playerIds)) throw new Error('snapshot player mismatch');

    this.turn = snapshot.turn;
    this.activePlayerIndex = snapshot.activePlayerIndex;
    this.placeByPlayer = stableClone(snapshot.placeByPlayer);
    this.inventoryByPlayer = stableClone(snapshot.inventoryByPlayer);
    this.inspectedByPlayer = stableClone(snapshot.inspectedByPlayer);
    this.claimedByRegion = stableClone(snapshot.claimedByRegion);
    this.lastSignalByPlayer = stableClone(snapshot.lastSignalByPlayer);
    this.gateOpen = Boolean(snapshot.gateOpen);
    this.receipts = stableClone(snapshot.receipts ?? []);
  }

  assertKnownPlayer(playerId) {
    if (!this.playerIds.includes(playerId)) throw new Error(`unknown player: ${playerId}`);
  }
}

export function runFloorbornExpedition({ floorborn, sessionId, seed, maxTurns = 40 } = {}) {
  const game = new ExpeditionSession({ sessionId, seed, playerIds: [floorborn.playerId] });
  const decisions = [];

  while (!game.isComplete() && game.turn < maxTurns) {
    const observation = game.observe(floorborn.playerId);
    const actionTaken = floorborn.decide(observation);
    decisions.push(stableClone(floorborn.lastDecision));
    const receipt = game.step(floorborn.playerId, actionTaken);
    floorborn.learn(receipt);
  }

  if (game.isComplete()) floorborn.markSessionComplete(sessionId);
  return { game, decisions };
}

export function replayExpedition({ sessionId, seed, playerIds = ['floorborn-001'], receipts }) {
  const game = new ExpeditionSession({ sessionId, seed, playerIds });
  for (const expected of receipts) {
    const observation = game.observe(expected.playerId);
    if (digest(observation) !== expected.observationDigest) {
      throw new Error(`replay observation mismatch at turn ${expected.turn}`);
    }
    const actual = game.step(expected.playerId, expected.action);
    if (actual.preStateDigest !== expected.preStateDigest || actual.postStateDigest !== expected.postStateDigest) {
      throw new Error(`replay state mismatch at turn ${expected.turn}`);
    }
    if (digest(actual.outcome) !== digest(expected.outcome)) {
      throw new Error(`replay outcome mismatch at turn ${expected.turn}`);
    }
  }
  return game.publicState();
}

export function layoutForSeed(seed) {
  const ids = REGIONS.map((region) => region.id);
  const rotated = rotate(ids, mod(seed, ids.length));
  if (Math.abs(seed) % 2 === 1) [rotated[1], rotated[2]] = [rotated[2], rotated[1]];

  const layout = Object.fromEntries(ids.map((id) => [id, { kind: 'empty', itemId: null }]));
  layout[rotated[0]] = { kind: 'seal', itemId: 'ember-seal' };
  layout[rotated[1]] = { kind: 'seal', itemId: 'tide-seal' };
  layout[rotated[2]] = { kind: 'relic', itemId: 'memory-relic' };
  layout[rotated[3]] = { kind: 'trap', itemId: null };
  return Object.freeze(layout);
}

function placeView(placeId, known, hiddenLayout, claimedByRegion) {
  if (placeId === HUB.id) return { ...HUB, known: true };
  if (placeId === GATE.id) return { ...GATE, known: true };

  const region = REGION_BY_ID[placeId];
  const view = {
    id: region.id,
    label: region.label,
    tags: [...region.tags],
    known,
  };
  if (known) {
    const discovery = hiddenLayout[placeId];
    view.discovery = {
      kind: discovery.kind,
      claimed: Boolean(claimedByRegion[placeId]),
    };
  }
  return view;
}

function placeSummary(id) {
  if (id === HUB.id) return HUB;
  if (id === GATE.id) return GATE;
  return REGION_BY_ID[id];
}

function totalSeals(inventoryByPlayer) {
  return Object.values(inventoryByPlayer).flat().filter((item) => item.endsWith('-seal')).length;
}

function totalRelics(inventoryByPlayer) {
  return Object.values(inventoryByPlayer).flat().filter((item) => item.endsWith('-relic')).length;
}

function action(id, kind, target, affordanceTags) {
  const result = { id, kind, affordanceTags: [...affordanceTags].sort() };
  if (target !== undefined) result.target = target;
  return result;
}

function outcome(eventId, placeId, description, utility, novelty) {
  return { eventId, placeId, description, utility, novelty };
}

function rotate(values, count) {
  return [...values.slice(count), ...values.slice(0, count)];
}

function mod(value, base) {
  return ((value % base) + base) % base;
}
