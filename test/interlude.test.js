import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import { ExpeditionSession, layoutForSeed } from '../src/expedition-rpg.js';
import { InterludeSession, replayInterlude } from '../src/interlude.js';

function actionById(game, playerId, id) {
  const observation = game.observe(playerId);
  const action = observation.legalActions.find((candidate) => candidate.id === id);
  assert.ok(action, `${id} should be legal`);
  return action;
}

function teachRelicExperience(player) {
  let seed = null;
  let regionId = null;
  for (let candidate = 0; candidate < 32; candidate += 1) {
    const layout = layoutForSeed(candidate);
    const entry = Object.entries(layout).find(([, discovery]) => discovery.kind === 'relic');
    if (entry) {
      seed = candidate;
      [regionId] = entry;
      break;
    }
  }
  assert.notEqual(seed, null);

  const game = new ExpeditionSession({ sessionId: 'relic-lesson', seed });
  for (const id of [`move:${regionId}`, `inspect:${regionId}`, 'gather:memory-relic']) {
    const receipt = game.step('floorborn-001', actionById(game, 'floorborn-001', id));
    player.learn(receipt);
  }
}

test('fresh Floorborn prefers closure when no optional-interest history exists', () => {
  const floorborn = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const interlude = new InterludeSession({ sessionId: 'fresh-interlude' });
  const action = floorborn.decide(interlude.observe());

  assert.equal(action.id, 'signal:finish-journey');
});

test('a prior relic experience can change the same later choice into a self-selected optional goal', () => {
  const veteran = new FloorbornPlayer({ playerId: 'floorborn-001' });
  teachRelicExperience(veteran);

  const interlude = new InterludeSession({ sessionId: 'veteran-interlude' });
  const action = veteran.decide(interlude.observe());

  assert.equal(action.id, 'signal:seek-relic');
  const proposal = veteran.lastDecision.proposals.find((candidate) => candidate.actionId === 'signal:seek-relic');
  assert.ok(proposal.evidence.some((line) => line.startsWith('memory:relic=+')));
  assert.ok(proposal.evidence.includes('optional-curiosity=+0.4'));
});

test('optional goal choice is still an ordinary legal player action with exact replay', () => {
  const veteran = new FloorbornPlayer({ playerId: 'floorborn-001' });
  teachRelicExperience(veteran);
  const interlude = new InterludeSession({ sessionId: 'replay-interlude' });

  const action = veteran.decide(interlude.observe());
  const receipt = interlude.step(action);
  veteran.learn(receipt);

  assert.equal(interlude.publicState().selectedIntent, 'seek-relic');
  const replayed = replayInterlude({
    sessionId: 'replay-interlude',
    receipts: interlude.receipts,
  });
  assert.deepEqual(replayed, interlude.publicState());
});

test('optional-choice memory remains explicit rather than rewriting the game rules', () => {
  const fresh = new FloorbornPlayer({ playerId: 'floorborn-001' });
  const veteran = new FloorbornPlayer({ playerId: 'floorborn-001' });
  teachRelicExperience(veteran);

  const freshGame = new InterludeSession({ sessionId: 'same-rules-fresh' });
  const veteranGame = new InterludeSession({ sessionId: 'same-rules-veteran' });

  const freshIds = freshGame.observe().legalActions.map((action) => action.id);
  const veteranIds = veteranGame.observe().legalActions.map((action) => action.id);
  assert.deepEqual(veteranIds, freshIds);

  assert.equal(fresh.decide(freshGame.observe()).id, 'signal:finish-journey');
  assert.equal(veteran.decide(veteranGame.observe()).id, 'signal:seek-relic');
});
