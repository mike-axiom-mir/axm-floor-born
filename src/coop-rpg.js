import { assertLegalAction, freezeObservation, PLAYER_PROTOCOL_VERSION } from './protocol.js';
import { digest, stableClone } from './stable.js';

const PLAYER_IDS = Object.freeze(['floorborn-001', 'chat-001']);

const WORLD = Object.freeze({
  start: 'crossroads',
  places: {
    crossroads: {
      label: 'Lantern Crossroads',
      tags: ['junction', 'safe'],
      exits: ['forest', 'ruins'],
    },
    forest: {
      label: 'Mossglass Forest',
      tags: ['wild', 'resource'],
      exits: ['gate'],
      shard: 'sun-shard',
    },
    ruins: {
      label: 'Echo Ruins',
      tags: ['ancient', 'structure'],
      exits: ['gate'],
      shard: 'moon-shard',
    },
    gate: {
      label: 'Twinseal Gate',
      tags: ['ancient', 'gate'],
      exits: ['forest', 'ruins'],
    },
  },
});

export class CoopRpgSession {
  constructor({
    sessionId,
    playerIds = PLAYER_IDS,
    snapshot = null,
  }) {
    if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
    if (!Array.isArray(playerIds) || playerIds.length !== 2 || new Set(playerIds).size !== 2) {
      throw new Error('co-op proof requires exactly two distinct player ids');
    }

    this.sessionId = sessionId;
    this.playerIds = [...playerIds];

    if (snapshot) {
      this.restoreSnapshot(snapshot);
      return;
    }

    this.turn = 0;
    this.activePlayerIndex = 0;
    this.placeByPlayer = Object.fromEntries(this.playerIds.map((id) => [id, WORLD.start]));
    this.inventoryByPlayer = Object.fromEntries(this.playerIds.map((id) => [id, []]));
    this.inspectedByPlayer = Object.fromEntries(this.playerIds.map((id) => [id, []]));
    this.shardHolder = { 'sun-shard': null, 'moon-shard': null };
    this.gateOpen = false;
    this.receipts = [];
  }

  activePlayerId() {
    return this.playerIds[this.activePlayerIndex];
  }

  observe(playerId = this.activePlayerId()) {
    this.assertKnownPlayer(playerId);
    if (playerId !== this.activePlayerId()) throw new Error(`not ${playerId}'s turn`);

    const placeId = this.placeByPlayer[playerId];
    const place = WORLD.places[placeId];
    const inspected = this.inspectedByPlayer[playerId].includes(placeId);
    const legalActions = this.legalActionsFor(playerId);
    const peerId = this.playerIds.find((id) => id !== playerId);

    return freezeObservation({
      protocol: PLAYER_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      turn: this.turn,
      self: {
        playerId,
        inventory: [...this.inventoryByPlayer[playerId]],
      },
      place: {
        id: placeId,
        label: place.label,
        tags: [...place.tags],
        known: inspected,
      },
      exits: (place.exits ?? []).map((exitId) => ({
        id: exitId,
        label: WORLD.places[exitId].label,
        tags: [...WORLD.places[exitId].tags],
      })),
      party: {
        objective: 'Recover the sun shard and moon shard, reunite at the Twinseal Gate, and open it.',
        shardStatus: {
          sun: this.shardHolder['sun-shard'] ? 'carried' : 'unclaimed',
          moon: this.shardHolder['moon-shard'] ? 'carried' : 'unclaimed',
        },
        peer: {
          playerId: peerId,
          placeId: this.placeByPlayer[peerId],
          inventory: [...this.inventoryByPlayer[peerId]],
        },
      },
      legalActions,
    });
  }

  step(playerId, action) {
    if (this.gateOpen) throw new Error('session is already complete');
    if (playerId !== this.activePlayerId()) throw new Error(`not ${playerId}'s turn`);

    const observation = this.observe(playerId);
    assertLegalAction(action, observation);
    const preStateDigest = digest(this.publicState());
    const outcome = this.applyAction(playerId, action);

    this.turn += 1;
    if (!this.gateOpen) this.activePlayerIndex = (this.activePlayerIndex + 1) % this.playerIds.length;

    const receipt = {
      schema: 'axm.floorborn.coop.receipt.v0.1',
      sessionId: this.sessionId,
      playerId,
      turn: observation.turn,
      observationDigest: digest(observation),
      action: stableClone(action),
      outcome,
      preStateDigest,
      postStateDigest: digest(this.publicState()),
    };
    this.receipts.push(receipt);
    return stableClone(receipt);
  }

