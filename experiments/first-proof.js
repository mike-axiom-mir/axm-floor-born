import { FloorbornPlayer } from '../src/floorborn.js';
import { runSession } from '../src/rpg.js';

const fresh = new FloorbornPlayer({ playerId: 'fresh' });
const freshEval = runSession({
  player: fresh,
  scenario: 'crossroads',
  sessionId: 'fresh-eval',
});

const experienced = new FloorbornPlayer({ playerId: 'experienced' });
const lesson = runSession({
  player: experienced,
  scenario: 'ruins-lesson',
  sessionId: 'ruins-lesson-001',
});
const experiencedEval = runSession({
  player: experienced,
  scenario: 'crossroads',
  sessionId: 'experienced-eval',
});

const freshChoice = freshEval.receipts[0].action.id;
const experiencedChoice = experiencedEval.receipts[0].action.id;

console.log('AXM Floorborn v0.1 first proof');
console.log('--------------------------------');
console.log(`fresh choice:       ${freshChoice}`);
console.log(`experienced choice: ${experiencedChoice}`);
console.log(`choice changed:      ${freshChoice !== experiencedChoice}`);
console.log(`lesson episodes:     ${lesson.receipts.length}`);
console.log(`memory patterns:     ${Object.keys(experienced.snapshot().memory.tagPatterns).sort().join(', ')}`);
console.log('');
console.log('Experienced crossroads decision trace:');
for (const proposal of experiencedEval.decisions[0].proposals) {
  console.log(`- ${proposal.actionId}: ${proposal.score} [${proposal.evidence.join('; ')}]`);
}
