import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import {
  effectiveCommandCost,
  replayRtsSession,
  RtsActionBudgetSession,
  RTS_EFFECTIVE_ACTIONS_PER_WINDOW,
  RTS_EFFECTIVE_APM_LIMIT,
  RTS_WINDOW_SECONDS,
  runRtsFloorbornProof,
} from '../src/rts-lab.js';

assert.equal(RTS_WINDOW_SECONDS, 5);
assert.equal(RTS_EFFECTIVE_ACTIONS_PER_WINDOW, 2);
assert.equal(RTS_EFFECTIVE_APM_LIMIT, 24);

const costGame = new RtsActionBudgetSession({ sessionId: 'v08-cost-proof' });
const pair = costGame.observe().legalActions.find(
  (action) => action.id === 'command:move:army-pair:hill',
);
assert.ok(pair);
assert.equal(pair.affectedGroups.length, 2);
assert.equal(effectiveCommandCost(pair), 2);
assert.equal(pair.effectiveCost, 2);

const dishonest = { ...pair, effectiveCost: 1 };
const beforeDishonest = costGame.publicState();
assert.throws(() => costGame.step(dishonest), /effective cost mismatch/);
assert.deepEqual(costGame.publicState(), beforeDishonest);

const floorborn = new FloorbornPlayer({
  playerId: 'floorborn-001',
  lineageId: 'v08-rts-transfer',
});
const run = runRtsFloorbornProof({
  player: floorborn,
  sessionId: 'v08-rts-floorborn',
});

assert.equal(run.game.isComplete(), true);
assert.deepEqual(
  run.decisions.map((entry) => entry.action.id),
  ['command:build:power-node', 'command:scout:north'],
);
assert.deepEqual(
  run.decisions.map((entry) => entry.receipt.effectiveCost),
  [1, 1],
);
assert.deepEqual(
  run.decisions.map((entry) => [entry.receipt.budgetBefore, entry.receipt.budgetAfter]),
  [[2, 1], [1, 0]],
);

const replayed = replayRtsSession({
  sessionId: 'v08-rts-floorborn',
  receipts: run.game.receipts,
});
assert.deepEqual(replayed, run.finalState);

console.log(JSON.stringify({
  gate: 'AXM Floorborn v0.8 RTS action-budget transfer',
  status: 'PASS',
  actionWindow: {
    seconds: RTS_WINDOW_SECONDS,
    effectiveActions: RTS_EFFECTIVE_ACTIONS_PER_WINDOW,
    effectiveApmLimit: RTS_EFFECTIVE_APM_LIMIT,
  },
  antiCheese: {
    command: pair.id,
    independentlyAffectedGroups: pair.affectedGroups,
    effectiveCost: pair.effectiveCost,
    falseCostOneRejectedBeforeMutation: true,
  },
  floorborn: {
    actionSequence: run.decisions.map((entry) => entry.action.id),
    effectiveCosts: run.decisions.map((entry) => entry.receipt.effectiveCost),
    budgetPath: run.decisions.map((entry) => ({
      before: entry.receipt.budgetBefore,
      after: entry.receipt.budgetAfter,
    })),
    powerNodes: run.finalState.powerNodes,
    northScouted: run.finalState.scouted.north,
    unusedDistractorCommands: [
      'command:scout:south',
      'command:move:army-alpha:hill',
      'command:move:army-pair:hill',
    ],
  },
  replay: 'PASS',
}, null, 2));