  legalActionsFor(playerId) {
    const placeId = this.placeByPlayer[playerId];
    const place = WORLD.places[placeId];
    const inventory = this.inventoryByPlayer[playerId];
    const inspected = this.inspectedByPlayer[playerId].includes(placeId);
    const shard = place.shard;
    const legal = [];

    if (shard && !this.shardHolder[shard]) {
      if (!inspected) {
        legal.push(action(`inspect:${placeId}`, 'inspect', placeId, [...place.tags, 'unknown']));
        return legal;
      }
      legal.push(action(`gather:${shard}`, 'gather', shard, [...place.tags, 'shard']));
      return legal;
    }

    if (placeId === 'crossroads') {
      for (const exitId of place.exits) {
        legal.push(action(`move:${exitId}`, 'move', exitId, WORLD.places[exitId].tags));
      }
      legal.push(action('wait:crossroads', 'wait', undefined, ['junction']));
      return legal;
    }

    if (placeId === 'forest' || placeId === 'ruins') {
      legal.push(action('move:gate', 'move', 'gate', WORLD.places.gate.tags));
      const otherShardPlace = placeId === 'forest' ? 'ruins' : 'forest';
      if (!this.shardHolder[WORLD.places[otherShardPlace].shard]) {
        legal.push(action(`move:${otherShardPlace}`, 'move', otherShardPlace, WORLD.places[otherShardPlace].tags));
      }
      return legal;
    }

    if (placeId === 'gate') {
      const bothShards = Boolean(this.shardHolder['sun-shard'] && this.shardHolder['moon-shard']);
      const bothPlayersHere = this.playerIds.every((id) => this.placeByPlayer[id] === 'gate');
      if (bothShards && bothPlayersHere) {
        legal.push(action('signal:open-gate', 'signal', 'twinseal', ['ancient', 'gate', 'cooperation']));
        legal.push(action('wait:gate', 'wait', undefined, ['gate']));
        return legal;
      }

      const carriesShard = inventory.some((item) => item.endsWith('-shard'));
      if (!carriesShard) {
        for (const exitId of place.exits) {
          const missingShard = WORLD.places[exitId].shard;
          if (!this.shardHolder[missingShard]) {
            legal.push(action(`move:${exitId}`, 'move', exitId, WORLD.places[exitId].tags));
          }
        }
      }
      legal.push(action('wait:partner', 'wait', undefined, ['gate', 'cooperation']));
      return legal;
    }

    legal.push(action('wait:default', 'wait', undefined, ['safe']));
    return legal;
  }

  applyAction(playerId, actionTaken) {
    const fromPlace = this.placeByPlayer[playerId];

    if (actionTaken.kind === 'move') {
      this.placeByPlayer[playerId] = actionTaken.target;
      return outcome(`moved:${actionTaken.target}`, actionTaken.target, `Moved to ${WORLD.places[actionTaken.target].label}.`, 0, 0.25);
    }

    if (actionTaken.kind === 'inspect') {
      if (!this.inspectedByPlayer[playerId].includes(fromPlace)) this.inspectedByPlayer[playerId].push(fromPlace);
      return outcome(`inspected:${fromPlace}`, fromPlace, `Inspected ${WORLD.places[fromPlace].label} and located its hidden shard.`, 0.5, 1.0);
    }

    if (actionTaken.kind === 'gather') {
      const shard = actionTaken.target;
      if (this.shardHolder[shard]) throw new Error(`${shard} is already carried`);
      this.shardHolder[shard] = playerId;
      this.inventoryByPlayer[playerId].push(shard);
      return outcome(`gathered:${shard}`, fromPlace, `Collected the ${shard}.`, 2.0, 0.5);
    }

    if (actionTaken.id === 'signal:open-gate') {
      this.gateOpen = true;
      return outcome('gate-opened', 'gate', 'Both players reunited with both shards. The Twinseal Gate opened.', 3.0, 0.75);
    }

    return outcome('waited', fromPlace, 'Waited for the other player.', 0, 0);
  }

  isComplete() {
    return this.gateOpen;
  }

  publicState() {
    return {
      sessionId: this.sessionId,
      turn: this.turn,
      activePlayerId: this.gateOpen ? null : this.activePlayerId(),
      placeByPlayer: stableClone(this.placeByPlayer),
      inventoryByPlayer: stableClone(this.inventoryByPlayer),
      inspectedByPlayer: Object.fromEntries(
        Object.entries(this.inspectedByPlayer).map(([id, values]) => [id, [...values].sort()]),
      ),
      shardHolder: stableClone(this.shardHolder),
      gateOpen: this.gateOpen,
    };
  }

  snapshot() {
    return stableClone({
      schema: 'axm.floorborn.coop.game.v0.1',
      ...this.publicState(),
      playerIds: [...this.playerIds],
      activePlayerIndex: this.activePlayerIndex,
      receipts: this.receipts,
    });
  }

  restoreSnapshot(snapshot) {
    if (snapshot.schema !== 'axm.floorborn.coop.game.v0.1') throw new Error('unsupported co-op snapshot');
    if (snapshot.sessionId !== this.sessionId) throw new Error('snapshot session mismatch');
    if (JSON.stringify(snapshot.playerIds) !== JSON.stringify(this.playerIds)) throw new Error('snapshot player mismatch');

    this.turn = snapshot.turn;
    this.activePlayerIndex = snapshot.activePlayerIndex;
    this.placeByPlayer = stableClone(snapshot.placeByPlayer);
    this.inventoryByPlayer = stableClone(snapshot.inventoryByPlayer);
    this.inspectedByPlayer = stableClone(snapshot.inspectedByPlayer);
    this.shardHolder = stableClone(snapshot.shardHolder);
    this.gateOpen = Boolean(snapshot.gateOpen);
    this.receipts = stableClone(snapshot.receipts ?? []);
  }

  assertKnownPlayer(playerId) {
    if (!this.playerIds.includes(playerId)) throw new Error(`unknown player: ${playerId}`);
  }
}

export function replayCoopSession({ sessionId, playerIds = PLAYER_IDS, receipts }) {
  const game = new CoopRpgSession({ sessionId, playerIds });
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

function action(id, kind, target, affordanceTags) {
  const result = { id, kind, affordanceTags: [...affordanceTags].sort() };
  if (target !== undefined) result.target = target;
  return result;
}

function outcome(eventId, placeId, description, utility, novelty) {
  return { eventId, placeId, description, utility, novelty };
}
