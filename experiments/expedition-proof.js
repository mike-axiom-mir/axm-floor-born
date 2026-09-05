import { FloorbornPlayer } from '../src/floorborn.js';
import { runFloorbornExpedition } from '../src/expedition-rpg.js';

const floorborn = new FloorbornPlayer({
  playerId: 'floorborn-001',
  lineageId: 'floorborn-expedition-root',
});

for (const seed of [0, 1, 2, 3, 7, 11]) {
  const { game } = runFloorbornExpedition({
    floorborn,
    sessionId: `expedition-${seed}`,
    seed,
    maxTurns: 40,
  });

  console.log(JSON.stringify({
    seed,
    complete: game.isComplete(),
    turns: game.turn,
    actions: game.receipts.map((receipt) => receipt.action.id),
    inventory: game.publicState().inventoryByPlayer['floorborn-001'],
  }, null, 2));
}
