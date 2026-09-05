import test from 'node:test';
import assert from 'node:assert/strict';

import { FloorbornPlayer } from '../src/floorborn.js';
import { InterludeSession } from '../src/interlude.js';
import { SignalTrialSession } from '../src/signal-trial.js';

test('broad companion familiarity cannot substitute for evidence about a new specific claim', () => {
  const player = new FloorbornPlayer({ playerId: 'floorborn-001' });

  for (let index = 0; index < 8; index += 1) {
    const interlude = new InterludeSession({
      sessionId: `familiar-without-route-evidence-${index}`,
      playerId: 'floorborn-001',
      peerId: 'chat-001',
    });
    player.decide(interlude.observe());
  }

  const companion = player.memory.companions['chat-001'];
  assert.ok(companion.observedTurns >= 8);
  assert.ok(companion.sharedSessions.length >= 8);
  assert.equal(companion.signalEvidence['route-safe'], undefined);

  const trial = new SignalTrialSession({
    sessionId: 'familiar-new-claim',
    peerId: 'chat-001',
    peerSignal: 'route-safe',
    actualSafe: true,
    mode: 'evaluation',
  });

  const action = player.decide(trial.observe());
  assert.equal(action.id, 'inspect:verify-current');

  const follow = player.lastDecision.proposals.find(
    (proposal) => proposal.actionId === 'signal:follow-peer',
  );
  assert.ok(follow.evidence.includes('unverified-specific-signal=blocks-general-companion-bonus'));
  assert.equal(follow.evidence.some((line) => line === 'peer-signal=+0.9'), false);
  assert.equal(follow.evidence.some((line) => line.startsWith('companion:chat-001=+')), false);
});
